"""
Health check endpoint for the AI service.
Used by NestJS and Docker to verify the service is running.
"""

from fastapi import APIRouter
from app.models.schemas import HealthResponse
from app.detection.detector import detector

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Check if the AI service is running and the model is loaded."""
    return HealthResponse(
        status="ok",
        model_loaded=detector.model_loaded,
        version="1.0.0",
    )
