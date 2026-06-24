"""
AgroInsight - Application Factory
====================================
"""

import os

from flask import Flask, jsonify

from app.config import config_by_name
from app.extensions import bcrypt, cors, db, jwt, limiter, migrate


def create_app(config_name: str | None = None) -> Flask:
    config_name = config_name or os.environ.get("FLASK_ENV", "development")
    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    # --- Extensions ---
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    limiter.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGIN"]}},
        supports_credentials=True,
    )

    # --- Blueprints ---
    from app.routes import ALL_BLUEPRINTS

    # Import models so SQLAlchemy/Alembic are aware of all tables
    from app import models  # noqa: F401

    for blueprint in ALL_BLUEPRINTS:
        app.register_blueprint(blueprint)

    # --- Error handlers (consistent JSON error shape across the API) ---
    @app.errorhandler(404)
    def not_found(_e):
        return jsonify({"error": "Resource not found."}), 404

    @app.errorhandler(500)
    def internal_error(_e):
        return jsonify({"error": "An internal server error occurred."}), 500

    @jwt.expired_token_loader
    def expired_token_callback(_jwt_header, _jwt_payload):
        return jsonify({"error": "Token has expired.", "code": "token_expired"}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(_reason):
        return jsonify({"error": "Invalid token.", "code": "invalid_token"}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(_reason):
        return jsonify({"error": "Authorization token is required.", "code": "missing_token"}), 401

    # --- Health check (useful for PWA/offline detection and deployment checks) ---
    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok"}), 200

    return app
