"""
AgroInsight - Saved Land Allocation Plan Model
=================================================
A farmer can save a land allocation plan: total acreage plus a percentage
split across the top-5 (or fewer) recommended crops. Validation that
percentages sum to 100 happens at the API layer, not here.
"""

from datetime import datetime

from app.extensions import db


class SavedPlan(db.Model):
    __tablename__ = "saved_plans"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    history_id = db.Column(
        db.Integer, db.ForeignKey("recommendation_history.id"), nullable=True, index=True
    )

    plan_name = db.Column(db.String(120), nullable=False, default="My Land Plan")
    total_land_acres = db.Column(db.Float, nullable=False)

    # allocations_json: [{ "crop": "rice", "percentage": 40, "area_acres": 0.4 }, ...]
    allocations_json = db.Column(db.JSON, nullable=False)
    allocation_type = db.Column(db.String(10), nullable=False, default="custom")  # 'equal' | 'custom'

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "history_id": self.history_id,
            "plan_name": self.plan_name,
            "total_land_acres": self.total_land_acres,
            "allocation_type": self.allocation_type,
            "allocations": self.allocations_json,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
