import os

from ..domain import CameraStore
from ..persistence import PostgresCameraStore


def build_store() -> CameraStore:
    database_url = os.getenv("DATABASE_URL")
    is_production = os.getenv("APP_ENV", "development").casefold() == "production"
    if is_production and os.getenv("AUTH_MODE", "oidc").casefold() != "oidc":
        raise RuntimeError("AUTH_MODE=oidc is required when APP_ENV=production")
    if database_url:
        return PostgresCameraStore(database_url)
    if is_production:
        raise RuntimeError("DATABASE_URL is required when APP_ENV=production")
    return CameraStore()


