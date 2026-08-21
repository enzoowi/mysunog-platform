"""
Configuration settings for the AI Detection service.
Loaded from environment variables via pydantic-settings.
"""

from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings loaded from .env file."""

    # Server
    ai_service_port: int = 8000
    ai_service_host: str = "0.0.0.0"

    # NestJS backend URL for webhook callbacks
    nestjs_backend_url: str = "http://localhost:3000"

    # Service-to-service API key
    service_api_key: str = "mysunog-ai-secret-key-2024"

    # YOLOv8 model
    model_path: str = "models/best.pt"
    roboflow_api_key: str = "35aOIa2L6ELLV85wjxMu"
    roboflow_model_id: str = "fire-vqbia/1"
    confidence_threshold: float = 0.10  # Base YOLO inference threshold
    fire_confidence_threshold: float = 0.10   # Per-class: fire detections below this are rejected
    smoke_confidence_threshold: float = 0.10  # Per-class: smoke detections below this are rejected
    min_detection_area_pct: float = 0.05      # Reject bounding boxes smaller than this % of frame
    color_validation_enabled: bool = False    # Disabled: new best.pt model is reliable enough
    spatial_iou_threshold: float = 0.05       # IoU threshold for spatial consistency tracking
    frame_skip: int = 3
    consecutive_frames_required: int = 2  # 2 consecutive frames for video processing

    # Minimum confirmed detections before sending incident to NestJS
    min_incident_consecutive: int = 3

    # Severity score thresholds (0-100 scale)
    # These bracket the LOW/MODERATE/HIGH/CRITICAL levels.
    severity_low_max:      int = 30
    severity_moderate_max: int = 60
    severity_high_max:     int = 80
    # CRITICAL is implicitly everything above severity_high_max

    # OpenWeatherMap API (free tier — 1000 calls/day)
    openweathermap_api_key: str = ""

    # Weather cache TTL in seconds (default: 10 minutes)
    weather_cache_ttl_seconds: int = 600

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Singleton instance
settings = Settings()

# Ensure directories exist
Path("models").mkdir(parents=True, exist_ok=True)
