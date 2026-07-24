"""
False positive reduction via consecutive frame validation.
Only confirms a detection if fire/smoke appears in N consecutive frames.
"""

from collections import defaultdict
from datetime import datetime, timedelta


class ConsecutiveFrameValidator:
    """
    Tracks detection history per camera/source and only confirms
    a detection when fire/smoke is found in N consecutive frames.

    This dramatically reduces false positives from:
    - Momentary lighting changes
    - Red/orange objects briefly passing through frame
    - Camera glitches or noise
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

        # Track per source: { source_id: { "count": int, "last_seen": datetime } }
        self._tracking: dict[str, dict] = defaultdict(
            lambda: {"count": 0, "last_seen": None, "confirmed": False}
        )

    def update(self, source_id: str, detected: bool) -> bool:
        """
        Update the tracker with a new frame result.

        Args:
            source_id: Camera or source identifier (e.g., "webcam", "camera-1")
            detected: Whether fire/smoke was detected in this frame

        Returns:
            True if the detection is now CONFIRMED (met consecutive threshold)
        """
        track = self._tracking[source_id]
        now = datetime.now()

        if not detected:
            # No detection — reset counter
            track["count"] = 0
            track["confirmed"] = False
            return False

        # Check if too much time passed since last detection (timeout)
        if track["last_seen"] and \
           (now - track["last_seen"]) > timedelta(seconds=self.timeout_seconds):
            track["count"] = 0
            track["confirmed"] = False

        # Increment consecutive counter
        track["count"] += 1
        track["last_seen"] = now

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
            }

    def get_status(self, source_id: str) -> dict:
        """Get current tracking status for a source."""
        track = self._tracking.get(source_id, {
            "count": 0, "last_seen": None, "confirmed": False
        })
        return {
            "consecutive_count": track["count"],
            "required": self.required_consecutive,
            "confirmed": track["confirmed"],
        }
