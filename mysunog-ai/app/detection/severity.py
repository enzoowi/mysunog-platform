"""
Multi-Factor Fire Severity Assessment Engine for mySunog.

This module replaces the original single-frame rule-based classifier with a
proper multi-factor scoring engine that produces:

1. A numeric severity score from 0 to 100.
2. A human-readable list of reasons explaining the score.
3. A SeverityLevel enum (LOW / MODERATE / HIGH / CRITICAL).

Design Rationale
----------------
The original `classify_severity()` only looked at a single frame.
For a thesis-level system, severity must account for:

  - How large is the fire right now?           (fire area %)
  - How large is the smoke cloud?              (smoke area %)
  - How confident is the AI?                   (max confidence)
  - Is the fire growing or shrinking?          (growth rate from TemporalTracker)
  - How long has it been burning?              (duration_seconds)
  - Are multiple cameras seeing it?            (camera_count)

Each factor contributes a capped number of points to a 100-point total.
The scoring formula is transparent and configurable — NOT a black box.

Interpretability Requirement
-----------------------------
Every call to `compute_severity()` returns a `reasons` list alongside the
score, e.g.:
    ["Large visible flame region (18.3% of frame)",
     "Fire area grew at +2.4% per sample — INCREASING",
     "Dense smoke detected (12.1% of frame)",
     "Sustained detection for 47 seconds",
     "Detection confirmed by 2 CCTV cameras"]

This list is stored in AiIncident.severityReasons and displayed in the
BFP Command Dashboard to justify the AI recommendation.
"""

from dataclasses import dataclass
from app.models.schemas import BoundingBox, SeverityLevel
from app.config import settings


# ─── Scoring Weights (max points each factor can contribute) ─────────────────

MAX_FIRE_AREA_PTS    = 30   # fire bounding-box area coverage
MAX_SMOKE_AREA_PTS   = 15   # smoke bounding-box area coverage
MAX_CONFIDENCE_PTS   = 20   # YOLO detection confidence
MAX_GROWTH_PTS       = 20   # fire area growth rate
MAX_DURATION_PTS     = 10   # how long the event has been ongoing
MAX_MULTICAM_PTS     = 5    # bonus for multi-camera confirmation


# ─── Severity Thresholds (configurable) ──────────────────────────────────────

def _get_thresholds() -> dict[str, tuple[int, int]]:
    """
    Return severity thresholds from config (or defaults).
    Using a function keeps tests easy to patch.
    """
    return {
        SeverityLevel.LOW:      (0,  getattr(settings, "severity_low_max",      30)),
        SeverityLevel.MEDIUM:   (31, getattr(settings, "severity_moderate_max",  60)),
        SeverityLevel.HIGH:     (61, getattr(settings, "severity_high_max",      80)),
        SeverityLevel.CRITICAL: (81, 100),
    }


# ─── Result Container ────────────────────────────────────────────────────────

@dataclass
class SeverityResult:
    """Full result from the severity assessment."""
    score:          int            # 0–100
    level:          SeverityLevel  # LOW / MEDIUM / HIGH / CRITICAL
    reasons:        list[str]      # human-readable explanations
    fire_area_pct:  float          # total fire area contributed
    smoke_area_pct: float          # total smoke area contributed
    max_confidence: float


# ─── Main Scoring Function ───────────────────────────────────────────────────

def compute_severity(
    detections: list[BoundingBox],
    growth_rate: float = 0.0,
    duration_seconds: float = 0.0,
    camera_count: int = 1,
) -> SeverityResult:
    """
    Compute a multi-factor severity score (0–100) for an AI detection event.

    Parameters
    ----------
    detections       : Bounding boxes returned by YOLOv8 for this frame.
    growth_rate      : Slope from TemporalTracker (% area change per sample).
                       Positive = growing, negative = shrinking.
    duration_seconds : Seconds since the first detection for this camera.
    camera_count     : Number of cameras that have detected this event.

    Returns
    -------
    SeverityResult containing score, level, and reasons list.
    """
    reasons: list[str] = []
    score: float = 0.0

    # ── Separate fire and smoke detections ───────────────────────────────────
    fire_dets  = [d for d in detections if d.detection_type.value == "fire"]
    smoke_dets = [d for d in detections if d.detection_type.value == "smoke"]

    fire_area_pct  = sum(d.area_percentage for d in fire_dets)
    smoke_area_pct = sum(d.area_percentage for d in smoke_dets)
    max_conf       = max((d.confidence for d in detections), default=0.0)

    # ── Factor 1: Fire area (max 30 pts) ─────────────────────────────────────
    # Scale: 15% coverage → max points (≈ 2 pts per %)
    fire_pts = min(fire_area_pct * 2.0, float(MAX_FIRE_AREA_PTS))
    score += fire_pts

    if fire_area_pct > 15:
        reasons.append(
            f"Large visible flame region ({fire_area_pct:.1f}% of frame)"
        )
    elif fire_area_pct > 8:
        reasons.append(
            f"Moderate flame region ({fire_area_pct:.1f}% of frame)"
        )
    elif fire_area_pct > 2:
        reasons.append(
            f"Small flame detected ({fire_area_pct:.1f}% of frame)"
        )

    # ── Factor 2: Smoke area (max 15 pts) ────────────────────────────────────
    # Scale: 10% coverage → max points (1.5 pts per %)
    smoke_pts = min(smoke_area_pct * 1.5, float(MAX_SMOKE_AREA_PTS))
    score += smoke_pts

    if smoke_area_pct > 10:
        reasons.append(
            f"Dense smoke detected ({smoke_area_pct:.1f}% of frame)"
        )
    elif smoke_area_pct > 4:
        reasons.append(
            f"Moderate smoke detected ({smoke_area_pct:.1f}% of frame)"
        )
    elif smoke_area_pct > 1:
        reasons.append(
            f"Light smoke detected ({smoke_area_pct:.1f}% of frame)"
        )

    # ── Factor 3: Detection confidence (max 20 pts) ──────────────────────────
    conf_pts = max_conf * float(MAX_CONFIDENCE_PTS)
    score += conf_pts

    if max_conf >= 0.85:
        reasons.append(
            f"Very high AI detection confidence ({max_conf * 100:.0f}%)"
        )
    elif max_conf >= 0.70:
        reasons.append(
            f"High AI detection confidence ({max_conf * 100:.0f}%)"
        )

    # ── Factor 4: Fire growth rate (max 20 pts) ───────────────────────────────
    # growth_rate > 0 means fire is growing.
    # Scale: rate of +4.0 %/sample → max points.
    if growth_rate > 0:
        growth_pts = min(growth_rate * 5.0, float(MAX_GROWTH_PTS))
        score += growth_pts
        reasons.append(
            f"Fire area growing at +{growth_rate:.2f}% per sample (INCREASING)"
        )
    elif growth_rate < -0.5:
        # Slightly reduce score for decreasing fire
        score = max(0.0, score - 5.0)
        reasons.append("Fire area appears to be DECREASING")

    # ── Factor 5: Detection duration (max 10 pts) ─────────────────────────────
    # 60 seconds of continuous detection → max points
    duration_pts = min(duration_seconds / 6.0, float(MAX_DURATION_PTS))
    score += duration_pts

    if duration_seconds >= 60:
        reasons.append(
            f"Sustained fire/smoke detection for {duration_seconds:.0f} seconds"
        )
    elif duration_seconds >= 30:
        reasons.append(
            f"Persistent detection for {duration_seconds:.0f} seconds"
        )

    # ── Factor 6: Multi-camera confirmation (flat 5 pts bonus) ───────────────
    if camera_count > 1:
        score += float(MAX_MULTICAM_PTS)
        reasons.append(
            f"Detection confirmed by {camera_count} CCTV cameras"
        )

    # ── Combined fire + smoke (bonus reason, no extra pts) ───────────────────
    if fire_area_pct > 0 and smoke_area_pct > 0:
        reasons.append("Both fire and smoke detected simultaneously")

    # ── Clamp and round ───────────────────────────────────────────────────────
    final_score = min(round(score), 100)

    # ── Classify level ────────────────────────────────────────────────────────
    level = _level_from_score(final_score)

    # Fallback: if there are no reasons, add a minimal one
    if not reasons:
        reasons.append(
            f"AI detection confidence {max_conf * 100:.0f}% — monitoring"
        )

    return SeverityResult(
        score=final_score,
        level=level,
        reasons=reasons,
        fire_area_pct=round(fire_area_pct, 2),
        smoke_area_pct=round(smoke_area_pct, 2),
        max_confidence=round(max_conf, 4),
    )


def _level_from_score(score: int) -> SeverityLevel:
    """Map a 0–100 score to a SeverityLevel."""
    thresholds = _get_thresholds()
    if score >= thresholds[SeverityLevel.CRITICAL][0]:
        return SeverityLevel.CRITICAL
    if score >= thresholds[SeverityLevel.HIGH][0]:
        return SeverityLevel.HIGH
    if score >= thresholds[SeverityLevel.MEDIUM][0]:
        return SeverityLevel.MEDIUM
    return SeverityLevel.LOW


# ─── Legacy Compatibility ────────────────────────────────────────────────────
# The original `classify_severity(detections)` is preserved so that existing
# code in detector.py that calls it does not break.  It now delegates to the
# new engine with default temporal arguments.

def classify_severity(detections: list[BoundingBox]) -> SeverityLevel:
    """
    Backward-compatible single-frame severity classifier.
    Used by detector.py for quick per-frame labels.
    For the full multi-factor score, call compute_severity() instead.
    """
    result = compute_severity(detections)
    return result.level
