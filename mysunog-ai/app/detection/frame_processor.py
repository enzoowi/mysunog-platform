"""
OpenCV-based frame processing for video files and base64 image frames.
Handles decoding, resizing, and iterating through video frames.
"""

import cv2
import base64
import numpy as np
from typing import Generator, Optional

from app.config import settings
from app.detection.detector import detector
from app.detection.false_positive import ConsecutiveFrameValidator
from app.models.schemas import DetectionResult


def decode_base64_frame(image_base64: str) -> Optional[np.ndarray]:
    """
    Decode a base64-encoded image string into an OpenCV BGR frame.

    Args:
        image_base64: Base64 string (with or without data URI prefix)

    Returns:
        OpenCV BGR numpy array, or None if decoding fails
    """
    try:
        # Strip data URI prefix if present (e.g., "data:image/jpeg;base64,")
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]

        image_bytes = base64.b64decode(image_base64)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return frame
    except Exception as e:
        print(f"[ERROR] Failed to decode base64 image: {e}")
        return None


def analyze_single_frame(
    frame: np.ndarray,
    source_id: str = "webcam",
    validator: Optional[ConsecutiveFrameValidator] = None,
    frame_number: int = 0,
) -> DetectionResult:
    """
    Analyze a single frame for fire/smoke.

    Args:
        frame: OpenCV BGR image
        source_id: Camera/source identifier
        validator: Optional consecutive frame validator for false positive reduction
        frame_number: Current frame number

    Returns:
        DetectionResult with detection info
    """
    # Run detection
    result = detector.detect(frame, frame_number=frame_number)

    # Apply false positive validation if validator is provided
    if validator and result.detected:
        is_confirmed = validator.update(source_id, True)
        if not is_confirmed:
            return result
    elif validator:
        validator.update(source_id, False)

    return result


def process_video_file(
    video_path: str,
    source_id: str = "upload",
) -> Generator[DetectionResult, None, None]:
    """
    Process a video file frame-by-frame, yielding detection results.

    Uses adaptive frame skipping based on video FPS to sample approximately
    1 frame per second, and caps total API calls at MAX_API_CALLS to stay
    well within the 5-minute timeout window.

    Args:
        video_path: Path to the video file
        source_id: Source identifier for tracking

    Yields:
        DetectionResult for each analyzed frame (only those with detections)
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open video: {video_path}")
        return

    validator = ConsecutiveFrameValidator(
        required_consecutive=2,     # Lower threshold for video (frames are spaced further apart)
        timeout_seconds=60,         # Longer timeout for video files
    )

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30

    # ── Adaptive frame skipping ──────────────────────────────────
    # Sample ~1 frame per second to keep API calls manageable.
    # For a 30fps video, this means skipping 29 out of every 30 frames.
    video_frame_skip = max(int(fps), settings.frame_skip)

    # Cap total API calls to avoid exceeding the 5-minute timeout.
    # Each API call takes ~1-3 seconds, so 60 calls ≈ 60-180 seconds.
    MAX_API_CALLS = 60
    estimated_calls = total_frames // video_frame_skip
    if estimated_calls > MAX_API_CALLS:
        video_frame_skip = max(video_frame_skip, total_frames // MAX_API_CALLS)

    duration_secs = total_frames / fps if fps > 0 else 0
    print(f"[INFO] Processing video: {total_frames} frames, {fps:.0f} FPS, {duration_secs:.1f}s duration")
    print(f"[INFO] Frame skip: every {video_frame_skip} frames (~{total_frames // max(video_frame_skip, 1)} API calls)")

    frame_count = 0
    api_calls = 0

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1

            # Frame skipping for performance
            if frame_count % video_frame_skip != 0:
                continue

            # Safety cap on total API calls
            api_calls += 1
            if api_calls > MAX_API_CALLS:
                print(f"[INFO] Reached max API calls ({MAX_API_CALLS}), stopping early.")
                break

            # Run detection on this frame
            result = analyze_single_frame(
                frame=frame,
                source_id=source_id,
                validator=validator,
                frame_number=frame_count,
            )

            # Only yield frames where fire/smoke was detected
            if result.detected:
                yield result

    finally:
        cap.release()
        print(f"[INFO] Video processing complete: {frame_count} frames read, {api_calls} API calls made")
