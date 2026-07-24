"""
YOLOv8 inference engine for fire and smoke detection.
Loads the local YOLO model (best.pt) once at startup and provides a
detect() method for frames.
"""

import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

from app.config import settings
from app.models.schemas import BoundingBox, DetectionType, DetectionResult, SeverityLevel
from app.detection.severity import classify_severity


class FireSmokeDetector:
    """
    Handles fire and smoke detection using a local YOLOv8 model (best.pt).
    The model is loaded once at startup for fast per-frame inference.
    """

    def __init__(self):
        self.model_path = settings.model_path
        self.confidence_threshold = settings.confidence_threshold
        self.model = None
        self.model_loaded = False

    def load_model(self):
        """Load the YOLO model from disk."""
        model_file = Path(self.model_path)
        if not model_file.exists():
            print(f"[ERROR] Model file not found: {model_file.resolve()}")
            return

        try:
            self.model = YOLO(str(model_file))
            self.model_loaded = True
            print(f"[OK] Loaded local YOLO model: {model_file}")
            print(f"[OK] Confidence threshold: {self.confidence_threshold}")
        except Exception as e:
            print(f"[ERROR] Failed to load YOLO model: {e}")
            self.model_loaded = False

    def detect(self, frame: np.ndarray, frame_number: int = 0) -> DetectionResult:
        """
        Run YOLOv8 inference on a single frame.

        Args:
            frame: OpenCV BGR image (numpy array)
            frame_number: Current frame number for tracking

        Returns:
            DetectionResult with bounding boxes, confidence, severity, etc.
        """
        if not self.model_loaded or self.model is None:
            print("[WARN] Model not loaded, skipping detection")
            return DetectionResult(frame_number=frame_number)

        try:
            # 1. Resize frame for faster inference (max 1280px on longest side)
            h, w = frame.shape[:2]
            max_dim = 1280
            if max(h, w) > max_dim:
                scale = max_dim / max(h, w)
                frame = cv2.resize(frame, (int(w * scale), int(h * scale)))

            # 2. Run YOLO inference locally
            results = self.model(frame, conf=self.confidence_threshold, verbose=False)

            frame_h, frame_w = frame.shape[:2]
            frame_area = frame_h * frame_w

            detections: list[BoundingBox] = []

            for result in results:
                boxes = result.boxes
                if boxes is None or len(boxes) == 0:
                    continue

                for box in boxes:
                    # Extract coordinates (x1, y1, x2, y2)
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    confidence = float(box.conf[0])
                    class_id = int(box.cls[0])
                    class_name = self.model.names.get(class_id, "unknown").lower()

                    # Map class name to our DetectionType enum
                    if "fire" in class_name or "flame" in class_name:
                        det_type = DetectionType.FIRE
                    elif "smoke" in class_name:
                        det_type = DetectionType.SMOKE
                    else:
                        # Default to fire for unknown classes from a fire/smoke model
                        det_type = DetectionType.FIRE

                    # Calculate area percentage
                    box_area = (x2 - x1) * (y2 - y1)
                    area_pct = (box_area / frame_area) * 100

                    detections.append(BoundingBox(
                        x1=x1, y1=y1, x2=x2, y2=y2,
                        confidence=confidence,
                        detection_type=det_type,
                        area_percentage=round(area_pct, 2),
                    ))

            if detections:
                print(f"[DETECT] Frame {frame_number}: {len(detections)} detection(s)")
                for d in detections:
                    print(f"  - {d.detection_type.value}: conf={d.confidence:.3f}, area={d.area_percentage:.1f}%")

            # 3. Build result
            detected = len(detections) > 0
            max_conf = max((d.confidence for d in detections), default=0.0)
            det_types = list(set(d.detection_type for d in detections))
            severity = classify_severity(detections)

            return DetectionResult(
                detected=detected,
                detections=detections,
                max_confidence=round(max_conf, 4),
                detection_types=det_types,
                severity=severity,
                frame_number=frame_number,
            )

        except Exception as e:
            print(f"[ERROR] Local detection failed: {e}")
            return DetectionResult(frame_number=frame_number)

    def close(self):
        """Clean up resources."""
        self.model = None
        self.model_loaded = False


# Singleton instance
detector = FireSmokeDetector()
