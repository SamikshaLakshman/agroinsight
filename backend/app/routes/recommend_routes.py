"""
AgroInsight - Crop Recommendation Routes
===========================================
Endpoints:
    POST /api/recommend
        Farmer submits N, P, K, ph. Weather (temperature, humidity, rainfall)
        is fetched automatically from the user's profile city. Returns top-5
        crops, the best model's prediction, and a SHAP explanation. The full
        result is saved to recommendation history.

    GET  /api/recommend/explain/lime/<history_id>
        On-demand LIME explanation for a past prediction (LIME is slower,
        so it is not computed by default on every /recommend call).
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.ml.prediction_service import PredictionService
from app.models.history import RecommendationHistory
from app.models.user import User
from app.services.weather_service import fetch_weather_by_city
from app.utils.validators import validate_soil_inputs

recommend_bp = Blueprint("recommend", __name__, url_prefix="/api/recommend")


@recommend_bp.route("", methods=["POST"])
@jwt_required()
def recommend():
    user = User.query.get(get_jwt_identity())
    if not user:
        return jsonify({"error": "User not found."}), 404

    data = request.get_json(silent=True) or {}

    is_valid, error = validate_soil_inputs(data)
    if not is_valid:
        return jsonify({"error": error}), 400

    if not user.city:
        return jsonify({
            "error": "Please set your city in your profile so we can fetch local weather data."
        }), 400

    weather = fetch_weather_by_city(user.city)

    raw_features = {
        "N": float(data["nitrogen"]),
        "P": float(data["phosphorus"]),
        "K": float(data["potassium"]),
        "ph": float(data["ph"]),
        "temperature": weather["temperature"],
        "humidity": weather["humidity"],
        "rainfall": weather["rainfall"],
    }

    service = PredictionService.get_instance()
    prediction = service.predict_top5(raw_features)
    shap_result = service.explain_shap(raw_features, model_name=prediction["model_used"])

    history_entry = RecommendationHistory(
        user_id=user.id,
        nitrogen=raw_features["N"],
        phosphorus=raw_features["P"],
        potassium=raw_features["K"],
        ph=raw_features["ph"],
        temperature=raw_features["temperature"],
        humidity=raw_features["humidity"],
        rainfall=raw_features["rainfall"],
        weather_source=weather["source"],
        predicted_crop=prediction["predicted_crop"],
        top5_json=prediction["top5"],
        shap_explanation_json=shap_result,
        model_used=prediction["model_used"],
    )
    db.session.add(history_entry)
    db.session.commit()

    return jsonify({
        "history_id": history_entry.id,
        "inputs": {
            "nitrogen": raw_features["N"],
            "phosphorus": raw_features["P"],
            "potassium": raw_features["K"],
            "ph": raw_features["ph"],
        },
        "weather": weather,
        "model_used": prediction["model_used"],
        "predicted_crop": prediction["predicted_crop"],
        "top5": prediction["top5"],
        "shap_explanation": shap_result,
    }), 200


@recommend_bp.route("/explain/lime/<int:history_id>", methods=["GET"])
@jwt_required()
def explain_lime(history_id):
    user_id = get_jwt_identity()
    entry = RecommendationHistory.query.filter_by(id=history_id, user_id=user_id).first()
    if not entry:
        return jsonify({"error": "History entry not found."}), 404

    raw_features = {
        "N": entry.nitrogen,
        "P": entry.phosphorus,
        "K": entry.potassium,
        "ph": entry.ph,
        "temperature": entry.temperature,
        "humidity": entry.humidity,
        "rainfall": entry.rainfall,
    }

    service = PredictionService.get_instance()
    lime_result = service.explain_lime(raw_features, model_name=entry.model_used)

    return jsonify(lime_result), 200
