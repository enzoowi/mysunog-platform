"""
Temporal Incident Tracker for mySunog AI Detection Service.

Tracks fire and smoke area percentages across multiple frames on a per-camera
basis and computes the growth trend of the detected event.

Design Decisions
----------------
- In-memory only: Tracking state lives in a Python dict, not the database.
  This avoids DB overhead during the hot path of per-frame inference (~50–200ms).
  When an incident threshold is met, the accumulated data is flushed to NestJS.
- Thread-safe: Uses threading.Lock() per camera so the MJPEG read thread and
  the API endpoint handler can both update the same tracker safely.
- Automatic expiry: If a camera produces no detections for `timeout_seconds`,
  its tracking window is automatically reset to avoid stale state.
- Configurable window: The number of area samples used for trend analysis is
  configurable via settings.temporal_window_size.

Growth Status Definitions
--------------------------
STABLE     — Area fluctuates within ±STABLE_THRESHOLD % over the window.
INCREASING — Sustained upward trend (linear regression slope > threshold).
DECREASING — Sustained downward trend (slope < -threshold).
SPREADING  — Area jumped by SPREAD_JUMP % in a single frame (fast spread).
UNKNOWN    — Not enough data points yet (fewer than MIN_POINTS_FOR_TREND).
"""

import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Optional


# ─── Constants (can be overridden via config in the future) ──────────────────

# Minimum number of area samples before we attempt trend classification.
MIN_POINTS_FOR_TREND = 3

# Area increase in a single frame that is classified as SPREADING (%).
SPREAD_JUMP_THRESHOLD = 8.0

# Linear regression slope threshold below which the trend is STABLE.
# Units: percent per sample.
STABLE_SLOPE_THRESHOLD = 0.5

# Maximum number of area samples kept per camera (rolling window).
DEFAULT_WINDOW_SIZE = 20

# If no detection arrives within this many seconds, the tracker auto-resets.
DEFAULT_TIMEOUT_SECONDS = 30


# ─── Enums (string-based for JSON serialisability) ───────────────────────────

class FireGrowthStatus:
    STABLE     = "STABLE"
    INCREASING = "INCREASING"
    DECREASING = "DECREASING"
    SPREADING  = "SPREADING"
    UNKNOWN    = "UNKNOWN"


# ─── Data Structures ─────────────────────────────────────────────────────────

@dataclass
class TrackingWindow:
    """Per-camera tracking state."""

    # Rolling deque of (timestamp, fire_area_pct, smoke_area_pct) tuples.
    fire_area_history:  deque = field(default_factory=lambda: deque(maxlen=DEFAULT_WINDOW_SIZE))
    smoke_area_history: deque = field(default_factory=lambda: deque(maxlen=DEFAULT_WINDOW_SIZE))

    # Absolute timestamps
    first_detection_time: Optional[float] = None  # epoch seconds
    last_detection_time:  Optional[float] = None  # epoch seconds

    # Consecutive confirmed-detection counter (passed through ConsecutiveValidator)
    consecutive_count: int = 0

    # Cumulative frame counter for this camera (since last reset)
    total_frames_analyzed: int = 0

    # Lock for thread-safe access
    lock: threading.Lock = field(default_factory=threading.Lock)

    # Whether an incident has already been reported to NestJS for this window.
    # Prevents duplicate incident creation on every subsequent frame.
    incident_reported: bool = False

    # The UUID of the incident reported to NestJS (so we can send updates).
    reported_incident_id: Optional[str] = None


@dataclass
class TemporalSnapshot:
    """
    Immutable snapshot of a camera's temporal state at a given moment.
    This is what gets included in the incident payload sent to NestJS.
    """
    camera_id:           str
    first_detection_time: float          # epoch seconds
    last_detection_time:  float          # epoch seconds
    duration_seconds:     float
    consecutive_count:    int
    fire_area_history:    list[float]    # last N fire area % values
    smoke_area_history:   list[float]    # last N smoke area % values
    current_fire_area:    float          # most recent fire area %
    current_smoke_area:   float          # most recent smoke area %
    growth_status:        str            # FireGrowthStatus constant
    growth_rate_per_second: float        # positive = growing, negative = shrinking
    incident_reported:    bool
    reported_incident_id: Optional[str]


# ─── Core Tracker ────────────────────────────────────────────────────────────

class TemporalTracker:
    """
    Singleton that manages per-camera temporal tracking windows.

    Usage
    -----
    After ConsecutiveFrameValidator confirms a detection, call:

        snapshot = temporal_tracker.update(
            camera_id="cam-01",
            fire_area_pct=12.5,
            smoke_area_pct=3.0,
            timeout_seconds=30,
        )

    If no detection in a frame, call:

        temporal_tracker.clear(camera_id="cam-01")

    To mark that an incident has been reported:

        temporal_tracker.mark_reported(camera_id="cam-01", incident_id="uuid")
    """

    def __init__(self):
        # camera_id → TrackingWindow
        self._windows: dict[str, TrackingWindow] = {}
        self._global_lock = threading.Lock()

    def _get_or_create_window(self, camera_id: str) -> TrackingWindow:
        """Get or lazily create a TrackingWindow for this camera."""
        with self._global_lock:
            if camera_id not in self._windows:
                self._windows[camera_id] = TrackingWindow()
            return self._windows[camera_id]

    # ── Public API ────────────────────────────────────────────────

    def update(
        self,
        camera_id: str,
        fire_area_pct: float,
        smoke_area_pct: float = 0.0,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> TemporalSnapshot:
        """
        Record a new detection sample for this camera and return a snapshot
        of the current temporal state.

        Parameters
        ----------
        camera_id       : Unique camera identifier (e.g. "webcam", "cam-01")
        fire_area_pct   : Percentage of the frame area covered by fire detections
        smoke_area_pct  : Percentage of the frame area covered by smoke detections
        timeout_seconds : Seconds of inactivity before the window auto-resets

        Returns
        -------
        TemporalSnapshot — current state of this camera's tracking window
        """
        window = self._get_or_create_window(camera_id)
        now = time.time()

        with window.lock:
            # Auto-reset if too much time has passed since the last detection
            if (
                window.last_detection_time is not None
                and (now - window.last_detection_time) > timeout_seconds
            ):
                self._reset_window_internal(window)

            # Record first detection time
            if window.first_detection_time is None:
                window.first_detection_time = now

            window.last_detection_time = now
            window.consecutive_count += 1
            window.total_frames_analyzed += 1

            window.fire_area_history.append(fire_area_pct)
            window.smoke_area_history.append(smoke_area_pct)

            snapshot = self._build_snapshot(camera_id, window, now)

        return snapshot

    def clear(self, camera_id: str, timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS):
        """
        Called when a frame has NO detection. If the camera has been quiet
        for timeout_seconds, reset its window.
        """
        if camera_id not in self._windows:
            return

        window = self._windows[camera_id]
        now = time.time()

        with window.lock:
            if (
                window.last_detection_time is not None
                and (now - window.last_detection_time) > timeout_seconds
            ):
                self._reset_window_internal(window)

    def mark_reported(self, camera_id: str, incident_id: str):
        """
        Mark that an incident has been reported to NestJS for this camera.
        This prevents duplicate incident creation on subsequent frames.
        """
        if camera_id not in self._windows:
            return

        window = self._windows[camera_id]
        with window.lock:
            window.incident_reported = True
            window.reported_incident_id = incident_id

    def mark_unresolved(self, camera_id: str):
        """
        Clear the reported flag — call this when an incident is resolved
        so that a new incident can be created if fire re-appears.
        """
        if camera_id not in self._windows:
            return

        window = self._windows[camera_id]
        with window.lock:
            window.incident_reported = False
            window.reported_incident_id = None

    def reset(self, camera_id: str):
        """Fully reset a camera's tracking window."""
        if camera_id not in self._windows:
            return

        window = self._windows[camera_id]
        with window.lock:
            self._reset_window_internal(window)

    def get_snapshot(self, camera_id: str) -> Optional[TemporalSnapshot]:
        """Get the current snapshot for a camera without updating it."""
        if camera_id not in self._windows:
            return None

        window = self._windows[camera_id]
        now = time.time()
        with window.lock:
            return self._build_snapshot(camera_id, window, now)

    def all_camera_ids(self) -> list[str]:
        """Return all camera IDs being tracked."""
        with self._global_lock:
            return list(self._windows.keys())

    # ── Internal Helpers ──────────────────────────────────────────

    @staticmethod
    def _reset_window_internal(window: TrackingWindow):
        """Reset a window (must be called with window.lock held)."""
        window.fire_area_history.clear()
        window.smoke_area_history.clear()
        window.first_detection_time = None
        window.last_detection_time = None
        window.consecutive_count = 0
        window.total_frames_analyzed = 0
        window.incident_reported = False
        window.reported_incident_id = None

    @staticmethod
    def _build_snapshot(
        camera_id: str,
        window: TrackingWindow,
        now: float,
    ) -> TemporalSnapshot:
        """
        Construct a TemporalSnapshot from the current window state.
        Must be called with window.lock held.
        """
        fire_history  = list(window.fire_area_history)
        smoke_history = list(window.smoke_area_history)

        current_fire  = fire_history[-1]  if fire_history  else 0.0
        current_smoke = smoke_history[-1] if smoke_history else 0.0

        first_time = window.first_detection_time or now
        last_time  = window.last_detection_time  or now
        duration   = last_time - first_time

        growth_status, growth_rate = TemporalTracker._classify_growth(fire_history)

        return TemporalSnapshot(
            camera_id=camera_id,
            first_detection_time=first_time,
            last_detection_time=last_time,
            duration_seconds=duration,
            consecutive_count=window.consecutive_count,
            fire_area_history=fire_history,
            smoke_area_history=smoke_history,
            current_fire_area=current_fire,
            current_smoke_area=current_smoke,
            growth_status=growth_status,
            growth_rate_per_second=growth_rate,
            incident_reported=window.incident_reported,
            reported_incident_id=window.reported_incident_id,
        )

    @staticmethod
    def _classify_growth(area_history: list[float]) -> tuple[str, float]:
        """
        Classify the fire growth trend from the area percentage history.

        Returns
        -------
        (growth_status, growth_rate_per_second)
            growth_status  — one of FireGrowthStatus constants
            growth_rate_per_second — slope of the trend line (% per sample)
        """
        n = len(area_history)

        if n < MIN_POINTS_FOR_TREND:
            return FireGrowthStatus.UNKNOWN, 0.0

        # Check for a single large jump (SPREADING)
        if n >= 2:
            last_jump = area_history[-1] - area_history[-2]
            if last_jump >= SPREAD_JUMP_THRESHOLD:
                slope = TemporalTracker._linear_slope(area_history)
                return FireGrowthStatus.SPREADING, round(slope, 4)

        # Linear regression slope over the window
        slope = TemporalTracker._linear_slope(area_history)

        if slope > STABLE_SLOPE_THRESHOLD:
            return FireGrowthStatus.INCREASING, round(slope, 4)
        elif slope < -STABLE_SLOPE_THRESHOLD:
            return FireGrowthStatus.DECREASING, round(slope, 4)
        else:
            return FireGrowthStatus.STABLE, round(slope, 4)

    @staticmethod
    def _linear_slope(values: list[float]) -> float:
        """
        Compute the slope (m) of the least-squares line y = mx + b.
        Uses the closed-form formula for simplicity — no numpy needed here.
        """
        n = len(values)
        if n < 2:
            return 0.0

        x_sum  = sum(range(n))
        y_sum  = sum(values)
        xy_sum = sum(i * v for i, v in enumerate(values))
        xx_sum = sum(i * i for i in range(n))

        denom = n * xx_sum - x_sum * x_sum
        if denom == 0:
            return 0.0

        return (n * xy_sum - x_sum * y_sum) / denom


# ─── Singleton Instance ───────────────────────────────────────────────────────

temporal_tracker = TemporalTracker()
