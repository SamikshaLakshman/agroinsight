"""
AgroInsight - Shared Extension Instances
==========================================
Instantiated here (not in __init__.py) so models, routes, and services can
import them without circular-import issues. Bound to the app in create_app().
"""

from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()
cors = CORS()
limiter = Limiter(key_func=get_remote_address)
migrate = Migrate()
