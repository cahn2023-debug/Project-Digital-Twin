from __future__ import annotations

import csv
import io
import json
import logging
import os
from contextvars import ContextVar
from time import perf_counter
from typing import Any
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .authorization import AuthorizationError, Principal, Role, authorize
from .auth import AuthenticationError, authenticate_bearer
from .persistence import PostgresCameraStore


logger = logging.getLogger("project_digital_twin.api")
request_metrics = {
    "requests_total": 0,
    "requests_errors_total": 0,
    "request_duration_seconds_total": 0.0,
}
current_principal: ContextVar[Principal | None] = ContextVar("current_principal", default=None)


from .shared.schemas import (
    ApprovalRequest,
    ContractorCreate,
    DocumentImportRequest,
    FileImportRequest,
    FieldPackageCreate,
    GeometryRequest,
    ImportRequest,
    ObservationCreate,
    OrganizeGroupCreate,
    OrganizeGroupPatch,
    OrganizeLifecycleRequest,
    OrganizeMembershipRequest,
    OrganizeTagCreate,
    OrganizeWriteBackExecuteRequest,
    OrganizeWriteBackPreviewRequest,
    ProjectCreate,
    ProjectDelete,
    RestoreJobCreate,
    WorkPackageCreate,
    WriteJobComplete,
    WriteJobCreate,
    WriteJobFailureRequest,
)
from .platform.runtime import build_store as _build_store

store = _build_store()
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


@app.middleware("http")
async def request_observability_and_transaction(request: Request, call_next: Any) -> Any:
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    started = perf_counter()
    request_metrics["requests_total"] += 1
    response = None
    principal_token = None
    try:
        if os.getenv("APP_ENV", "development").casefold() == "production" and request.url.path.startswith("/api"):
            try:
                principal_token = current_principal.set(authenticate_bearer(request.headers.get("Authorization")))
            except AuthenticationError as exc:
                request_metrics["requests_errors_total"] += 1
                logger.info(
                    json.dumps(
                        {
                            "event": "request_unauthenticated",
                            "request_id": request_id,
                            "method": request.method,
                            "path": request.url.path,
                        },
                        ensure_ascii=False,
                    )
                )
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Authentication required"},
                    headers={"X-Request-ID": request_id},
                )
        use_transaction = isinstance(store, PostgresCameraStore) and not request.url.path.startswith("/health")
        if use_transaction:
            with store.request_context():
                response = await call_next(request)
        else:
            response = await call_next(request)
    except Exception:
        request_metrics["requests_errors_total"] += 1
        logger.exception(
            json.dumps(
                {
                    "event": "request_failed",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                },
                ensure_ascii=False,
            )
        )
        raise
    finally:
        if principal_token is not None:
            current_principal.reset(principal_token)
        request_metrics["request_duration_seconds_total"] += perf_counter() - started
    response.headers["X-Request-ID"] = request_id
    logger.info(
        json.dumps(
            {
                "event": "request_completed",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round((perf_counter() - started) * 1000, 3),
            },
            ensure_ascii=False,
        )
    )
    return response


@app.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def ready() -> dict[str, Any]:
    if isinstance(store, PostgresCameraStore):
        try:
            return store.health()
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Canonical store is unavailable") from exc
    return {"status": "ok", "canonical_store": "in-memory-development"}


@app.get("/metrics")
def metrics() -> Response:
    lines = [
        "# TYPE project_digital_twin_requests_total counter",
        f"project_digital_twin_requests_total {request_metrics['requests_total']}",
        "# TYPE project_digital_twin_requests_errors_total counter",
        f"project_digital_twin_requests_errors_total {request_metrics['requests_errors_total']}",
        "# TYPE project_digital_twin_request_duration_seconds_total counter",
        f"project_digital_twin_request_duration_seconds_total {request_metrics['request_duration_seconds_total']}",
    ]
    return Response("\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")
















def _organize_group_state(group: Any) -> dict[str, Any]:
    return {
        "id": str(group.id),
        "project_id": str(group.project_id),
        "name": group.name,
        "parent_ids": [str(parent_id) for parent_id in group.parent_ids],
        "status": group.status,
        "created_at": group.created_at,
        "updated_at": group.updated_at,
    }


def _organize_membership_state(project_id: UUID, item_type: str, item_ids: list[UUID]) -> dict[str, list[str]]:
    return {
        "group_ids": [
            str(membership.group_id)
            for membership in store.list_organize_group_memberships(project_id, item_type, set(item_ids))
        ],
        "tag_ids": [
            str(membership.tag_id)
            for membership in store.list_organize_tag_memberships(project_id, item_type, set(item_ids))
        ],
    }


























def _authorize_header(project_id: UUID, action: str, actor: str, role: str) -> None:
    try:
        principal = current_principal.get()
        if principal is None:
            principal = Principal(actor, frozenset({Role(role)}), frozenset({project_id}))
        authorize(principal, action, project_id)
    except (AuthorizationError, ValueError) as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc































# Feature routers keep the public REST paths stable while the monolithic endpoint module is retired.
from .modules.project.router import router as project_router
from .modules.datacenter.router import router as datacenter_router
from .modules.design.router import router as design_router
from .modules.operate.router import router as operate_router
from .modules.organize.router import router as organize_router
from .modules.dashboard.router import router as dashboard_router

app.include_router(project_router)
app.include_router(datacenter_router)
app.include_router(design_router)
app.include_router(operate_router)
app.include_router(organize_router)
app.include_router(dashboard_router)
