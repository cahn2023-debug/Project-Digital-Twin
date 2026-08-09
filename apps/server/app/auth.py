from __future__ import annotations

import json
import os
import time
from threading import Lock
from typing import Any
from urllib.request import Request, urlopen

from .authorization import Principal, Role


class AuthenticationError(PermissionError):
    pass


_jwks_lock = Lock()
_jwks_cache: tuple[float, list[dict[str, Any]]] | None = None


def _claim_values(claims: dict[str, Any], *keys: str) -> list[str]:
    for key in keys:
        value = claims.get(key)
        if isinstance(value, str):
            return [value]
        if isinstance(value, list):
            return [item for item in value if isinstance(item, str)]
    return []


def _jwks() -> list[dict[str, Any]]:
    global _jwks_cache
    url = os.getenv("OIDC_JWKS_URL")
    if not url:
        raise AuthenticationError("OIDC_JWKS_URL is not configured")
    now = time.monotonic()
    with _jwks_lock:
        if _jwks_cache is not None and _jwks_cache[0] > now:
            return _jwks_cache[1]
        try:
            request = Request(url, headers={"Accept": "application/json"})
            with urlopen(request, timeout=5) as response:
                payload = json.load(response)
        except Exception as exc:
            raise AuthenticationError("Unable to load OIDC signing keys") from exc
        keys = payload.get("keys") if isinstance(payload, dict) else None
        if not isinstance(keys, list):
            raise AuthenticationError("OIDC JWKS response is invalid")
        _jwks_cache = (now + 300, [key for key in keys if isinstance(key, dict)])
        return _jwks_cache[1]


def authenticate_bearer(authorization: str | None) -> Principal:
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthenticationError("Bearer authentication is required")
    token = authorization[7:].strip()
    if not token:
        raise AuthenticationError("Bearer token is empty")

    try:
        import jwt

        header = jwt.get_unverified_header(token)
        key = next((item for item in _jwks() if item.get("kid") == header.get("kid")), None)
        if key is None:
            raise AuthenticationError("No matching OIDC signing key")
        signing_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256", "RS384", "RS512"],
            audience=os.environ["OIDC_AUDIENCE"],
            issuer=os.environ["OIDC_ISSUER"],
        )
    except AuthenticationError:
        raise
    except KeyError as exc:
        raise AuthenticationError(f"Missing OIDC configuration: {exc.args[0]}") from exc
    except Exception as exc:
        raise AuthenticationError("Bearer token is invalid or expired") from exc

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise AuthenticationError("Bearer token has no subject")
    raw_roles = _claim_values(claims, "roles", "groups")
    realm_access = claims.get("realm_access")
    if isinstance(realm_access, dict):
        raw_roles.extend(_claim_values(realm_access, "roles"))
    roles = frozenset(Role(role) for role in raw_roles if role in {item.value for item in Role})
    project_ids = frozenset()
    for value in _claim_values(claims, "project_ids", "projects"):
        try:
            from uuid import UUID

            project_ids = project_ids | {UUID(value)}
        except ValueError:
            continue
    return Principal(subject=subject, roles=roles, project_ids=frozenset(project_ids))
