from __future__ import annotations

from fastapi import FastAPI

from ..modules.dashboard.router import router as dashboard_router
from ..modules.datacenter.router import router as datacenter_router
from ..modules.design.router import router as design_router
from ..modules.operate.router import router as operate_router
from ..modules.organize.router import router as organize_router
from ..modules.project.router import router as project_router


def register_feature_routers(app: FastAPI) -> None:
    app.include_router(project_router)
    app.include_router(datacenter_router)
    app.include_router(design_router)
    app.include_router(operate_router)
    app.include_router(organize_router)
    app.include_router(dashboard_router)
