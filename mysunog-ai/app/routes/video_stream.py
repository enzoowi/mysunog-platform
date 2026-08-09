"""
Video upload endpoint for AI fire/smoke detection.

Accepts a video file upload, registers it as a virtual "camera" in the
existing CameraManager, and plays it back frame-by-frame so the full
detection pipeline runs on each frame (bounding boxes, alerts, incidents).

The MJPEG stream is served by the existing /stream/mjpeg/{camera_id} endpoint.
"""

import cv2
import os
import threading
import time
import uuid
import logging
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import settings
from app.detection.false_positive import ConsecutiveFrameValidator
from app.routes.stream import _manager, CameraSource

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video")

# Temp directory for uploaded videos
_UPLOAD_DIR = Path("temp_videos")
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Track active video sessions so we can clean up
_active_videos: dict[str, Path] = {}


class _VideoPlayerThread(threading.Thread):
    """
    Reads a video file frame-by-frame and pushes frames into a CameraSource
    so the existing detection pipeline picks them up automatically.
    """

    def __init__(self, camera: CameraSource, video_path: str, target_fps: float = 15.0):
        super().__init__(daemon=True)
        self.camera = camera
        self.video_path = video_path
        self.target_fps = min(target_fps, 30.0)
        self._stop_event = threading.Event()

    def stop(self):
        self._stop_event.set()

    def run(self):
        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            self.camera.error = f"Cannot open video file: {self.video_path}"
            logger.error(self.camera.error)
            return

        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        playback_fps = min(video_fps, self.target_fps)
        frame_interval = 1.0 / playback_fps

        self.camera.running = True
        self.camera.error = None
        logger.info(
            f"[VIDEO] Starting playback: {self.video_path} "
            f"(native {video_fps:.0f}fps, playback {playback_fps:.0f}fps)"
        )

        last_good_frame: Optional[np.ndarray] = None

        while not self._stop_event.is_set():
            start = time.time()

            ret, frame = cap.read()
            if not ret:
                # Video finished — hold on last frame with overlay
                if last_good_frame is not None:
                    finished_frame = last_good_frame.copy()
                    h, w = finished_frame.shape[:2]
                    overlay = finished_frame.copy()
                    cv2.rectangle(overlay, (0, h - 50), (w, h), (0, 0, 0), -1)
                    cv2.addWeighted(overlay, 0.6, finished_frame, 0.4, 0, finished_frame)
                    cv2.putText(
                        finished_frame,
                        "PLAYBACK COMPLETE",
                        (w // 2 - 160, h - 18),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.8,
                        (255, 255, 255),
                        2,
                    )
                    with self.camera.lock:
                        self.camera.last_frame = finished_frame
                        self.camera.last_frame_time = time.time()
                logger.info(f"[VIDEO] Playback finished for {self.camera.camera_id}")
                break

            self.camera.frame_count += 1
            last_good_frame = frame.copy()

            with self.camera.lock:
                self.camera.last_frame = frame
                self.camera.last_frame_time = time.time()

            # Throttle to target FPS
            elapsed = time.time() - start
            remaining = frame_interval - elapsed
            if remaining > 0:
                time.sleep(remaining)

        cap.release()
        logger.info(f"[VIDEO] Player thread exited for {self.camera.camera_id}")


# ─── Endpoints ────────────────────────────────────────────────────

@router.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    camera_name: Optional[str] = Form(None),
):
    """
    Upload a video file for AI fire/smoke detection playback.

    The video is registered as a virtual camera so the existing detection
    pipeline (YOLO, bounding boxes, alerts, incident webhook) runs on
    every frame automatically.

    Returns the video_id which can be used to stream via /stream/mjpeg/{video_id}.
    """
    # Validate file type
    allowed_extensions = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
    ext = Path(file.filename or "video.mp4").suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format '{ext}'. Allowed: {', '.join(allowed_extensions)}",
        )

    # Save uploaded file
    video_id = f"video_{uuid.uuid4().hex[:8]}"
    save_path = _UPLOAD_DIR / f"{video_id}{ext}"

    try:
        contents = await file.read()
        with open(save_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save video: {e}")

    _active_videos[video_id] = save_path

    # Create a CameraSource shell (we override the read loop with our video player)
    camera = CameraSource(video_id)
    camera.camera_name = camera_name or file.filename or "Uploaded Video"
    camera.camera_location = "Video Upload"
    camera.running = True
    camera.frame_count = 0

    # Use lower consecutive-frame threshold for video (frames are more spread out)
    camera.validator = ConsecutiveFrameValidator(
        required_consecutive=2,
        timeout_seconds=30,
    )
    camera.MIN_INCIDENT_CONSECUTIVE = 2

    # Register in the manager so /stream/mjpeg/{video_id} works
    with _manager.lock:
        _manager.cameras[video_id] = camera

    # Start the background detection loop if not already running
    _manager._ensure_bg_detection()

    # Start the video player thread (feeds frames into the CameraSource)
    player = _VideoPlayerThread(camera, str(save_path), target_fps=15.0)
    player.start()

    # Store the player thread reference for cleanup
    camera._thread = player

    logger.info(f"[VIDEO] Upload complete: {video_id} -> {save_path}")

    return {
        "success": True,
        "video_id": video_id,
        "stream_url": f"/stream/mjpeg/{video_id}",
        "message": f"Video uploaded and AI detection started.",
    }


@router.delete("/stop/{video_id}")
async def stop_video(video_id: str):
    """Stop a video playback and clean up resources."""
    camera = _manager.get_camera(video_id)
    if camera and hasattr(camera, "_thread") and isinstance(camera._thread, _VideoPlayerThread):
        camera._thread.stop()

    _manager.stop_camera(video_id)

    # Clean up temp file
    path = _active_videos.pop(video_id, None)
    if path and path.exists():
        try:
            os.remove(path)
        except Exception as e:
            logger.warning(f"[VIDEO] Failed to delete temp file {path}: {e}")

    return {"success": True, "message": f"Video {video_id} stopped and cleaned up."}


@router.get("/active")
async def list_active_videos():
    """List all currently active video playback sessions."""
    result = []
    for vid_id, path in _active_videos.items():
        camera = _manager.get_camera(vid_id)
        result.append({
            "video_id": vid_id,
            "filename": path.name if path else None,
            "is_active": camera.is_active if camera else False,
            "has_frames": camera.has_recent_frames if camera else False,
            "frame_count": camera.frame_count if camera else 0,
        })
    return result
