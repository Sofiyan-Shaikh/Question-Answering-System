"""
test_api.py
-----------
Integration + boundary tests for all FastAPI endpoints.

Covers:
  - GET  /api/v1/health
  - POST /api/v1/auth/login
  - POST /api/v1/qa/predict  (auth + payload validation)
  - GET  /api/v1/analytics/metrics
  - Error responses: 401, 422, 503
"""

import sys
import os
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.app.main import app

client = TestClient(app, raise_server_exceptions=False)

# ── Helpers ─────────────────────────────────────────────────────────────────

VALID_CREDENTIALS = {"username": "analyst", "password": "password123"}

VALID_QA_PAYLOAD = {
    "context":  "SQuAD 2.0 has over 50,000 unanswerable questions.",
    "question": "How many unanswerable questions are in SQuAD 2.0?",
}


def get_token() -> str:
    resp = client.post("/api/v1/auth/login", json=VALID_CREDENTIALS)
    return resp.json()["access_token"]


def auth_headers() -> dict:
    return {"Authorization": f"Bearer {get_token()}"}


# ── Health check ─────────────────────────────────────────────────────────────

class TestHealthEndpoint:
    def test_health_returns_200(self):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200

    def test_health_schema(self):
        resp = client.get("/api/v1/health")
        data = resp.json()
        assert "status"        in data
        assert "model_loaded"  in data
        assert "model_version" in data
        assert "device"        in data

    def test_health_status_value(self):
        resp = client.get("/api/v1/health")
        assert resp.json()["status"] == "healthy"


# ── Auth ──────────────────────────────────────────────────────────────────────

class TestAuthEndpoint:
    def test_login_success(self):
        resp = client.post("/api/v1/auth/login", json=VALID_CREDENTIALS)
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self):
        resp = client.post(
            "/api/v1/auth/login",
            json={"username": "analyst", "password": "wrongpassword"}
        )
        assert resp.status_code == 401

    def test_login_unknown_user(self):
        resp = client.post(
            "/api/v1/auth/login",
            json={"username": "nobody", "password": "password123"}
        )
        assert resp.status_code == 401

    def test_login_missing_fields(self):
        resp = client.post("/api/v1/auth/login", json={"username": "analyst"})
        assert resp.status_code == 422


# ── QA Predict ────────────────────────────────────────────────────────────────

class TestQAEndpoint:
    MOCK_RESULT = {
        "answer":           "over 50,000",
        "is_answerable":    True,
        "confidence_score": 0.964,
        "start_char":       10,
        "end_char":         21,
        "model_version":    "bert-base-squad2-v1",
        "execution_time_ms": 38.5,
    }

    def test_predict_requires_auth(self):
        """No token → 403 (HTTPBearer raises 403 when header missing)."""
        resp = client.post("/api/v1/qa/predict", json=VALID_QA_PAYLOAD)
        assert resp.status_code in (401, 403)

    def test_predict_invalid_token(self):
        resp = client.post(
            "/api/v1/qa/predict",
            json=VALID_QA_PAYLOAD,
            headers={"Authorization": "Bearer totally.invalid.token"},
        )
        assert resp.status_code == 401

    def test_predict_missing_context(self):
        resp = client.post(
            "/api/v1/qa/predict",
            json={"question": "Who?"},
            headers=auth_headers(),
        )
        assert resp.status_code == 422

    def test_predict_missing_question(self):
        resp = client.post(
            "/api/v1/qa/predict",
            json={"context": "Some context here."},
            headers=auth_headers(),
        )
        assert resp.status_code == 422

    def test_predict_empty_context(self):
        resp = client.post(
            "/api/v1/qa/predict",
            json={"context": "", "question": "Who?"},
            headers=auth_headers(),
        )
        assert resp.status_code == 422

    @patch("backend.app.routes.qa_routes.predictor")
    def test_predict_success_schema(self, mock_predictor):
        """Mock predictor to test response schema without GPU."""
        mock_predictor.predict.return_value = self.MOCK_RESULT
        resp = client.post(
            "/api/v1/qa/predict",
            json=VALID_QA_PAYLOAD,
            headers=auth_headers(),
        )
        assert resp.status_code == 200
        data = resp.json()
        required = {
            "answer", "is_answerable", "confidence_score",
            "start_char", "end_char", "model_version", "execution_time_ms"
        }
        assert required.issubset(data.keys())

    @patch("backend.app.routes.qa_routes.predictor")
    def test_predict_unanswerable_schema(self, mock_predictor):
        """Unanswerable response must have empty answer and -1 offsets."""
        mock_predictor.predict.return_value = {
            "answer":           "",
            "is_answerable":    False,
            "confidence_score": 0.12,
            "start_char":       -1,
            "end_char":         -1,
            "model_version":    "bert-base-squad2-v1",
            "execution_time_ms": 32.1,
        }
        resp = client.post(
            "/api/v1/qa/predict",
            json=VALID_QA_PAYLOAD,
            headers=auth_headers(),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_answerable"] is False
        assert data["answer"] == ""
        assert data["start_char"] == -1
        assert data["end_char"] == -1

    @patch("backend.app.routes.qa_routes.predictor")
    def test_predict_service_error_returns_500(self, mock_predictor):
        mock_predictor.predict.side_effect = RuntimeError("Model not loaded")
        resp = client.post(
            "/api/v1/qa/predict",
            json=VALID_QA_PAYLOAD,
            headers=auth_headers(),
        )
        assert resp.status_code == 500


# ── Analytics ─────────────────────────────────────────────────────────────────

class TestAnalyticsEndpoint:
    def test_metrics_requires_auth(self):
        resp = client.get("/api/v1/analytics/metrics")
        assert resp.status_code in (401, 403)

    def test_metrics_success(self):
        resp = client.get("/api/v1/analytics/metrics", headers=auth_headers())
        assert resp.status_code == 200

    def test_metrics_schema(self):
        resp = client.get("/api/v1/analytics/metrics", headers=auth_headers())
        data = resp.json()
        assert "dataset"        in data
        assert "exact_match"    in data
        assert "f1_score"       in data
        assert "null_threshold" in data
        assert "total_samples"  in data

    def test_metrics_values_in_range(self):
        resp = client.get("/api/v1/analytics/metrics", headers=auth_headers())
        data = resp.json()
        assert 0 <= data["exact_match"] <= 100
        assert 0 <= data["f1_score"]    <= 100
        assert data["total_samples"]    > 0


# ── Root & 404 ────────────────────────────────────────────────────────────────

class TestRootAndFallback:
    def test_root_returns_200(self):
        resp = client.get("/")
        assert resp.status_code == 200

    def test_404_on_unknown_route(self):
        resp = client.get("/api/v1/nonexistent")
        assert resp.status_code == 404
