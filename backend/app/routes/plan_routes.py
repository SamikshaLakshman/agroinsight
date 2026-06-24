"""
AgroInsight - Land Allocation Plan Routes
=============================================
Endpoints:
    POST   /api/plans              Create/save a plan (validates % sums to 100)
    GET    /api/plans              List saved plans
    GET    /api/plans/<id>         Single plan detail
    PUT    /api/plans/<id>         Update a plan
    DELETE /api/plans/<id>         Delete a plan
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models.plan import SavedPlan
from app.utils.validators import validate_allocations

plans_bp = Blueprint("plans", __name__, url_prefix="/api/plans")


def _compute_areas(total_land_acres: float, allocations: list) -> list:
    """Attaches a calculated area_acres to each allocation based on percentage."""
    enriched = []
    for alloc in allocations:
        percentage = float(alloc["percentage"])
        enriched.append({
            "crop": alloc["crop"],
            "percentage": percentage,
            "area_acres": round(total_land_acres * percentage / 100, 4),
        })
    return enriched


@plans_bp.route("", methods=["POST"])
@jwt_required()
def create_plan():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}

    total_land_acres = data.get("total_land_acres")
    allocations = data.get("allocations")
    allocation_type = data.get("allocation_type", "custom")

    if not total_land_acres or float(total_land_acres) <= 0:
        return jsonify({"error": "total_land_acres must be a positive number."}), 400

    is_valid, error = validate_allocations(allocations or [])
    if not is_valid:
        return jsonify({"error": error}), 400

    enriched_allocations = _compute_areas(float(total_land_acres), allocations)

    plan = SavedPlan(
        user_id=user_id,
        history_id=data.get("history_id"),
        plan_name=data.get("plan_name", "My Land Plan"),
        total_land_acres=float(total_land_acres),
        allocations_json=enriched_allocations,
        allocation_type=allocation_type if allocation_type in ("equal", "custom") else "custom",
    )
    db.session.add(plan)
    db.session.commit()

    return jsonify(plan.to_dict()), 201


@plans_bp.route("", methods=["GET"])
@jwt_required()
def list_plans():
    user_id = get_jwt_identity()
    plans = (
        SavedPlan.query.filter_by(user_id=user_id)
        .order_by(SavedPlan.created_at.desc())
        .all()
    )
    return jsonify({"items": [p.to_dict() for p in plans]}), 200


@plans_bp.route("/<int:plan_id>", methods=["GET"])
@jwt_required()
def get_plan(plan_id):
    user_id = get_jwt_identity()
    plan = SavedPlan.query.filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        return jsonify({"error": "Plan not found."}), 404
    return jsonify(plan.to_dict()), 200


@plans_bp.route("/<int:plan_id>", methods=["PUT"])
@jwt_required()
def update_plan(plan_id):
    user_id = get_jwt_identity()
    plan = SavedPlan.query.filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        return jsonify({"error": "Plan not found."}), 404

    data = request.get_json(silent=True) or {}

    total_land_acres = data.get("total_land_acres", plan.total_land_acres)
    allocations = data.get("allocations")

    if allocations is not None:
        is_valid, error = validate_allocations(allocations)
        if not is_valid:
            return jsonify({"error": error}), 400
        plan.allocations_json = _compute_areas(float(total_land_acres), allocations)

    if "plan_name" in data:
        plan.plan_name = data["plan_name"]
    if "total_land_acres" in data:
        plan.total_land_acres = float(total_land_acres)
    if "allocation_type" in data and data["allocation_type"] in ("equal", "custom"):
        plan.allocation_type = data["allocation_type"]

    db.session.commit()
    return jsonify(plan.to_dict()), 200


@plans_bp.route("/<int:plan_id>", methods=["DELETE"])
@jwt_required()
def delete_plan(plan_id):
    user_id = get_jwt_identity()
    plan = SavedPlan.query.filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        return jsonify({"error": "Plan not found."}), 404

    db.session.delete(plan)
    db.session.commit()
    return jsonify({"message": "Plan deleted successfully."}), 200
