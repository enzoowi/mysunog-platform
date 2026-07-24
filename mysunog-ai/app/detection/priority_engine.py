"""
Response Priority Classification Engine for mySunog.

Takes the output of the SeverityEngine and TemporalTracker and determines
the urgency level of a BFP response.

Priority Levels
---------------
LOW      🟢 — Possible smoke or small fire. Stable detection. Monitor only.
MODERATE 🟠 — Persistent detection. BFP officer should verify on dashboard.
HIGH     🔴 — Probable fire with growing activity. Respond promptly.
CRITICAL 🚨 — Rapidly spreading fire, large area, or multi-camera confirmation.
              Treat as real fire until proven otherwise.

Design Decision
---------------
Priority is intentionally separated from Severity. Severity is a snapshot of
how bad the fire looks RIGHT NOW. Priority factors in dynamics:
- A small fire that is INCREASING fast → HIGH priority even with moderate severity.
- A large fire that is DECREASING → may be HIGH severity but MODERATE priority.

This separation gives BFP officers better situational awareness.
The priority does NOT trigger automatic dispatch. It is advisory only.
"""

from app.detection.temporal_tracker import FireGrowthStatus


# ─── Priority Constants ───────────────────────────────────────────────────────

class IncidentPriority:
    LOW      = "LOW"
    MODERATE = "MODERATE"
    HIGH     = "HIGH"
    CRITICAL = "CRITICAL"


# ─── Priority Classification ─────────────────────────────────────────────────

def classify_priority(
    severity_score: int,
    growth_status: str,
    confidence: float,
    duration_seconds: float,
    camera_count: int,
) -> str:
    """
    Classify the response priority level for an AI-detected incident.

    Parameters
    ----------
    severity_score   : 0–100 score from SeverityEngine.
    growth_status    : FireGrowthStatus constant from TemporalTracker.
    confidence       : Max YOLO detection confidence (0.0–1.0).
    duration_seconds : Seconds the detection has been active.
    camera_count     : Number of cameras that detected this event.

    Returns
    -------
    str — one of IncidentPriority constants.

    Logic is strictly hierarchical: highest priority wins.
    """

    # ── CRITICAL ─────────────────────────────────────────────────────────────
    # Any single condition below triggers CRITICAL.

    if severity_score >= 81:
        # Severity engine already rates this very high
        return IncidentPriority.CRITICAL

    if growth_status == FireGrowthStatus.SPREADING:
        # Fire is jumping rapidly — most dangerous scenario
        return IncidentPriority.CRITICAL

    if camera_count >= 3:
        # Three or more cameras simultaneously detecting — major incident
        return IncidentPriority.CRITICAL

    if growth_status == FireGrowthStatus.INCREASING and severity_score >= 61:
        # High severity + actively growing
        return IncidentPriority.CRITICAL

    # ── HIGH ─────────────────────────────────────────────────────────────────

    if severity_score >= 61:
        return IncidentPriority.HIGH

    if growth_status == FireGrowthStatus.INCREASING and confidence >= 0.70:
        # Growing fire with high confidence — even if area is still small
        return IncidentPriority.HIGH

    if camera_count >= 2 and severity_score >= 40:
        # Two cameras + moderate severity
        return IncidentPriority.HIGH

    if duration_seconds >= 120 and severity_score >= 31:
        # Burning for 2+ minutes at moderate severity
        return IncidentPriority.HIGH

    # ── MODERATE ─────────────────────────────────────────────────────────────

    if severity_score >= 31:
        return IncidentPriority.MODERATE

    if duration_seconds >= 30:
        # Persistent detection even at low severity — needs human review
        return IncidentPriority.MODERATE

    if confidence >= 0.65 and severity_score >= 20:
        # High-confidence detection that is still smallish
        return IncidentPriority.MODERATE

    if camera_count >= 2:
        # Two cameras seeing something — worth a look even at low severity
        return IncidentPriority.MODERATE

    # ── LOW ──────────────────────────────────────────────────────────────────

    return IncidentPriority.LOW


# ─── Priority Metadata ────────────────────────────────────────────────────────

PRIORITY_META: dict[str, dict] = {
    IncidentPriority.LOW: {
        "emoji":       "🟢",
        "label":       "LOW PRIORITY",
        "description": "Possible smoke or small stable fire. Monitor only.",
        "color_hex":   "#22c55e",
    },
    IncidentPriority.MODERATE: {
        "emoji":       "🟠",
        "label":       "MODERATE PRIORITY",
        "description": "Persistent fire or smoke. BFP officer should verify.",
        "color_hex":   "#f97316",
    },
    IncidentPriority.HIGH: {
        "emoji":       "🔴",
        "label":       "HIGH PRIORITY",
        "description": "Probable fire with increasing activity. Respond promptly.",
        "color_hex":   "#ef4444",
    },
    IncidentPriority.CRITICAL: {
        "emoji":       "🚨",
        "label":       "CRITICAL PRIORITY",
        "description": "Rapidly spreading or large fire. Treat as real until verified.",
        "color_hex":   "#7f1d1d",
    },
}
