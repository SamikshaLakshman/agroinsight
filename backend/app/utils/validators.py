"""
AgroInsight - Input Validation Utilities
===========================================
Lightweight validators used across routes. Kept dependency-free (no
marshmallow/pydantic) to keep the skeleton simple; can be swapped for a
schema library later without changing route logic significantly.
"""

import re

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def is_valid_email(email: str) -> bool:
    return bool(email) and bool(EMAIL_REGEX.match(email.strip()))


def is_valid_password(password: str) -> tuple[bool, str]:
    """Returns (is_valid, error_message)."""
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
        return False, "Password must contain both letters and numbers."
    return True, ""


def validate_soil_inputs(data: dict) -> tuple[bool, str]:
    """Validates N, P, K, ph are present and within plausible agronomic ranges."""
    required = ["nitrogen", "phosphorus", "potassium", "ph"]
    for field in required:
        if field not in data or data[field] is None:
            return False, f"Missing required field: {field}"
        try:
            float(data[field])
        except (TypeError, ValueError):
            return False, f"Field '{field}' must be a number."

    ph = float(data["ph"])
    if not (0 <= ph <= 14):
        return False, "pH must be between 0 and 14."

    for field in ["nitrogen", "phosphorus", "potassium"]:
        val = float(data[field])
        if val < 0 or val > 300:
            return False, f"Field '{field}' must be between 0 and 300."

    return True, ""


def validate_allocations(allocations: list, tolerance: float = 0.01) -> tuple[bool, str]:
    """Ensures land allocation percentages sum to 100 (within rounding tolerance)."""
    if not allocations:
        return False, "Allocations cannot be empty."

    total = sum(float(a.get("percentage", 0)) for a in allocations)
    if abs(total - 100.0) > tolerance:
        return False, f"Allocation percentages must sum to 100 (got {total})."

    return True, ""
