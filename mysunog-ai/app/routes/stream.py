"""
MJPEG streaming endpoint for multiple external cameras (CCTV/IP cameras).

This module reads frames from multiple external camera sources concurrently and:
1. Runs YOLO fire/smoke detection on each frame **in a background thread**
   (detection runs 24/7 even if nobody is viewing the MJPEG stream)
2. Draws bounding boxes on detected regions when an MJPEG viewer connects
3. Streams the annotated frames to the browser as MJPEG per camera
4. Feeds confirmed detections through the full incident pipeline:
   TemporalTracker → SeverityEngine → PriorityEngine → NestJS webhook
"""

import asyncio
import cv2
import httpx
import logging
import numpy as np
import os
import threading
import time
from typing import Optional, Generator, Dict
from fastapi import APIRouter, Header, HTTPException, Query, Path
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import settings
from app.detection.detector import detector
from app.detection.false_positive import ConsecutiveFrameValidator
from app.detection.temporal_tracker import temporal_tracker
from app.detection.severity import compute_severity
from app.services.incident_webhook import post_incident_to_backend, fire_and_forget

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stream")

# Track the last time we broadcast a fire alert per camera (rate limiting)
_last_broadcast_time: Dict[str, float] = {}
_BROADCAST_COOLDOWN_SECONDS = 10  # Only broadcast once per 10 seconds per camera

# ─── Camera State ─────────────────────────────────────────────────

class CameraSource:
    """Manages a persistent OpenCV VideoCapture for a single external camera."""

    def __init__(self, camera_id: str):
        self.camera_id = camera_id
        self.url: Optional[str] = None
        self.cap: Optional[cv2.VideoCapture] = None
        self.lock = threading.Lock()
        self.last_frame: Optional[np.ndarray] = None
        self.last_frame_time: float = 0
        self.running = False
        self.error: Optional[str] = None
        self._thread: Optional[threading.Thread] = None
        self.validator = ConsecutiveFrameValidator(
            required_consecutive=settings.consecutive_frames_required,
            timeout_seconds=15,
        )
        self.frame_count = 0
        self.last_detections: list = []
        # Lock for thread-safe detection result access (background thread writes, MJPEG reads)
        self.detection_lock = threading.Lock()
        # Camera metadata
        self.camera_name:     Optional[str]   = None
        self.camera_location: Optional[str]   = None
        self.latitude:        Optional[float]  = None
        self.longitude:       Optional[float]  = None
        self.MIN_INCIDENT_CONSECUTIVE:   int = 3

    @staticmethod
    def _open_capture(url) -> Optional[cv2.VideoCapture]:
        """
        Open a VideoCapture with RTSP-friendly settings.
        Tries FFMPEG backend first (best RTSP support), then default.
        """
        is_rtsp = str(url).lower().startswith("rtsp://")

        if is_rtsp:
            # Force TCP transport and set timeouts for RTSP streams
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
                "rtsp_transport;tcp|stimeout;5000000|analyzeduration;5000000|probesize;5000000"
            )

        # --- Attempt 1: FFMPEG backend (best for RTSP) ---
        print(f"[STREAM]   Trying FFMPEG backend for: {url}")
        cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        if cap.isOpened():
            # Verify we can actually grab a frame
            ret, _ = cap.read()
            if ret:
                print(f"[STREAM]   FFMPEG backend succeeded")
                return cap
            else:
                print(f"[STREAM]   FFMPEG backend opened but cannot read frames")
                cap.release()

        # --- Attempt 2: Default backend ---
        print(f"[STREAM]   Trying default backend for: {url}")
        cap = cv2.VideoCapture(url)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                print(f"[STREAM]   Default backend succeeded")
                return cap
            else:
                print(f"[STREAM]   Default backend opened but cannot read frames")
                cap.release()

        # --- Attempt 3: For RTSP, try with explicit UDP fallback ---
        if is_rtsp:
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
                "rtsp_transport;udp|stimeout;5000000"
            )
            print(f"[STREAM]   Trying FFMPEG+UDP for: {url}")
            cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
            if cap.isOpened():
                ret, _ = cap.read()
                if ret:
                    print(f"[STREAM]   FFMPEG+UDP backend succeeded")
                    return cap
                else:
                    cap.release()

        return None

    def start(
        self,
        url,
        camera_name: Optional[str] = None,
        camera_location: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> bool:
        with self.lock:
            self._stop_internal()
            print(f"[STREAM] Connecting to camera {self.camera_id}: {url}")

            cap = self._open_capture(url)
            if cap is None:
                self.error = f"Cannot open camera: {url}"
                print(f"[STREAM] {self.error}")
                return False

            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            self.url = str(url)
            self.cap = cap
            self.error = None
            self.running = True
            self.frame_count = 0
            self.last_detections = []
            self.camera_name     = camera_name
            self.camera_location = camera_location
            self.latitude        = latitude
            self.longitude       = longitude

            self._thread = threading.Thread(target=self._read_loop, daemon=True)
            self._thread.start()
            print(f"[STREAM] Camera started: {self.camera_id}")
            return True

    def stop(self):
        with self.lock:
            self._stop_internal()

    def _stop_internal(self):
        self.running = False
        if self.cap:
            self.cap.release()
            self.cap = None
        self.url = None
        self.last_frame = None
        self.error = None
        self.frame_count = 0
        self.last_detections = []
        print(f"[STREAM] Camera {self.camera_id} stopped")

    def _reconnect(self):
        """Attempt to reconnect using the same multi-backend strategy."""
        print(f"[STREAM] [{self.camera_id}] Reconnecting to {self.url}...")
        if self.cap:
            self.cap.release()
            self.cap = None

        cap = self._open_capture(self.url)
        if cap is not None:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            self.cap = cap
            self.error = None
            print(f"[STREAM] [{self.camera_id}] Reconnected successfully")
        else:
            self.error = f"Reconnect failed for {self.url}"
            print(f"[STREAM] [{self.camera_id}] {self.error}")

    def _read_loop(self):
        consecutive_failures = 0
        max_failures = 30

        while self.running:
            if not self.cap:
                self._reconnect()
                if not self.cap:
                    time.sleep(3)
                continue

            if not self.cap.isOpened():
                print(f"[STREAM] [{self.camera_id}] Stream not opened, attempting to reconnect...")
                self._reconnect()
                time.sleep(2)
                continue

            ret, frame = self.cap.read()
            if not ret or frame is None or frame.size == 0:
                consecutive_failures += 1
                if consecutive_failures >= max_failures:
                    self.error = "Camera stream lost — attempting to reconnect"
                    print(f"[STREAM] [{self.camera_id}] {self.error}")
                    self._reconnect()
                    consecutive_failures = 0
                    time.sleep(2)
                else:
                    time.sleep(0.1)
                continue

            consecutive_failures = 0
            self.error = None
            self.frame_count += 1

            with self.lock:
                self.last_frame = frame.copy()
                self.last_frame_time = time.time()

    def get_frame(self) -> Optional[np.ndarray]:
        with self.lock:
            if self.last_frame is None:
                return None
            if time.time() - self.last_frame_time > 5:
                # Instead of None, return the last frame to keep the stream alive
                return self.last_frame.copy()
            return self.last_frame.copy()

    @property
    def has_recent_frames(self) -> bool:
        """True if we have received a frame within the last 10 seconds."""
        if self.last_frame is None:
            return False
        return (time.time() - self.last_frame_time) < 10

    @property
    def is_active(self) -> bool:
        return self.running


class CameraManager:
    def __init__(self):
        self.cameras: Dict[str, CameraSource] = {}
        self.lock = threading.Lock()
        self._bg_thread: Optional[threading.Thread] = None
        self._bg_running = False

    def get_camera(self, camera_id: str) -> Optional[CameraSource]:
        with self.lock:
            return self.cameras.get(camera_id)

    def start_camera(self, camera_id: str, url: str, **kwargs) -> bool:
        with self.lock:
            if camera_id not in self.cameras:
                self.cameras[camera_id] = CameraSource(camera_id)
            cam = self.cameras[camera_id]
        success = cam.start(url, **kwargs)
        if success:
            self._ensure_bg_detection()
        return success

    def stop_camera(self, camera_id: str):
        with self.lock:
            if camera_id in self.cameras:
                self.cameras[camera_id].stop()
                del self.cameras[camera_id]

    def get_all_status(self) -> dict:
        with self.lock:
            return {
                cam_id: {
                    "connected": cam.is_active and cam.has_recent_frames,
                    "url": cam.url,
                    "frame_count": cam.frame_count,
                    "error": cam.error,
                }
                for cam_id, cam in self.cameras.items()
            }

    # ─── Background Detection Loop ───────────────────────────────────

    def _ensure_bg_detection(self):
        """Start the background detection thread if not already running."""
        if self._bg_running:
            return
        self._bg_running = True
        self._bg_thread = threading.Thread(
            target=self._background_detection_loop, daemon=True
        )
        self._bg_thread.start()
        print("[BG-DETECT] Background detection thread started — cameras monitored 24/7")

    def _background_detection_loop(self):
        """
        Continuously run YOLO detection on every active camera.
        This runs in its own daemon thread, independent of MJPEG viewers.
        Detection results are stored on each CameraSource so both this loop
        and MJPEG renderers can access them.
        """
        DETECTION_INTERVAL = 0.5  # seconds between detection passes per camera

        while self._bg_running:
            # Snapshot current cameras
            with self.lock:
                camera_list = list(self.cameras.values())

            if not camera_list:
                time.sleep(1)
                continue

            for camera in camera_list:
                if not camera.is_active:
                    continue
                try:
                    _run_detection_on_camera(camera)
                except Exception as e:
                    logger.error(
                        f"[BG-DETECT] Error on camera {camera.camera_id}: {e}"
                    )

            time.sleep(DETECTION_INTERVAL)


_manager = CameraManager()


# ─── Detection overlay helper ──────────────────────────────────────

def _draw_detections_on_frame(frame: np.ndarray, detections: list, frame_count: int) -> np.ndarray:
    annotated = frame.copy()

    for det in detections:
        x1, y1 = int(det.x1), int(det.y1)
        x2, y2 = int(det.x2), int(det.y2)
        is_fire = det.detection_type.value == "fire"
        color = (0, 0, 230) if is_fire else (100, 100, 100)
        label = f"{'FIRE' if is_fire else 'SMOKE'} {det.confidence * 100:.0f}%"

        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

        corner = min(x2 - x1, y2 - y1, 20)
        cv2.line(annotated, (x1, y1), (x1 + corner, y1), color, 3)
        cv2.line(annotated, (x1, y1), (x1, y1 + corner), color, 3)
        cv2.line(annotated, (x2, y1), (x2 - corner, y1), color, 3)
        cv2.line(annotated, (x2, y1), (x2, y1 + corner), color, 3)
        cv2.line(annotated, (x1, y2), (x1 + corner, y2), color, 3)
        cv2.line(annotated, (x1, y2), (x1, y2 - corner), color, 3)
        cv2.line(annotated, (x2, y2), (x2 - corner, y2), color, 3)
        cv2.line(annotated, (x2, y2), (x2, y2 - corner), color, 3)

        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
        ly = y1 - 8 if y1 > th + 10 else y1 + th + 8
        cv2.rectangle(annotated, (x1, ly - th - 4), (x1 + tw + 8, ly + 2), color, -1)
        cv2.putText(annotated, label, (x1 + 4, ly), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

    status_text = f"LIVE | Frame {frame_count}"
    cv2.putText(annotated, status_text, (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    if detections:
        cv2.putText(annotated, "FIRE/SMOKE DETECTED!", (10, 54),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

    return annotated


# ─── Synchronous fire alert broadcast (thread-safe, no async) ────────

def _broadcast_fire_alert(
    camera_id: str,
    camera_name: Optional[str],
    detection_type: str,
    confidence: float,
    severity: str = "high",
):
    """
    Immediately POST a lightweight alert to NestJS so it can broadcast a
    Socket.IO event to all dashboard clients.  Runs synchronously in the
    background detection thread — no async / event-loop issues.

    Rate-limited: only fires once per _BROADCAST_COOLDOWN_SECONDS per camera.
    """
    now = time.time()
    last = _last_broadcast_time.get(camera_id, 0)
    if (now - last) < _BROADCAST_COOLDOWN_SECONDS:
        return  # Already broadcast recently for this camera

    _last_broadcast_time[camera_id] = now

    url = (
        f"{settings.nestjs_backend_url}/detection/broadcast-alert"
        f"?api_key={settings.service_api_key}"
    )
    payload = {
        "cameraId": camera_id,
        "cameraName": camera_name or camera_id,
        "detectionType": detection_type,
        "confidence": confidence,
        "severity": severity,
    }

    try:
        resp = httpx.post(url, json=payload, timeout=5.0)
        logger.info(
            f"[BROADCAST] Fire alert sent for {camera_id}: "
            f"status={resp.status_code}"
        )
    except Exception as e:
        logger.warning(f"[BROADCAST] Failed to send fire alert for {camera_id}: {e}")


# ─── Background Detection Logic (runs in CameraManager thread) ───────

def _run_detection_on_camera(camera: CameraSource) -> None:
    """
    Run a single round of YOLO detection on the camera's latest frame.
    Called by the CameraManager background thread for every active camera.

    If fire/smoke is confirmed (consecutive frame validation), this function:
    1. Broadcasts a real-time alert to NestJS (which pushes Socket.IO to all clients)
    2. Updates the temporal tracker (fire area, growth rate, duration)
    3. Computes severity and sends the incident webhook to NestJS

    Detection results are stored on `camera.last_detections` so the MJPEG
    renderer can draw bounding-box overlays without re-running YOLO.
    """
    frame = camera.get_frame()
    if frame is None:
        return

    result = detector.detect(frame, frame_number=camera.frame_count)

    if result.detected and result.detections:
        confirmed = camera.validator.update(camera.camera_id, True)
        with camera.detection_lock:
            camera.last_detections = result.detections

        if confirmed:
            fire_area  = sum(d.area_percentage for d in result.detections if d.detection_type.value == "fire")
            smoke_area = sum(d.area_percentage for d in result.detections if d.detection_type.value == "smoke")

            # ── Immediate real-time alert (sync, no async issues) ──
            det_type = "fire" if fire_area > 0 else "smoke"
            max_conf = max((d.confidence for d in result.detections), default=0)
            _broadcast_fire_alert(
                camera_id=camera.camera_id,
                camera_name=camera.camera_name,
                detection_type=det_type,
                confidence=max_conf,
                severity="critical" if max_conf > 0.8 else "high",
            )

            snapshot = temporal_tracker.update(
                camera_id=camera.camera_id,
                fire_area_pct=fire_area,
                smoke_area_pct=smoke_area,
                timeout_seconds=15,
            )

            sev = compute_severity(
                detections=result.detections,
                growth_rate=snapshot.growth_rate_per_second,
                duration_seconds=snapshot.duration_seconds,
                camera_count=1,
            )

            should_create = not snapshot.incident_reported and snapshot.consecutive_count >= camera.MIN_INCIDENT_CONSECUTIVE
            should_update = snapshot.incident_reported and snapshot.reported_incident_id is not None and snapshot.reported_incident_id != "__pending__"

            if should_create or should_update:
                existing_id = snapshot.reported_incident_id if should_update else None

                # Capture variables for the async closure
                _camera_id = camera.camera_id
                _camera_name = camera.camera_name
                _camera_location = camera.camera_location
                _latitude = camera.latitude
                _longitude = camera.longitude
                _snapshot = snapshot
                _sev = sev

                async def send_and_update():
                    resp = await post_incident_to_backend(
                        camera_id=_camera_id,
                        snapshot=_snapshot,
                        severity_result=_sev,
                        camera_name=_camera_name,
                        camera_location=_camera_location,
                        latitude=_latitude,
                        longitude=_longitude,
                        existing_incident_id=existing_id,
                    )
                    if resp.success and resp.incident_id:
                        temporal_tracker.mark_reported(_camera_id, resp.incident_id)

                fire_and_forget(send_and_update())
                if should_create:
                    temporal_tracker.mark_reported(camera.camera_id, "__pending__")
    else:
        camera.validator.update(camera.camera_id, False)
        temporal_tracker.clear(camera.camera_id, timeout_seconds=15)
        with camera.detection_lock:
            camera.last_detections = []


# ─── MJPEG Generator (rendering only — no detection) ─────────────────

def _mjpeg_generator(camera: CameraSource, run_detection: bool, frame_interval: float) -> Generator[bytes, None, None]:
    """
    Yield MJPEG frames for browser streaming.
    Detection is handled by the background thread; this generator only
    reads `camera.last_detections` to draw overlays on the video feed.
    """
    while camera.is_active:
        frame = camera.get_frame()
        if frame is None:
            time.sleep(0.05)
            continue

        # Read detection results produced by the background detection thread
        if run_detection:
            with camera.detection_lock:
                detections = list(camera.last_detections)

            if detections:
                display_frame = _draw_detections_on_frame(frame, detections, camera.frame_count)
            else:
                display_frame = frame.copy()
                status_text = f"LIVE | Frame {camera.frame_count}"
                cv2.putText(display_frame, status_text, (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        else:
            display_frame = frame.copy()

        if camera.error:
            cv2.putText(display_frame, "RECONNECTING...", (10, 84), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2)

        _, jpeg = cv2.imencode(".jpg", display_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        frame_bytes = jpeg.tobytes()

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + frame_bytes
            + b"\r\n"
        )
        time.sleep(frame_interval)


# ─── Request/Response Models ──────────────────────────────────────

class ConnectRequest(BaseModel):
    camera_id: str
    url: str
    camera_name:     Optional[str]   = None
    camera_location: Optional[str]   = None
    latitude:        Optional[float]  = None
    longitude:       Optional[float]  = None

class ConnectResponse(BaseModel):
    success: bool
    message: str
    stream_url: Optional[str] = None

# ─── Endpoints ────────────────────────────────────────────────────

@router.post("/connect", response_model=ConnectResponse)
async def connect_camera(
    request: ConnectRequest,
    api_key: str = Header(None, alias="X-API-Key"),
):
    if api_key != settings.service_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    url = request.url.strip()
    # Only treat as integer device index if it's a single digit (local webcam)
    cam_input = int(url) if url.isdigit() and len(url) <= 2 else url

    loop = asyncio.get_event_loop()
    success = await loop.run_in_executor(
        None,
        lambda: _manager.start_camera(
            request.camera_id,
            cam_input,
            camera_name=request.camera_name,
            camera_location=request.camera_location,
            latitude=request.latitude,
            longitude=request.longitude,
        ),
    )

    if success:
        return ConnectResponse(
            success=True,
            message=f"Connected to camera {request.camera_id}",
            stream_url=f"/stream/mjpeg/{request.camera_id}",
        )
    else:
        return ConnectResponse(
            success=False,
            message=f"Failed to connect to camera {request.camera_id}",
        )


@router.post("/disconnect/{camera_id}")
async def disconnect_camera(
    camera_id: str = Path(...),
    api_key: str = Header(None, alias="X-API-Key"),
):
    if api_key != settings.service_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    _manager.stop_camera(camera_id)
    return {"success": True, "message": f"Camera {camera_id} disconnected"}


@router.get("/status")
async def stream_status():
    return _manager.get_all_status()


@router.get("/mjpeg/{camera_id}")
async def mjpeg_stream(
    camera_id: str = Path(...),
    detect: bool = Query(True, description="Enable fire/smoke detection overlays"),
    fps: float = Query(10.0, description="Target stream frame rate (max 30)"),
):
    camera = _manager.get_camera(camera_id)
    if not camera or not camera.is_active:
        raise HTTPException(
            status_code=503,
            detail=f"Camera {camera_id} is not active.",
        )

    fps = min(max(fps, 1.0), 30.0)
    frame_interval = 1.0 / fps

    return StreamingResponse(
        _mjpeg_generator(camera, run_detection=detect, frame_interval=frame_interval),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
