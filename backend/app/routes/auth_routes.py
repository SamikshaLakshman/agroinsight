"""
AgroInsight - Authentication Routes
=====================================
JWT-based auth replacing Flask-Login entirely, per spec.

Endpoints:
    POST /api/auth/register
    POST /api/auth/login
    POST /api/auth/logout
    POST /api/auth/refresh
    GET  /api/auth/me
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
)

from app.extensions import db, limiter
from app.models.user import User
from app.utils.validators import is_valid_email, is_valid_password

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _issue_tokens(user: User) -> dict:
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user.to_dict(),
    }


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("10 per minute")
def register():
    data = request.get_json(silent=True) or {}

    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not full_name:
        return jsonify({"error": "Full name is required."}), 400
    if not is_valid_email(email):
        return jsonify({"error": "A valid email is required."}), 400

    password_ok, password_error = is_valid_password(password)
    if not password_ok:
        return jsonify({"error": password_error}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 409

    user = User(
        full_name=full_name,
        email=email,
        city=(data.get("city") or "").strip() or None,
        state=(data.get("state") or "").strip() or None,
        land_area_acres=data.get("land_area_acres"),
        preferred_language=data.get("preferred_language", "en"),
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    return jsonify(_issue_tokens(user)), 201


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password."}), 401

    return jsonify(_issue_tokens(user)), 200


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    # Stateless JWT: logout is handled client-side by discarding tokens.
    # This endpoint exists for API symmetry and future token-blocklist support.
    return jsonify({"message": "Logged out successfully."}), 200


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    new_access_token = create_access_token(identity=identity)
    return jsonify({"access_token": new_access_token}), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404
    return jsonify({"user": user.to_dict()}), 200
