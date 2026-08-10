from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .request_context import install_http_middleware, register_runtime_routes
from .router_registry import register_feature_routers


def create_app() -> FastAPI:
    app = FastAPI(title="Project Digital Twin API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            origin.strip()
            for origin in os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173").split(",")
            if origin.strip()
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_http_middleware(app)
    register_runtime_routes(app)
    register_feature_routers(app)
    return app
