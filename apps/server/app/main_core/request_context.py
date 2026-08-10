from __future__ import annotations

import json
import logging
import os
from time import perf_counter
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response

from ..auth import AuthenticationError, authenticate_bearer
from ..persistence import PostgresCameraStore
from .dependencies import current_principal, get_store


logger = logging.getLogger("project_digital_twin.api")
request_metrics = {
    "requests_total": 0,
    "requests_errors_total": 0,
    "request_duration_seconds_total": 0.0,
}


def install_http_middleware(app: FastAPI) -> None:
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
                except AuthenticationError:
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
            store = get_store()
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


def register_runtime_routes(app: FastAPI) -> None:
    @app.get("/health/live")
    def live() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready")
    def ready() -> dict[str, Any]:
        store = get_store()
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
