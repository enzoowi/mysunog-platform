"""
Incident Webhook Service for mySunog AI Detection Service.

Responsible for POSTing incident payloads to the NestJS backend at
POST /ai/incident/create.

Design Decisions
----------------
- Async: Uses httpx.AsyncClient so the webhook call does not block the
  main inference loop. A failed POST logs a warning but does not crash
  the AI service — resilience is more important than strict delivery.
- Retry: Simple exponential back-off with 2 retries (3 total attempts)
  handles transient network hiccups without hanging the video loop.
- Fire-and-update: The first confirmed detection creates a new incident.
  Subsequent updates (growing severity, changing priority) call the same
  endpoint with the existing_incident_id field set, letting NestJS patch
  the record instead of creating a duplicate.
"""

import asyncio
import httpx
import time
from datetime import datetime, timezone
from typing import Optional
import logging
import cv2
import base64
import numpy as np

from app.config import settings
from app.models.incident_schemas import (
    IncidentPayload,
    IncidentWebhookResponse,
    SeverityReport,
    TemporalData,
)
from app.detection.temporal_tracker import TemporalSnapshot, FireGrowthStatus
from app.detection.severity import SeverityResult
from app.detection.priority_engine import IncidentPriority, classify_priority

logger = logging.getLogger(__name__)

# Webhook endpoint on NestJS backend
_WEBHOOK_PATH = "/ai/incidents/create"

# Retry configuration
_MAX_RETRIES   = 2
_RETRY_DELAYS  = [1.0, 2.0]  # seconds between retry attempts


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _epoch_to_iso(epoch: float) -> str:
    """Convert a Unix timestamp (float) to an ISO 8601 string."""
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()


def _determine_detection_type(fire_area: float, smoke_area: float) -> str:
    """Derive FIRE / SMOKE / FIRE_AND_SMOKE from area values."""
    has_fire  = fire_area  > 0
    has_smoke = smoke_area > 0
    if has_fire and has_smoke:
        return "FIRE_AND_SMOKE"
    if has_fire:
        return "FIRE"
    if has_smoke:
        return "SMOKE"
    return "FIRE"  # fallback (shouldn't reach here if called correctly)


def _build_payload(
    camera_id: str,
    snapshot: TemporalSnapshot,
    severity_result: SeverityResult,
    camera_name: Optional[str] = None,
    camera_location: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    existing_incident_id: Optional[str] = None,
    frame_base64: Optional[str] = None,
) -> IncidentPayload:
    """
    Assemble all data into a single IncidentPayload ready to POST.
    """
    priority = classify_priority(
        severity_score=severity_result.score,
        growth_status=snapshot.growth_status,
        confidence=severity_result.max_confidence,
        duration_seconds=snapshot.duration_seconds,
        camera_count=1,  # single-camera path; multi-cam handled separately
    )

    temporal = TemporalData(
        first_detection_time=_epoch_to_iso(snapshot.first_detection_time),
        last_detection_time=_epoch_to_iso(snapshot.last_detection_time),
        duration_seconds=round(snapshot.duration_seconds, 1),
        consecutive_count=snapshot.consecutive_count,
        fire_area_history=snapshot.fire_area_history,
        smoke_area_history=snapshot.smoke_area_history,
        current_fire_area=snapshot.current_fire_area,
        current_smoke_area=snapshot.current_smoke_area,
        growth_status=snapshot.growth_status,
        growth_rate_per_sample=snapshot.growth_rate_per_second,
    )

    severity = SeverityReport(
        score=severity_result.score,
        level=severity_result.level.value if hasattr(severity_result.level, "value") else str(severity_result.level),
        reasons=severity_result.reasons,
        fire_area_pct=severity_result.fire_area_pct,
        smoke_area_pct=severity_result.smoke_area_pct,
        max_confidence=severity_result.max_confidence,
    )

    return IncidentPayload(
        camera_id=camera_id,
        camera_name=camera_name,
        camera_location=camera_location,
        latitude=latitude,
        longitude=longitude,
        detection_type=_determine_detection_type(
            snapshot.current_fire_area,
            snapshot.current_smoke_area,
        ),
        max_confidence=severity_result.max_confidence,
        temporal=temporal,
        severity=severity,
        priority=priority,
        existing_incident_id=existing_incident_id,
        frame_base64=frame_base64,
    )


# ─── Webhook Caller ───────────────────────────────────────────────────────────

async def post_incident_to_backend(
    camera_id: str,
    snapshot: TemporalSnapshot,
    severity_result: SeverityResult,
    camera_name: Optional[str] = None,
    camera_location: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    existing_incident_id: Optional[str] = None,
    frame: Optional[np.ndarray] = None,
) -> IncidentWebhookResponse:
    """
    Asynchronously POST an incident payload to the NestJS backend.
    """
    """
    frame_b64 = None
    if frame is not None:
        try:
            # Resize frame to max 640px dimension to save bandwidth
            h, w = frame.shape[:2]
            max_dim = 640
            if max(h, w) > max_dim:
                scale = max_dim / max(h, w)
                resized = cv2.resize(frame, (int(w * scale), int(h * scale)))
            else:
                resized = frame
            
            # Encode to JPEG
            _, buffer = cv2.imencode('.jpg', resized, [cv2.IMWRITE_JPEG_QUALITY, 70])
            frame_b64 = base64.b64encode(buffer).decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to encode frame to base64: {e}")

    payload = _build_payload(
        camera_id=camera_id,
        snapshot=snapshot,
        severity_result=severity_result,
        camera_name=camera_name,
        camera_location=camera_location,
        latitude=latitude,
        longitude=longitude,
        existing_incident_id=existing_incident_id,
        frame_base64=frame_b64,
    )

    url     = f"{settings.nestjs_backend_url}{_WEBHOOK_PATH}"
    headers = {
        "X-API-Key":   settings.service_api_key,
        "Content-Type": "application/json",
    }

    log_tag = f"[Incident Webhook] camera={camera_id}"
    logger.info(f"{log_tag} → POST {url} (priority={payload.priority}, severity={payload.severity.score})")

    last_error: str = "Unknown error"

    for attempt in range(_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.post(
                    url,
                    content=payload.model_dump_json(),
                    headers=headers,
                )

            if response.status_code in (200, 201):
                data = response.json()
                logger.info(
                    f"{log_tag} ✓ incident_id={data.get('incident_id')} "
                    f"is_new={data.get('is_new')}"
                )
                return IncidentWebhookResponse(**data)

            # Non-2xx — log and maybe retry
            last_error = f"HTTP {response.status_code}: {response.text[:200]}"
            logger.warning(f"{log_tag} attempt {attempt + 1} failed — {last_error}")

        except httpx.TimeoutException:
            last_error = "Request timed out"
            logger.warning(f"{log_tag} attempt {attempt + 1} timed out")
        except httpx.ConnectError:
            last_error = "NestJS backend unreachable"
            logger.warning(f"{log_tag} attempt {attempt + 1} — backend unreachable")
        except Exception as exc:
            last_error = str(exc)
            logger.error(f"{log_tag} attempt {attempt + 1} unexpected error: {exc}")

        # Wait before retry (skip delay on last attempt)
        if attempt < _MAX_RETRIES:
            await asyncio.sleep(_RETRY_DELAYS[attempt])

    logger.error(f"{log_tag} ✗ All {_MAX_RETRIES + 1} attempts failed. Last error: {last_error}")
    return IncidentWebhookResponse(
        success=False,
        error=last_error,
    )


def fire_and_forget(coro):
    """
    Schedule a coroutine to run in the background without awaiting it.
    Works correctly whether called from the main async thread OR from a
    background reader thread (e.g. the MJPEG frame loop).

    Strategy:
    1. If the main event loop is running (FastAPI's uvicorn loop), use
       run_coroutine_threadsafe — this is the correct cross-thread call.
    2. If we are on the main thread and the loop is not running, use
       run_until_complete (startup edge case).
    3. Last resort: asyncio.run() creates a brand-new loop in the
       current thread for truly isolated contexts.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Called from a background thread while the main loop runs.
            # run_coroutine_threadsafe schedules it on the correct loop.
            asyncio.run_coroutine_threadsafe(coro, loop)
        else:
            loop.run_until_complete(coro)
    except RuntimeError:
        # Python 3.10+: get_event_loop() raises in non-main threads
        # with no current loop. Fall back to asyncio.run() which creates
        # a temporary loop just for this coroutine.
        try:
            asyncio.run(coro)
        except Exception as e:
            logger.error(f"[fire_and_forget] Failed to schedule webhook: {e}")
