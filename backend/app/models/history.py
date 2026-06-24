"""
AgroInsight - Recommendation History Model
=============================================
Stores every prediction a farmer makes: their raw inputs, the weather data
that was fetched/used, the top-5 results, and the SHAP explanation, so the
History page can list, search, filter, and export past recommendations.
"""

from datetime import datetime

from app.extensions import db


class RecommendationHistory(db.Model):
    __tablename__ = "recommendation_history"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    # --- Farmer-entered soil inputs ---
    nitrogen = db.Column(db.Float, nullable=False)
    phosphorus = db.Column(db.Float, nullable=False)
    potassium = db.Column(db.Float, nullable=False)
    ph = db.Column(db.Float, nullable=False)

    # --- Weather data used (fetched automatically, or fallback) ---
    temperature = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    rainfall = db.Column(db.Float, nullable=False)
    weather_source = db.Column(db.String(20), nullable=False, default="api")  # 'api' | 'fallback'

    # --- Results ---
    predicted_crop = db.Column(db.String(50), nullable=False)
    top5_json = db.Column(db.JSON, nullable=False)  # [{crop, confidence, rank}, ...]
    shap_explanation_json = db.Column(db.JSON, nullable=True)
    model_used = db.Column(db.String(30), nullable=False)  # knn | random_forest | xgboost

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "inputs": {
                "nitrogen": self.nitrogen,
                "phosphorus": self.phosphorus,
                "potassium": self.potassium,
                "ph": self.ph,
            },
            "weather": {
                "temperature": self.temperature,
                "humidity": self.humidity,
                "rainfall": self.rainfall,
                "source": self.weather_source,
            },
            "predicted_crop": self.predicted_crop,
            "top5": self.top5_json,
            "shap_explanation": self.shap_explanation_json,
            "model_used": self.model_used,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
