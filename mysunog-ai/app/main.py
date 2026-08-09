"""
mySunog AI Detection Service — FastAPI Application Entry Point.

This microservice handles fire and smoke detection using YOLOv8.
It is called exclusively by the NestJS backend (never by the frontend directly).
"""

import os
# FIX: Prevent random FFmpeg pthread_frame.c assertions when reading RTSP streams
os.environ["OPENCV_FFMPEG_THREADS"] = "1"
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

from app.config import settings
from app.detection.detector import detector
from app.routes import detect, health, risk_scoring, stream, video_stream


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the YOLOv8 model at startup, clean up on shutdown."""
    print("=" * 50)
    print("mySunog AI Detection Service Starting...")
    print("=" * 50)

    # Load YOLOv8 model
    detector.load_model()

    if detector.model_loaded:
        print("[OK] Model loaded successfully")
    else:
        print("[WARNING] Running in DEMO MODE — no model loaded")
        print(f"[WARNING] Place a YOLOv8 model at: {settings.model_path}")

    print(f"[INFO] Confidence threshold: {settings.confidence_threshold}")
    print(f"[INFO] Frame skip: {settings.frame_skip}")
    print(f"[INFO] Consecutive frames required: {settings.consecutive_frames_required}")
    print("=" * 50)

    yield

    # Cleanup on shutdown
    print("AI Detection Service shutting down...")
    # Stop all active camera streams
    from app.routes.stream import _manager
    for cam in list(_manager.cameras.values()):
        cam.stop()
    detector.close()


# Create the FastAPI application
app = FastAPI(
    title="mySunog AI Detection Service",
    description="Fire and smoke detection using YOLOv8 for the mySunog system",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow browser requests to /stream/mjpeg directly from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(health.router, tags=["Health"])
app.include_router(detect.router, tags=["Detection"])
app.include_router(risk_scoring.router, tags=["Risk Prediction"])
app.include_router(stream.router, tags=["Camera Stream"])
app.include_router(video_stream.router, tags=["Video Upload"])


@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": "mySunog AI Detection Service",
        "version": "1.0.0",
        "model_loaded": detector.model_loaded,
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.ai_service_host,
        port=settings.ai_service_port,
        reload=True,
    )
