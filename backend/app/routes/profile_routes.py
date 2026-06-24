"""
AgroInsight - User Profile Routes
====================================
Endpoints:
    GET    /api/profile
    PUT    /api/profile
    PUT    /api/profile/password
    DELETE /api/profile
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models.user import User
from app.utils.validators import is_valid_password

profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")


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
        user.city = (data["city"] or "").strip() or None
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

    db.session.delete(user)  # cascades to history + saved plans
    db.session.commit()
    return jsonify({"message": "Account deleted successfully."}), 200
