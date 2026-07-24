"""
Detection API endpoints.
These are called by the NestJS backend (never directly by the frontend).
"""

import os
import shutil
import tempfile
import asyncio
from fastapi import APIRouter, UploadFile, File, Header, HTTPException

from app.config import settings
from app.models.schemas import (
    FrameAnalysisRequest,
    FrameAnalysisResponse,
    VideoAnalysisResponse,
    DetectionResult,
)
from app.detection.frame_processor import (
    decode_base64_frame,
    analyze_single_frame,
    process_video_file,
)
from app.detection.false_positive import ConsecutiveFrameValidator
from app.detection.temporal_tracker import temporal_tracker
from app.detection.severity import compute_severity
from app.detection.priority_engine import classify_priority
from app.services.incident_webhook import post_incident_to_backend

router = APIRouter(prefix="/detect")

# Shared validator for webcam streams (persists across requests)
_webcam_validators: dict[str, ConsecutiveFrameValidator] = {}

# ─── Minimum consecutive confirmations before creating an incident ────────────
# The ConsecutiveFrameValidator requires N consecutive frames.
# ADDITIONALLY, we require MIN_INCIDENT_CONSECUTIVE confirmed frames before
# we first call the NestJS webhook.  This is a second layer of filtering.
MIN_INCIDENT_CONSECUTIVE = 3


def _verify_api_key(api_key: str = Header(None, alias="X-API-Key")):
    """Verify the service-to-service API key."""
    if api_key != settings.service_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")


def _get_validator(source_id: str) -> ConsecutiveFrameValidator:
    """Get or create a consecutive frame validator for a source."""
    if source_id not in _webcam_validators:
        _webcam_validators[source_id] = ConsecutiveFrameValidator(
            required_consecutive=settings.consecutive_frames_required,
            timeout_seconds=15,  # Webcam sends frames every 2s, allow gaps
        )
    return _webcam_validators[source_id]


@router.post("/frame", response_model=FrameAnalysisResponse)
async def detect_frame(
    request: FrameAnalysisRequest,
    api_key: str = Header(None, alias="X-API-Key"),
):
    """
    Analyze a single image frame for fire/smoke detection.

    Pipeline
    --------
    1. Decode base64 image.
    2. Run YOLOv8 inference.
    3. Apply ConsecutiveFrameValidator (false-positive filter).
    4. If confirmed: update TemporalTracker (growth trend).
    5. Run multi-factor SeverityEngine.
    6. Run PriorityEngine.
    7. If incident threshold met: fire-and-forget webhook to NestJS.
    8. Return result to NestJS (caller).

    Step 7 is async and does NOT delay the API response.
    """
    _verify_api_key(api_key)

    # Decode the base64 image
    frame = decode_base64_frame(request.image_base64)
    if frame is None:
        return FrameAnalysisResponse(
            success=False,
            error="Failed to decode image frame",
        )

    source_id = request.camera_id or "webcam"
    validator = _get_validator(source_id)

    # Run YOLOv8 + consecutive-frame validation
    result = analyze_single_frame(
        frame=frame,
        source_id=source_id,
        validator=validator,
    )

    # ── Temporal + Severity + Priority pipeline ────────────────────────────
    if result.detected and result.detections:
        # Compute total fire/smoke area for this frame
        fire_area  = sum(
            d.area_percentage
            for d in result.detections
            if d.detection_type.value == "fire"
        )
        smoke_area = sum(
            d.area_percentage
            for d in result.detections
            if d.detection_type.value == "smoke"
        )

        # Update temporal tracker
        snapshot = temporal_tracker.update(
            camera_id=source_id,
            fire_area_pct=fire_area,
            smoke_area_pct=smoke_area,
            timeout_seconds=15,
        )

        # Full multi-factor severity assessment
        sev = compute_severity(
            detections=result.detections,
            growth_rate=snapshot.growth_rate_per_second,
            duration_seconds=snapshot.duration_seconds,
            camera_count=1,
        )

        priority = classify_priority(
            severity_score=sev.score,
            growth_status=snapshot.growth_status,
            confidence=sev.max_confidence,
            duration_seconds=snapshot.duration_seconds,
            camera_count=1,
        )

        print(
            f"[INCIDENT] camera={source_id} | severity={sev.score} ({sev.level}) "
            f"| priority={priority} | growth={snapshot.growth_status} "
            f"| consecutive={snapshot.consecutive_count}"
        )

        # ── Decide whether to create/update an incident on NestJS ──────────
        should_create  = (
            not snapshot.incident_reported
            and snapshot.consecutive_count >= MIN_INCIDENT_CONSECUTIVE
        )
        should_update  = (
            snapshot.incident_reported
            and snapshot.reported_incident_id is not None
            # Only re-send if severity changed significantly (avoid spamming)
            and sev.score >= 40
        )

        if should_create or should_update:
            existing_id = snapshot.reported_incident_id if should_update else None
            # Fire webhook asynchronously — don't block API response
            asyncio.create_task(
                post_incident_to_backend(
                    camera_id=source_id,
                    snapshot=snapshot,
                    severity_result=sev,
                    latitude=request.latitude,
                    longitude=request.longitude,
                    existing_incident_id=existing_id,
                )
            )
            # Optimistically mark as reported (actual ID set after webhook reply)
            if should_create:
                temporal_tracker.mark_reported(source_id, "__pending__")

    else:
        # No detection — update tracker to track disappearance
        temporal_tracker.clear(source_id, timeout_seconds=15)

    return FrameAnalysisResponse(success=True, result=result)


@router.post("/video", response_model=VideoAnalysisResponse)
async def detect_video(
    file: UploadFile = File(...),
    api_key: str = Header(None, alias="X-API-Key"),
):
    """
    Analyze an uploaded video file for fire/smoke detection.

    Process:
    1. Save uploaded file to a temp location
    2. Process frame-by-frame with frame skipping
    3. Apply consecutive frame validation
    4. Return all detection events

    This is used for offline analysis of recorded footage.
    Note: Video analysis does NOT trigger the incident webhook.
    It is for reviewing historical footage only.
    """
    _verify_api_key(api_key)

    # Validate file type
    allowed_types = [
        "video/mp4", "video/avi", "video/x-msvideo",
        "video/quicktime", "video/webm", "video/x-matroska",
    ]
    if file.content_type and file.content_type not in allowed_types:
        return VideoAnalysisResponse(
            success=False,
            error=f"Unsupported video type: {file.content_type}",
        )

    # Save to temp file
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, file.filename or "upload.mp4")

    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Process the video
        detection_events: list[DetectionResult] = []
        total_frames = 0

        for result in process_video_file(temp_path, source_id="upload"):
            total_frames += 1
            if result.detected:
                detection_events.append(result)

        return VideoAnalysisResponse(
            success=True,
            total_frames_processed=total_frames,
            total_detections=len(detection_events),
            detection_events=detection_events,
        )

    except Exception as e:
        return VideoAnalysisResponse(
            success=False,
            error=f"Video processing failed: {str(e)}",
        )
    finally:
        # Clean up temp file
        try:
            os.remove(temp_path)
            os.rmdir(temp_dir)
        except OSError:
            pass


@router.post("/reset/{source_id}")
async def reset_validator(
    source_id: str,
    api_key: str = Header(None, alias="X-API-Key"),
):
    """
    Reset the consecutive frame validator AND temporal tracker for a source.
    Call this after an incident is resolved to allow a fresh detection cycle.
    """
    _verify_api_key(api_key)

    if source_id in _webcam_validators:
        _webcam_validators[source_id].reset(source_id)

    temporal_tracker.reset(source_id)

    return {"success": True, "message": f"Validator and tracker reset for {source_id}"}

