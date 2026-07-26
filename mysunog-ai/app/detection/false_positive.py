"""
False positive reduction via consecutive frame validation with spatial tracking.

Only confirms a detection if fire/smoke appears in N consecutive frames
AND the detections are in approximately the same location (IoU overlap).

This dual validation eliminates false positives from:
- Momentary lighting changes (single-frame noise)
- Red/orange objects passing through the frame (different location each frame)
- Camera glitches or noise
- Car headlights or moving lights (shift position across frames)
"""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from app.config import settings


def compute_iou(box_a: tuple, box_b: tuple) -> float:
    """
    Compute Intersection over Union (IoU) between two bounding boxes.

    Each box is (x1, y1, x2, y2).
    Returns a value between 0.0 (no overlap) and 1.0 (perfect overlap).
    """
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    # Intersection coordinates
    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)

    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0  # No intersection

    intersection = (ix2 - ix1) * (iy2 - iy1)
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    union = area_a + area_b - intersection

    if union <= 0:
        return 0.0

    return intersection / union


class ConsecutiveFrameValidator:
    """
    Tracks detection history per camera/source and only confirms
    a detection when fire/smoke is found in N consecutive frames
    with spatial consistency (bounding boxes overlap across frames).

    This dramatically reduces false positives from:
    - Momentary lighting changes
    - Red/orange objects briefly passing through frame
    - Camera glitches or noise
    - Moving lights (headlights, reflections) that change position
    """

    def __init__(self, required_consecutive: int = 3, timeout_seconds: int = 10):
        """
        Args:
            required_consecutive: Number of consecutive frames with detection
                                  needed to confirm a real fire/smoke event.
            timeout_seconds: If no detection for this many seconds, reset counter.
        """
        self.required_consecutive = required_consecutive
        self.timeout_seconds = timeout_seconds
        self.iou_threshold = settings.spatial_iou_threshold

        # Track per source: { source_id: { "count": int, "last_seen": datetime, ... } }
        self._tracking: dict[str, dict] = defaultdict(
            lambda: {
                "count": 0,
                "last_seen": None,
                "confirmed": False,
                "prev_boxes": [],  # List of (x1, y1, x2, y2) from previous frame
            }
        )

    def update(
        self,
        source_id: str,
        detected: bool,
        boxes: Optional[list[tuple]] = None,
    ) -> bool:
        """
        Update the tracker with a new frame result.

        Args:
            source_id: Camera or source identifier (e.g., "webcam", "camera-1")
            detected: Whether fire/smoke was detected in this frame
            boxes: List of (x1, y1, x2, y2) bounding box tuples for this frame.
                   Used for spatial IoU validation. If None, spatial check is skipped.

        Returns:
            True if the detection is now CONFIRMED (met consecutive threshold)
        """
        track = self._tracking[source_id]
        now = datetime.now()

        if not detected:
            # No detection — reset counter
            track["count"] = 0
            track["confirmed"] = False
            track["prev_boxes"] = []
            return False

        # Check if too much time passed since last detection (timeout)
        if track["last_seen"] and \
           (now - track["last_seen"]) > timedelta(seconds=self.timeout_seconds):
            track["count"] = 0
            track["confirmed"] = False
            track["prev_boxes"] = []

        # ── Spatial IoU Check ──────────────────────────────────────────────
        # If we have previous boxes AND current boxes, verify spatial overlap.
        # A detection only counts as "consecutive" if at least one current box
        # overlaps with at least one previous box (same fire, same location).
        spatial_match = True  # Default: pass if no spatial data available

        if boxes and track["prev_boxes"] and self.iou_threshold > 0:
            spatial_match = False
            for curr_box in boxes:
                for prev_box in track["prev_boxes"]:
                    iou = compute_iou(curr_box, prev_box)
                    if iou >= self.iou_threshold:
                        spatial_match = True
                        break
                if spatial_match:
                    break

            if not spatial_match:
                # Detection is in a DIFFERENT location from previous frame.
                # Reset the counter — this is likely a different object / false positive.
                print(
                    f"[SPATIAL-REJECT] {source_id}: Detection location changed "
                    f"(no IoU >= {self.iou_threshold}), resetting consecutive count"
                )
                track["count"] = 1  # Start fresh from this frame
                track["confirmed"] = False
                track["last_seen"] = now
                track["prev_boxes"] = list(boxes) if boxes else []
                return False

        # Increment consecutive counter
        track["count"] += 1
        track["last_seen"] = now
        track["prev_boxes"] = list(boxes) if boxes else []

        # Check if threshold is met
        if track["count"] >= self.required_consecutive:
            if not track["confirmed"]:
                track["confirmed"] = True
                return True  # First confirmation
            # Already confirmed — still return True for ongoing tracking
            return True

        return False

    def reset(self, source_id: str):
        """Reset tracking for a specific source."""
        if source_id in self._tracking:
            self._tracking[source_id] = {
                "count": 0,
                "last_seen": None,
                "confirmed": False,
                "prev_boxes": [],
            }

    def get_status(self, source_id: str) -> dict:
        """Get current tracking status for a source."""
        track = self._tracking.get(source_id, {
            "count": 0, "last_seen": None, "confirmed": False, "prev_boxes": []
        })
        return {
            "consecutive_count": track["count"],
            "required": self.required_consecutive,
            "confirmed": track["confirmed"],
        }
