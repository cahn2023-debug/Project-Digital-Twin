"""Application composition and cross-module coordination for the server."""

from .dependencies import get_store

__all__ = ["get_store"]
