"""
HSV Color Validation for Fire and Smoke Detections.

After YOLO produces a bounding box labeled as "fire" or "smoke", this module
crops the detected region and verifies that the pixels actually contain
fire-like or smoke-like colors using OpenCV HSV color masks.

This catches common false positives such as:
- White/blue LED streetlights detected as "fire"
- Green vegetation or blue sky incorrectly flagged
- Reflective surfaces and lens flare
- Red clothing or objects that aren't actually burning

Design
------
Fire pixels are defined as having hues in the red/orange/yellow range:
  - Red:    H ∈ [0, 15]  with high saturation and value
  - Orange: H ∈ [15, 30] with high saturation and value
  - Deep red (wrap-around): H ∈ [170, 180]

Smoke pixels are defined as having low saturation (grayish) with
moderate-to-high value (not pitch black):
  - S ∈ [0, 60], V ∈ [80, 255]

A detection passes validation if ≥ MIN_FIRE_RATIO or MIN_SMOKE_RATIO of
the bounding box pixels match the expected color profile.
"""

import cv2
import numpy as np

# ─── Fire Color Thresholds (HSV) ─────────────────────────────────────────────

# Red-orange-yellow range (low hue end)
FIRE_H_LOW_MIN, FIRE_H_LOW_MAX = 0, 35
FIRE_S_MIN = 50       # Must have some saturation (not gray/white)
FIRE_V_MIN = 100      # Must be reasonably bright

# Deep red (hue wraps around 180 in OpenCV)
FIRE_H_HIGH_MIN, FIRE_H_HIGH_MAX = 165, 180

# Minimum fraction of pixels in the bounding box that must match fire colors
MIN_FIRE_COLOR_RATIO = 0.12  # 12% of pixels must be fire-colored

# ─── Smoke Color Thresholds (HSV) ────────────────────────────────────────────

SMOKE_S_MAX = 60      # Smoke is low-saturation (grayish)
SMOKE_V_MIN = 80      # Not pitch black
SMOKE_V_MAX = 240     # Not pure white (overexposure)

# Minimum fraction of pixels in the bounding box that must match smoke colors
MIN_SMOKE_COLOR_RATIO = 0.20  # 20% of pixels must be smoke-colored


def validate_fire_color(frame: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> tuple[bool, float]:
    """
    Check if a YOLO "fire" bounding box contains enough fire-colored pixels.

    Args:
        frame: Full BGR frame from OpenCV
        x1, y1, x2, y2: Bounding box coordinates (pixel values)

    Returns:
        (is_valid, ratio) — whether the detection passes color validation,
        and the fraction of fire-colored pixels found.
    """
    # Crop the region of interest
    h, w = frame.shape[:2]
    x1, y1 = max(0, int(x1)), max(0, int(y1))
    x2, y2 = min(w, int(x2)), min(h, int(y2))

    if x2 <= x1 or y2 <= y1:
        return False, 0.0

    roi = frame[y1:y2, x1:x2]
    if roi.size == 0:
        return False, 0.0

    # Convert to HSV
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    # Mask 1: Red-orange-yellow (H: 0-35, S: 50+, V: 100+)
    mask_low = cv2.inRange(
        hsv,
        np.array([FIRE_H_LOW_MIN, FIRE_S_MIN, FIRE_V_MIN]),
        np.array([FIRE_H_LOW_MAX, 255, 255]),
    )

    # Mask 2: Deep red wrap-around (H: 165-180, S: 50+, V: 100+)
    mask_high = cv2.inRange(
        hsv,
        np.array([FIRE_H_HIGH_MIN, FIRE_S_MIN, FIRE_V_MIN]),
        np.array([FIRE_H_HIGH_MAX, 255, 255]),
    )

    # Combine masks
    fire_mask = cv2.bitwise_or(mask_low, mask_high)

    # Calculate ratio of fire-colored pixels
    total_pixels = roi.shape[0] * roi.shape[1]
    fire_pixels = cv2.countNonZero(fire_mask)
    ratio = fire_pixels / total_pixels if total_pixels > 0 else 0.0

    return ratio >= MIN_FIRE_COLOR_RATIO, round(ratio, 4)


def validate_smoke_color(frame: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> tuple[bool, float]:
    """
    Check if a YOLO "smoke" bounding box contains enough smoke-colored pixels.

    Smoke appears as gray/white with low saturation.

    Args:
        frame: Full BGR frame from OpenCV
        x1, y1, x2, y2: Bounding box coordinates (pixel values)

    Returns:
        (is_valid, ratio) — whether the detection passes color validation,
        and the fraction of smoke-colored pixels found.
    """
    # Crop the region of interest
    h, w = frame.shape[:2]
    x1, y1 = max(0, int(x1)), max(0, int(y1))
    x2, y2 = min(w, int(x2)), min(h, int(y2))

    if x2 <= x1 or y2 <= y1:
        return False, 0.0

    roi = frame[y1:y2, x1:x2]
    if roi.size == 0:
        return False, 0.0

    # Convert to HSV
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    # Smoke mask: any hue, low saturation, moderate brightness
    mask = cv2.inRange(
        hsv,
        np.array([0, 0, SMOKE_V_MIN]),
        np.array([180, SMOKE_S_MAX, SMOKE_V_MAX]),
    )

    # Calculate ratio of smoke-colored pixels
    total_pixels = roi.shape[0] * roi.shape[1]
    smoke_pixels = cv2.countNonZero(mask)
    ratio = smoke_pixels / total_pixels if total_pixels > 0 else 0.0

    return ratio >= MIN_SMOKE_COLOR_RATIO, round(ratio, 4)
