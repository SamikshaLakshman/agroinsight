"""
AgroInsight - User Profile Routes
====================================
Endpoints:
    GET    /api/profile
    PUT    /api/profile
    PUT    /api/profile/password
    DELETE /api/profile
    GET    /api/profile/validate-city?city=...  (validates against OpenWeather)
"""

import requests as http_requests
from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models.user import User
from app.utils.validators import is_valid_password

profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")


def _validate_city_openweather(city: str) -> dict | None:
    """Check if a city resolves via OpenWeather Geocoding API.
    Returns {"city": resolved_name, "state": state, "country": country} or None."""
    api_key = current_app.config.get("OPENWEATHER_API_KEY")
    if not api_key or api_key == "your_openweathermap_api_key_here":
        return None  # can't validate without key, allow any city

    try:
        response = http_requests.get(
            "https://api.openweathermap.org/geo/1.0/direct",
            params={"q": city, "limit": 5, "appid": api_key},
            timeout=8,
        )
        response.raise_for_status()
        results = response.json()
        if not results:
            return None
        # Return the top match
        top = results[0]
        return {
            "city": top.get("name", city),
            "state": top.get("state", ""),
            "country": top.get("country", ""),
        }
    except Exception:
        return None  # network error — don't block the save


@profile_bp.route("/validate-city", methods=["GET"])
@jwt_required()
def validate_city():
    """Validate a city name against OpenWeather and return matches."""
    city = request.args.get("city", "").strip()
    if not city:
        return jsonify({"error": "City parameter is required."}), 400

    api_key = current_app.config.get("OPENWEATHER_API_KEY")
    if not api_key or api_key == "your_openweathermap_api_key_here":
        return jsonify({"error": "Weather API not configured."}), 503

    try:
        response = http_requests.get(
            "https://api.openweathermap.org/geo/1.0/direct",
            params={"q": city, "limit": 5, "appid": api_key},
            timeout=8,
        )
        response.raise_for_status()
        results = response.json()

        matches = [
            {
                "city": r.get("name", ""),
                "state": r.get("state", ""),
                "country": r.get("country", ""),
            }
            for r in results
        ]
        return jsonify({"matches": matches}), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502


@profile_bp.route("", methods=["GET"])
@jwt_required()
def get_profile():
    user = User.query.get(get_jwt_identity())
    if not user:
        return jsonify({"error": "User not found."}), 404
    return jsonify({"user": user.to_dict()}), 200


@profile_bp.route("", methods=["PUT"])
@jwt_required()
def update_profile():
    user = User.query.get(get_jwt_identity())
    if not user:
        return jsonify({"error": "User not found."}), 404

    data = request.get_json(silent=True) or {}

    if "full_name" in data and data["full_name"].strip():
        user.full_name = data["full_name"].strip()

    if "city" in data:
        city_val = (data["city"] or "").strip()
        if city_val:
            # Validate city against OpenWeather
            resolved = _validate_city_openweather(city_val)
            if resolved:
                user.city = resolved["city"]  # use the API-resolved name
            else:
                # API key missing or network error — accept raw input
                user.city = city_val
        else:
            user.city = None

    if "state" in data:
        user.state = (data["state"] or "").strip() or None
    if "land_area_acres" in data:
        try:
            user.land_area_acres = float(data["land_area_acres"]) if data["land_area_acres"] is not None else None
        except (TypeError, ValueError):
            return jsonify({"error": "land_area_acres must be a number."}), 400
    if "preferred_language" in data and data["preferred_language"] in ("en", "kn"):
        user.preferred_language = data["preferred_language"]
    if "theme_preference" in data and data["theme_preference"] in ("light", "dark"):
        user.theme_preference = data["theme_preference"]

    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200


@profile_bp.route("/password", methods=["PUT"])
@jwt_required()
def change_password():
    user = User.query.get(get_jwt_identity())
    if not user:
        return jsonify({"error": "User not found."}), 404

    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if not user.check_password(current_password):
        return jsonify({"error": "Current password is incorrect."}), 401

    password_ok, password_error = is_valid_password(new_password)
    if not password_ok:
        return jsonify({"error": password_error}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "Password updated successfully."}), 200


@profile_bp.route("", methods=["DELETE"])
@jwt_required()
def delete_account():
    user = User.query.get(get_jwt_identity())
    if not user:
        return jsonify({"error": "User not found."}), 404

    db.session.delete(user)  # cascades to history
    db.session.commit()
    return jsonify({"message": "Account deleted successfully."}), 200
