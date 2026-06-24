"""
AgroInsight - Prediction Service
==================================
Loads the trained models + scaler + label encoder once at startup, then
serves predictions on demand. Wraps SHAP (TreeExplainer for RF/XGB,
KernelExplainer fallback for KNN) and LIME for explainability, exactly as
specified: SHAP/LIME logic is never altered, only consumed here.

This module owns no Flask state; it can be imported and used standalone
(e.g. in scripts or tests) as well as from the Flask app.
"""

import json
from pathlib import Path

import joblib
import numpy as np
import shap
from lime.lime_tabular import LimeTabularExplainer

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
FEATURE_COLUMNS = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]

# Human-readable feature labels for explanation text (kept in English; the
# frontend i18n layer translates these keys to Kannada for display).
FEATURE_LABELS = {
    "N": "Nitrogen",
    "P": "Phosphorus",
    "K": "Potassium",
    "temperature": "Temperature",
    "humidity": "Humidity",
    "ph": "Soil pH",
    "rainfall": "Rainfall",
}


class PredictionService:
    _instance = None

    def __init__(self):
        self.scaler = joblib.load(ARTIFACTS_DIR / "scaler.pkl")
        self.label_encoder = joblib.load(ARTIFACTS_DIR / "label_encoder.pkl")

        self.models = {
            "knn": joblib.load(ARTIFACTS_DIR / "model_knn.pkl"),
            "random_forest": joblib.load(ARTIFACTS_DIR / "model_random_forest.pkl"),
            "xgboost": joblib.load(ARTIFACTS_DIR / "model_xgboost.pkl"),
        }

        with open(ARTIFACTS_DIR / "metrics.json") as f:
            self.metrics_report = json.load(f)

        self.best_model_name = self.metrics_report["best_model"]
        self.best_model = self.models[self.best_model_name]

        self.shap_background = np.load(ARTIFACTS_DIR / "shap_background.npy")

        # LIME explainer is built once against the scaled feature space.
        self.lime_explainer = LimeTabularExplainer(
            training_data=self.shap_background,
            feature_names=FEATURE_COLUMNS,
            class_names=self.label_encoder.classes_.tolist(),
            mode="classification",
        )

        # SHAP explainer per tree model (fast, exact). KNN uses a small
        # KernelExplainer since it has no native SHAP support.
        self._shap_explainers = {}

    @classmethod
    def get_instance(cls) -> "PredictionService":
        """Lazy singleton so artifacts load once per process, not per request."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_shap_explainer(self, model_name: str):
        if model_name in self._shap_explainers:
            return self._shap_explainers[model_name]

        model = self.models[model_name]
        if model_name in ("random_forest", "xgboost"):
            explainer = shap.TreeExplainer(model)
        else:
            # KernelExplainer is slow, so we keep the background sample small
            # (already capped at 100 rows during training).
            explainer = shap.KernelExplainer(model.predict_proba, self.shap_background)

        self._shap_explainers[model_name] = explainer
        return explainer

    def _scale_input(self, raw_features: dict) -> np.ndarray:
        row = np.array([[raw_features[col] for col in FEATURE_COLUMNS]], dtype=float)
        return self.scaler.transform(row)

    def predict_top5(self, raw_features: dict, model_name: str | None = None) -> dict:
        """
        raw_features: dict with keys N, P, K, temperature, humidity, ph, rainfall
        model_name: optional override; defaults to the best model from training.
        Returns: { model_used, top5: [{rank, crop, confidence}], predicted_crop }
        """
        model_name = model_name or self.best_model_name
        model = self.models[model_name]

        X_scaled = self._scale_input(raw_features)
        probabilities = model.predict_proba(X_scaled)[0]

        top5_idx = np.argsort(probabilities)[::-1][:5]
        crops = self.label_encoder.inverse_transform(top5_idx)
        confidences = probabilities[top5_idx]

        top5 = [
            {
                "rank": i + 1,
                "crop": str(crop),
                "confidence": round(float(conf) * 100, 2),
            }
            for i, (crop, conf) in enumerate(zip(crops, confidences))
        ]

        return {
            "model_used": model_name,
            "predicted_crop": top5[0]["crop"],
            "top5": top5,
        }

    def explain_shap(self, raw_features: dict, model_name: str | None = None, top_n: int = 5) -> dict:
        """
        Returns SHAP values for the predicted class, plus a human-readable
        explanation string built from the top contributing features.
        """
        model_name = model_name or self.best_model_name
        X_scaled = self._scale_input(raw_features)

        explainer = self._get_shap_explainer(model_name)
        prediction = self.predict_top5(raw_features, model_name)
        predicted_idx = int(
            self.label_encoder.transform([prediction["predicted_crop"]])[0]
        )

        shap_values = explainer.shap_values(X_scaled)

        # shap_values shape handling differs slightly across explainer types;
        # normalize to a flat array of per-feature contributions for the
        # predicted class.
        if isinstance(shap_values, list):
            class_shap = np.array(shap_values[predicted_idx])[0]
        elif shap_values.ndim == 3:
            class_shap = shap_values[0, :, predicted_idx]
        else:
            class_shap = shap_values[0]

        contributions = [
            {
                "feature": col,
                "feature_label": FEATURE_LABELS[col],
                "value": round(float(raw_features[col]), 2),
                "shap_value": round(float(val), 4),
                "direction": "increased" if val > 0 else "decreased",
            }
            for col, val in zip(FEATURE_COLUMNS, class_shap)
        ]
        contributions.sort(key=lambda c: abs(c["shap_value"]), reverse=True)
        top_contributions = contributions[:top_n]

        explanation_text = self._build_explanation_text(
            prediction["predicted_crop"], top_contributions
        )

        return {
            "predicted_crop": prediction["predicted_crop"],
            "contributions": top_contributions,
            "human_readable_explanation": explanation_text,
        }

    @staticmethod
    def _build_explanation_text(crop: str, contributions: list) -> str:
        parts = []
        for c in contributions[:3]:
            parts.append(f"{c['feature_label']} ({c['value']}) {c['direction']} the confidence")
        joined = "; ".join(parts)
        return f"{crop.capitalize()} was recommended mainly because: {joined}."

    def explain_lime(self, raw_features: dict, model_name: str | None = None, num_features: int = 5) -> dict:
        """Returns LIME's local explanation for the top predicted class."""
        model_name = model_name or self.best_model_name
        model = self.models[model_name]
        X_scaled = self._scale_input(raw_features)[0]

        explanation = self.lime_explainer.explain_instance(
            X_scaled, model.predict_proba, num_features=num_features
        )

        return {
            "model_used": model_name,
            "explanation": [
                {"rule": rule, "weight": round(float(weight), 4)}
                for rule, weight in explanation.as_list()
            ],
        }

    def get_metrics_report(self) -> dict:
        """Used by the Model Performance Dashboard."""
        return self.metrics_report
