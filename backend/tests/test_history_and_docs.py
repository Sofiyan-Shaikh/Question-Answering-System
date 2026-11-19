"""Tests for User Task History and Client Document Vault"""
import sys
import os
import io
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.app.main import app
from backend.app.auth import create_access_token
from backend.app.services.document_service import document_service
from backend.app.services.history_service import history_service


@pytest.fixture
def auth_headers():
    token = create_access_token({"sub": "sofiyan"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client():
    return TestClient(app)


def test_document_and_history_lifecycle(client, auth_headers):
    """Test full lifecycle of document vault and task history"""
    # 1. Initially check stats
    res = client.get("/api/v1/history/stats", headers=auth_headers)
    assert res.status_code == 200
    stats = res.json()
    assert "total_tasks" in stats
    assert "total_documents" in stats

    # 2. Upload a test PDF document
    pdf_bytes = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF"
    upload_res = client.post(
        "/api/v1/documents/upload",
        files={"file": ("client_financials.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        headers=auth_headers
    )
    assert upload_res.status_code == 200
    doc = upload_res.json()
    doc_id = doc["id"]
    assert doc["filename"] == "client_financials.pdf"
    assert doc["user_id"] == "sofiyan"

    # 3. Retrieve document list
    doc_list_res = client.get("/api/v1/documents", headers=auth_headers)
    assert doc_list_res.status_code == 200
    docs = doc_list_res.json()["documents"]
    assert any(d["id"] == doc_id for d in docs)

    # 4. Download document
    dl_res = client.get(f"/api/v1/documents/{doc_id}/download", headers=auth_headers)
    assert dl_res.status_code == 200
    assert len(dl_res.content) == len(pdf_bytes)

    # 5. Check task history includes upload task
    history_res = client.get("/api/v1/history", headers=auth_headers)
    assert history_res.status_code == 200
    hist = history_res.json()["history"]
    assert len(hist) > 0

    # 6. Test manual task recording
    recorded = history_service.record_task(
        user_id="sofiyan",
        task_type="text_qa",
        question="What is extractive question answering?",
        answer="A technique to extract answer spans from context",
        confidence_score=0.92,
        execution_time_ms=35.0
    )
    assert recorded["id"].startswith("task_")

    # 7. Query history with search filter
    search_res = client.get("/api/v1/history?search=extractive", headers=auth_headers)
    assert search_res.status_code == 200
    search_items = search_res.json()["history"]
    assert len(search_items) >= 1
    assert "extractive" in search_items[0]["question"].lower() or "extractive" in search_items[0]["answer"].lower()

    # 8. Delete individual history item
    del_task_res = client.delete(f"/api/v1/history/{recorded['id']}", headers=auth_headers)
    assert del_task_res.status_code == 200

    # 9. Delete document from vault
    del_doc_res = client.delete(f"/api/v1/documents/{doc_id}", headers=auth_headers)
    assert del_doc_res.status_code == 200

    # Clean up test user history
    client.delete("/api/v1/history", headers=auth_headers)
