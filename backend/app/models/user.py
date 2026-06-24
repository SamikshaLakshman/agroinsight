"""
AgroInsight - User Model
==========================
"""

from datetime import datetime

from app.extensions import bcrypt, db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    city = db.Column(db.String(100), nullable=True)
    state = db.Column(db.String(100), nullable=True)
    land_area_acres = db.Column(db.Float, nullable=True)
    preferred_language = db.Column(db.String(5), nullable=False, default="en")  # 'en' | 'kn'
    theme_preference = db.Column(db.String(5), nullable=False, default="light")  # 'light' | 'dark'

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    history_entries = db.relationship(
        "RecommendationHistory", backref="user", lazy="dynamic", cascade="all, delete-orphan"
    )
    saved_plans = db.relationship(
        "SavedPlan", backref="user", lazy="dynamic", cascade="all, delete-orphan"
    )

    def set_password(self, raw_password: str) -> None:
        self.password_hash = bcrypt.generate_password_hash(raw_password).decode("utf-8")

    def check_password(self, raw_password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, raw_password)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "city": self.city,
            "state": self.state,
            "land_area_acres": self.land_area_acres,
            "preferred_language": self.preferred_language,
            "theme_preference": self.theme_preference,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
