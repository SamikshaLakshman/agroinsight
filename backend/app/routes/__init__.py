from app.routes.auth_routes import auth_bp
from app.routes.history_routes import history_bp
from app.routes.model_routes import models_bp, research_bp
from app.routes.plan_routes import plans_bp
from app.routes.profile_routes import profile_bp
from app.routes.recommend_routes import recommend_bp

ALL_BLUEPRINTS = [
    auth_bp,
    profile_bp,
    recommend_bp,
    history_bp,
    plans_bp,
    models_bp,
    research_bp,
]
