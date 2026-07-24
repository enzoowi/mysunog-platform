"""
Pydantic schemas for AI Incident payloads sent from the AI service to the
NestJS backend webhook (POST /ai/incident/create).

These schemas define the contract between mysunog-ai and mysunog-backend.
Both sides must agree on this structure.

Separation of concerns:
- schemas.py      → per-frame detection results (existing)
- incident_schemas.py → compound incident payloads (new, thesis feature)
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TemporalData(BaseModel):
    """
    Temporal analysis data captured by TemporalTracker.
    Describes how the fire/smoke event evolved over time.
    """
    first_detection_time: str = Field(
        description="ISO 8601 timestamp of first detection"
    )
    last_detection_time: str = Field(
        description="ISO 8601 timestamp of most recent detection"
    )
    duration_seconds: float = Field(
        description="Total seconds the event has been continuously detected"
    )
    consecutive_count: int = Field(
        description="Number of consecutive frames with confirmed detection"
    )
    fire_area_history: list[float] = Field(
        default_factory=list,
        description="Chronological fire area % per analyzed frame",
    )
    smoke_area_history: list[float] = Field(
        default_factory=list,
        description="Chronological smoke area % per analyzed frame",
    )
    current_fire_area: float = Field(
        description="Most recent fire area % reading"
    )
    current_smoke_area: float = Field(
        description="Most recent smoke area % reading"
    )
    growth_status: str = Field(
        description="STABLE | INCREASING | DECREASING | SPREADING | UNKNOWN"
    )
    growth_rate_per_sample: float = Field(
        description="Linear regression slope of fire area history (% per frame)"
    )


class SeverityReport(BaseModel):
    """
    Output from the multi-factor SeverityEngine.
    """
    score: int = Field(ge=0, le=100, description="0–100 severity score")
    level: str = Field(description="LOW | MODERATE | HIGH | CRITICAL")
    reasons: list[str] = Field(
        description="Human-readable factors contributing to this score"
    )
    fire_area_pct:  float
    smoke_area_pct: float
    max_confidence: float


class IncidentPayload(BaseModel):
    """
    The complete payload POSTed from the AI service to the NestJS webhook
    at POST /ai/incident/create.

    This is the primary data contract between the two services.
    NestJS will parse this and create an AiIncident record in PostgreSQL.
    """

    # ── Camera / Source ────────────────────────────────────────────────────
    camera_id: str = Field(
        description="Camera identifier string (e.g. 'webcam', 'cam-01', 'rtsp-main')"
    )
    camera_name: Optional[str] = Field(
        default=None,
        description="Human-readable camera name"
    )
    camera_location: Optional[str] = Field(
        default=None,
        description="Physical location description of the camera"
    )
    latitude:  Optional[float] = None
    longitude: Optional[float] = None

    # ── Detection Summary ─────────────────────────────────────────────────
    detection_type: str = Field(
        description="FIRE | SMOKE | FIRE_AND_SMOKE"
    )
    max_confidence: float = Field(
        ge=0.0, le=1.0,
        description="Highest confidence score from YOLO in this frame"
    )

    # ── Temporal Analysis ─────────────────────────────────────────────────
    temporal: TemporalData

    # ── Severity Assessment ───────────────────────────────────────────────
    severity: SeverityReport

    # ── Priority ──────────────────────────────────────────────────────────
    priority: str = Field(
        description="LOW | MODERATE | HIGH | CRITICAL"
    )

    # ── Incident Update Flag ──────────────────────────────────────────────
    existing_incident_id: Optional[str] = Field(
        default=None,
        description="If set, this is an update to an existing incident rather "
                    "than a new one. NestJS should update the existing record."
    )

    # ── Metadata ──────────────────────────────────────────────────────────
    payload_version: str = "2.0"
    generated_at: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat() + "Z"
    )


class IncidentWebhookResponse(BaseModel):
    """
    Response from NestJS after receiving an IncidentPayload.
    The AI service uses the returned incident_id to correlate
    future updates.
    """
    success: bool
    incident_id: Optional[str] = None
    is_new: Optional[bool] = None   # True = newly created, False = updated
    message: Optional[str] = None
    error: Optional[str] = None
