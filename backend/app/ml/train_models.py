"""
AgroInsight - Model Training Pipeline
======================================
Trains KNN, Random Forest, and XGBoost on the crop recommendation dataset,
evaluates all three with cross-validation, and persists:
  - each trained model (.pkl)
  - the fitted StandardScaler
  - the fitted LabelEncoder
  - a metrics.json report (used by the Model Performance Dashboard)
  - a background sample (used by SHAP at inference time)

Run manually whenever the dataset changes:
    python -m app.ml.train_models

This script is intentionally standalone (no Flask app context needed) so it
can be run independently of the web server.
"""

import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from xgboost import XGBClassifier

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "crop_data.csv"
ARTIFACTS_DIR = BASE_DIR / "artifacts"
ARTIFACTS_DIR.mkdir(exist_ok=True)

FEATURE_COLUMNS = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
TARGET_COLUMN = "label"
RANDOM_STATE = 42


def load_data():
    df = pd.read_csv(CSV_PATH)
    df.columns = [c.strip() for c in df.columns]
    return df


def build_models():
    """Return a dict of model_name -> unfitted estimator."""
    return {
        "knn": KNeighborsClassifier(n_neighbors=5, weights="distance"),
        "random_forest": RandomForestClassifier(
            n_estimators=200,
            max_depth=None,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        "xgboost": XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            random_state=RANDOM_STATE,
            eval_metric="mlogloss",
            n_jobs=-1,
        ),
    }


def evaluate_model(model, X_train, y_train, X_test, y_test, cv_folds=5):
    """Fit, predict, and compute the full metric suite for one model."""
    start = time.time()
    model.fit(X_train, y_train)
    train_time = time.time() - start

    start = time.time()
    y_pred = model.predict(X_test)
    inference_time = (time.time() - start) / max(len(X_test), 1)

    skf = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=RANDOM_STATE)
    cv_scores = cross_val_score(model, X_train, y_train, cv=skf, scoring="f1_macro")

    metrics = {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, average="macro", zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, y_pred, average="macro", zero_division=0)), 4),
        "f1_score": round(float(f1_score(y_test, y_pred, average="macro", zero_division=0)), 4),
        "cv_mean_f1": round(float(cv_scores.mean()), 4),
        "cv_std_f1": round(float(cv_scores.std()), 4),
        "cv_scores": [round(float(s), 4) for s in cv_scores],
        "train_time_seconds": round(train_time, 4),
        "avg_inference_time_seconds": round(inference_time, 6),
    }
    return model, metrics


def main():
    print(f"Loading dataset from {CSV_PATH} ...")
    df = load_data()
    print(f"Dataset shape: {df.shape}, classes: {df[TARGET_COLUMN].nunique()}")

    X = df[FEATURE_COLUMNS].values
    y_raw = df[TARGET_COLUMN].values

    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(y_raw)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    models = build_models()
    all_metrics = {}
    fitted_models = {}

    for name, model in models.items():
        print(f"\nTraining {name} ...")
        # KNN benefits from scaled features; tree models are scale-invariant
        # but we use the same scaled input across the board for a single,
        # consistent inference pipeline at prediction time.
        fitted, metrics = evaluate_model(model, X_train_scaled, y_train, X_test_scaled, y_test)
        fitted_models[name] = fitted
        all_metrics[name] = metrics
        print(f"  accuracy={metrics['accuracy']}  f1_macro={metrics['f1_score']}  cv_f1={metrics['cv_mean_f1']}")

    # Best model selection: cross-validated macro F1 is the most reliable signal
    # since the dataset is balanced and cv_mean_f1 generalizes better than the
    # single test-set score (used here only as a tie-breaker).
    best_name = max(
        all_metrics,
        key=lambda n: (all_metrics[n]["cv_mean_f1"], all_metrics[n]["accuracy"]),
    )
    print(f"\nBest model: {best_name}")

    # Persist everything the Flask app needs at inference time
    for name, model in fitted_models.items():
        joblib.dump(model, ARTIFACTS_DIR / f"model_{name}.pkl")

    joblib.dump(scaler, ARTIFACTS_DIR / "scaler.pkl")
    joblib.dump(label_encoder, ARTIFACTS_DIR / "label_encoder.pkl")

    # Small background sample for SHAP (KernelExplainer/TreeExplainer baseline)
    rng = np.random.RandomState(RANDOM_STATE)
    sample_idx = rng.choice(X_train_scaled.shape[0], size=min(100, X_train_scaled.shape[0]), replace=False)
    np.save(ARTIFACTS_DIR / "shap_background.npy", X_train_scaled[sample_idx])

    report = {
        "feature_columns": FEATURE_COLUMNS,
        "classes": label_encoder.classes_.tolist(),
        "best_model": best_name,
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "dataset_rows": int(df.shape[0]),
        "metrics": all_metrics,
    }
    with open(ARTIFACTS_DIR / "metrics.json", "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nArtifacts saved to {ARTIFACTS_DIR}")
    print("Done.")


if __name__ == "__main__":
    main()
