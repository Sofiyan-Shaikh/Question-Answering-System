"""Routes package — health, auth, qa, analytics, history, documents"""
from . import health, auth_routes, qa_routes, analytics, history_routes, document_routes

__all__ = ["health", "auth_routes", "qa_routes", "analytics", "history_routes", "document_routes"]
