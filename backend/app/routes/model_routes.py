"""
AgroInsight - Model Performance & Research Routes
=====================================================
Endpoints:
    GET /api/models/performance
        Full metrics for KNN, Random Forest, XGBoost (accuracy, precision,
        recall, F1, cross-validation) plus the current best model. Powers
        the Model Performance Dashboard.

    GET /api/research/explainability
        SHAP/LIME latency and consistency metrics for the research-facing
        Explainable AI dashboard (kept separate from the farmer-facing
        explanation shown inline in /api/recommend).
"""

import time

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.ml.prediction_service import PredictionService
from app.utils.validators import validate_soil_inputs

models_bp = Blueprint("models", __name__, url_prefix="/api/models")
research_bp = Blueprint("research", __name__, url_prefix="/api/research")


@models_bp.route("/performance", methods=["GET"])
@jwt_required()
def model_performance():
    service = PredictionService.get_instance()
    report = service.get_metrics_report()
    return jsonify(report), 200


@research_bp.route("/explainability", methods=["POST"])
@jwt_required()
def explainability_benchmark():
    """
    Runs SHAP and LIME on a sample input and reports latency + a simple
    feature-agreement score (how many of the top-3 features both methods
    agree on), for the researcher-facing Explainable AI dashboard.
    """
    data = request.get_json(silent=True) or {}
    is_valid, error = validate_soil_inputs(data)
    if not is_valid:
        return jsonify({"error": error}), 400

    raw_features = {
        "N": float(data["nitrogen"]),
        "P": float(data["phosphorus"]),
        "K": float(data["potassium"]),
        "ph": float(data["ph"]),
        "temperature": float(data.get("temperature", 25.0)),
        "humidity": float(data.get("humidity", 70.0)),
        "rainfall": float(data.get("rainfall", 100.0)),
    }

    service = PredictionService.get_instance()

    start = time.time()
    shap_result = service.explain_shap(raw_features)
    shap_latency = time.time() - start

    start = time.time()
    lime_result = service.explain_lime(raw_features)
    lime_latency = time.time() - start

    shap_top_features = {c["feature"] for c in shap_result["contributions"][:3]}
    lime_top_features = set()
    for item in lime_result["explanation"][:3]:
        for col in ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]:
            if col in item["rule"]:
                lime_top_features.add(col)

    agreement = len(shap_top_features & lime_top_features)
    consistency_score = round(agreement / 3, 2) if shap_top_features and lime_top_features else 0.0

    return jsonify({
        "shap_latency_seconds": round(shap_latency, 4),
        "lime_latency_seconds": round(lime_latency, 4),
        "feature_agreement_count": agreement,
        "consistency_score": consistency_score,
        "shap_top_features": list(shap_top_features),
        "lime_top_features": list(lime_top_features),
        "shap_result": shap_result,
        "lime_result": lime_result,
    }), 200
