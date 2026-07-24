"""
Pydantic schemas for request/response models used across the AI service.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class DetectionType(str, Enum):
    """Types of detections the AI can identify."""
    FIRE = "fire"
    SMOKE = "smoke"


class SeverityLevel(str, Enum):
    """Severity classification based on detection characteristics."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class BoundingBox(BaseModel):
    """A single bounding box from YOLOv8 detection."""
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    detection_type: DetectionType
    area_percentage: float = Field(
        description="Percentage of frame area covered by this detection"
    )


class DetectionResult(BaseModel):
    """Result from analyzing a single frame."""
    detected: bool = False
    detections: list[BoundingBox] = []
    max_confidence: float = 0.0
    detection_types: list[DetectionType] = []
    severity: SeverityLevel = SeverityLevel.LOW
    frame_number: int = 0
    timestamp: str = Field(
        default_factory=lambda: datetime.now().isoformat()
    )


class FrameAnalysisRequest(BaseModel):
    """Request body for single frame analysis."""
    image_base64: str = Field(description="Base64-encoded image frame")
    camera_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class FrameAnalysisResponse(BaseModel):
    """Response from single frame analysis."""
    success: bool
    result: Optional[DetectionResult] = None
    error: Optional[str] = None


class VideoAnalysisResponse(BaseModel):
    """Response from video file analysis."""
    success: bool
    total_frames_processed: int = 0
    total_detections: int = 0
    detection_events: list[DetectionResult] = []
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    model_loaded: bool = False
    version: str = "1.0.0"
