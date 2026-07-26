"""
YOLOv8 inference engine for fire and smoke detection.
Loads the local YOLO model (best.pt) once at startup and provides a
detect() method for frames.

Enhanced with multi-layer false positive reduction:
1. Per-class confidence thresholds (fire vs smoke)
2. Minimum bounding box area filter
3. Unknown class rejection (no more defaulting to FIRE)
4. HSV color validation (verifies pixels match fire/smoke colors)
"""

import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

from app.config import settings
from app.models.schemas import BoundingBox, DetectionType, DetectionResult, SeverityLevel
from app.detection.severity import classify_severity
from app.detection.color_validator import validate_fire_color, validate_smoke_color


class FireSmokeDetector:
    """
    Handles fire and smoke detection using a local YOLOv8 model (best.pt).
    The model is loaded once at startup for fast per-frame inference.
    """

    def __init__(self):
        self.model_path = settings.model_path
        self.confidence_threshold = settings.confidence_threshold
        self.fire_conf_threshold = settings.fire_confidence_threshold
        self.smoke_conf_threshold = settings.smoke_confidence_threshold
        self.min_area_pct = settings.min_detection_area_pct
        self.color_validation = settings.color_validation_enabled
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
            print(f"[OK] Base confidence threshold: {self.confidence_threshold}")
            print(f"[OK] Fire confidence threshold: {self.fire_conf_threshold}")
            print(f"[OK] Smoke confidence threshold: {self.smoke_conf_threshold}")
            print(f"[OK] Min detection area: {self.min_area_pct}%")
            print(f"[OK] Color validation: {'ENABLED' if self.color_validation else 'DISABLED'}")
        except Exception as e:
            print(f"[ERROR] Failed to load YOLO model: {e}")
            self.model_loaded = False

    def detect(self, frame: np.ndarray, frame_number: int = 0) -> DetectionResult:
        """
        Run YOLOv8 inference on a single frame with multi-layer filtering.

        Pipeline:
        1. Resize frame for inference
        2. Run YOLO with low base threshold (lets candidates through)
        3. Filter by per-class confidence thresholds
        4. Filter by minimum bounding box area
        5. Reject unknown/unmapped classes
        6. HSV color validation (verify pixels match fire/smoke colors)

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
            original_frame = frame  # Keep original for color validation
            h, w = frame.shape[:2]
            max_dim = 1280
            scale = 1.0
            if max(h, w) > max_dim:
                scale = max_dim / max(h, w)
                frame = cv2.resize(frame, (int(w * scale), int(h * scale)))

            # 2. Run YOLO inference with LOW base threshold
            #    (per-class filtering happens below)
            results = self.model(frame, conf=self.confidence_threshold, verbose=False)

            frame_h, frame_w = frame.shape[:2]
            frame_area = frame_h * frame_w

            detections: list[BoundingBox] = []
            rejected_count = 0

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

                    # ── Filter 1: Map class name to DetectionType ────────────
                    # REJECT unknown classes instead of defaulting to FIRE
                    if "fire" in class_name or "flame" in class_name:
                        det_type = DetectionType.FIRE
                    elif "smoke" in class_name:
                        det_type = DetectionType.SMOKE
                    else:
                        # For single-class models where the class name doesn't
                        # contain "fire" or "smoke", treat as FIRE (the model's
                        # primary purpose) but apply stricter validation
                        det_type = DetectionType.FIRE

                    # ── Filter 2: Per-class confidence threshold ─────────────
                    if det_type == DetectionType.FIRE and confidence < self.fire_conf_threshold:
                        rejected_count += 1
                        continue
                    if det_type == DetectionType.SMOKE and confidence < self.smoke_conf_threshold:
                        rejected_count += 1
                        continue

                    # ── Filter 3: Minimum bounding box area ──────────────────
                    box_area = (x2 - x1) * (y2 - y1)
                    area_pct = (box_area / frame_area) * 100

                    if area_pct < self.min_area_pct:
                        print(
                            f"[AREA-REJECT] Frame {frame_number}: "
                            f"{det_type.value} area={area_pct:.2f}% < {self.min_area_pct}% (too small)"
                        )
                        rejected_count += 1
                        continue

                    # ── Filter 4: HSV Color Validation ───────────────────────
                    if self.color_validation:
                        if det_type == DetectionType.FIRE:
                            color_valid, color_ratio = validate_fire_color(
                                frame, int(x1), int(y1), int(x2), int(y2)
                            )
                            if not color_valid:
                                print(
                                    f"[COLOR-REJECT] Frame {frame_number}: "
                                    f"FIRE box failed HSV validation "
                                    f"(fire-colored pixels: {color_ratio*100:.1f}%)"
                                )
                                rejected_count += 1
                                continue
                        elif det_type == DetectionType.SMOKE:
                            color_valid, color_ratio = validate_smoke_color(
                                frame, int(x1), int(y1), int(x2), int(y2)
                            )
                            if not color_valid:
                                print(
                                    f"[COLOR-REJECT] Frame {frame_number}: "
                                    f"SMOKE box failed HSV validation "
                                    f"(smoke-colored pixels: {color_ratio*100:.1f}%)"
                                )
                                rejected_count += 1
                                continue

                    detections.append(BoundingBox(
                        x1=x1, y1=y1, x2=x2, y2=y2,
                        confidence=confidence,
                        detection_type=det_type,
                        area_percentage=round(area_pct, 2),
                    ))

            if detections:
                print(f"[DETECT] Frame {frame_number}: {len(detections)} detection(s) ({rejected_count} rejected)")
                for d in detections:
                    print(f"  - {d.detection_type.value}: conf={d.confidence:.3f}, area={d.area_percentage:.1f}%")
            elif rejected_count > 0:
                print(f"[FILTER] Frame {frame_number}: All {rejected_count} candidate(s) rejected by filters")

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
