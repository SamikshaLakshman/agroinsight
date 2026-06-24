"""
AgroInsight - Recommendation History Routes
==============================================
Endpoints:
    GET /api/history              List with search, filter, pagination
    GET /api/history/<id>         Single entry detail
    GET /api/history/export/csv   Export filtered history as CSV
"""

import csv
import io

from flask import Blueprint, Response, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.history import RecommendationHistory

history_bp = Blueprint("history", __name__, url_prefix="/api/history")


def _build_filtered_query(user_id):
    query = RecommendationHistory.query.filter_by(user_id=user_id)

    crop = request.args.get("crop")
    if crop:
        query = query.filter(RecommendationHistory.predicted_crop.ilike(f"%{crop}%"))

    date_from = request.args.get("date_from")
    if date_from:
        query = query.filter(RecommendationHistory.created_at >= date_from)

    date_to = request.args.get("date_to")
    if date_to:
        query = query.filter(RecommendationHistory.created_at <= date_to)

    return query.order_by(RecommendationHistory.created_at.desc())


@history_bp.route("", methods=["GET"])
@jwt_required()
def list_history():
    user_id = get_jwt_identity()
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 10, type=int), 100)

    query = _build_filtered_query(user_id)
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "items": [entry.to_dict() for entry in paginated.items],
        "page": paginated.page,
        "per_page": paginated.per_page,
        "total_items": paginated.total,
        "total_pages": paginated.pages,
    }), 200


@history_bp.route("/<int:history_id>", methods=["GET"])
@jwt_required()
def get_history_entry(history_id):
    user_id = get_jwt_identity()
    entry = RecommendationHistory.query.filter_by(id=history_id, user_id=user_id).first()
    if not entry:
        return jsonify({"error": "History entry not found."}), 404
    return jsonify(entry.to_dict()), 200


@history_bp.route("/export/csv", methods=["GET"])
@jwt_required()
def export_csv():
    user_id = get_jwt_identity()
    entries = _build_filtered_query(user_id).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date", "Nitrogen", "Phosphorus", "Potassium", "pH",
        "Temperature", "Humidity", "Rainfall", "Predicted Crop",
        "Top 5 Crops", "Model Used",
    ])

    for entry in entries:
        top5_str = "; ".join(
            f"{c['crop']} ({c['confidence']}%)" for c in entry.top5_json
        )
        writer.writerow([
            entry.created_at.isoformat() if entry.created_at else "",
            entry.nitrogen, entry.phosphorus, entry.potassium, entry.ph,
            entry.temperature, entry.humidity, entry.rainfall,
            entry.predicted_crop, top5_str, entry.model_used,
        ])

    csv_data = output.getvalue()
    output.close()

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=agroinsight_history.csv"},
    )
