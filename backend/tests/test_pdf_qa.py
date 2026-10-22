import io
import sys
import os
import pytest
from pypdf import PdfWriter
from pypdf.generic import NameObject, DecodedStreamObject, DictionaryObject

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.pdf_service import pdf_service


def _create_sample_pdf(pages_text: list) -> bytes:
    """Helper to generate a minimal valid multi-page PDF in-memory using pypdf."""
    writer = PdfWriter()
    for text in pages_text:
        # Create a blank page
        page = writer.add_blank_page(width=612, height=792)
        # Add basic text content stream
        # PDF syntax: BT /F1 12 Tf 72 712 Td (escaped_text) Tj ET
        escaped_text = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        content_stream_data = f"BT /F1 12 Tf 72 712 Td ({escaped_text}) Tj ET".encode("utf-8")
        
        stream = DecodedStreamObject()
        stream.set_data(content_stream_data)
        
        font_dict = DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        })
        resources_dict = DictionaryObject({
            NameObject("/Font"): DictionaryObject({
                NameObject("/F1"): font_dict
            })
        })
        page[NameObject("/Resources")] = resources_dict
        page[NameObject("/Contents")] = stream

    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


@pytest.fixture
def sample_pdf_bytes():
    return _create_sample_pdf([
        "Apple Inc. was founded in 1976 by Steve Jobs, Steve Wozniak, and Ronald Wayne in California.",
        "Amazon was founded by Jeff Bezos in Bellevue, Washington on July 5, 1994.",
        "Microsoft Corporation was founded by Bill Gates and Paul Allen on April 4, 1975 in Albuquerque."
    ])


@pytest.fixture(scope="session", autouse=True)
def setup_predictor():
    """Ensure the predictor model is loaded for tests."""
    from backend.app.services.predictor import predictor
    if not predictor.model_loaded:
        predictor.load_model()


@pytest.fixture
def auth_headers(client):
    """Authenticate and obtain JWT token for protected route tests."""
    resp = client.post("/api/v1/auth/login", json={"username": "analyst", "password": "password123"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client



def test_pdf_extraction(sample_pdf_bytes):
    """Verify text is correctly extracted page-by-page."""
    pages = pdf_service.extract_pdf_pages(sample_pdf_bytes)
    assert len(pages) == 3
    assert pages[0]["page_number"] == 1
    assert "Steve Jobs" in pages[0]["text"]
    assert pages[1]["page_number"] == 2
    assert "Jeff Bezos" in pages[1]["text"]
    assert pages[2]["page_number"] == 3
    assert "Bill Gates" in pages[2]["text"]


def test_pdf_chunking_and_bm25_retrieval(sample_pdf_bytes):
    """Verify document chunking and BM25 candidate selection."""
    pages = pdf_service.extract_pdf_pages(sample_pdf_bytes)
    chunks = pdf_service.chunk_document(pages, chunk_size_words=50, overlap_words=10)
    assert len(chunks) >= 3

    # Query for Amazon -> should retrieve page 2 chunk as top candidate
    top_chunks = pdf_service.retrieve_top_chunks(chunks, "Who founded Amazon?", top_n=1)
    assert len(top_chunks) == 1
    assert top_chunks[0]["page_number"] == 2
    assert "Jeff Bezos" in top_chunks[0]["text"]


def test_pdf_service_qa(sample_pdf_bytes):
    """Verify end-to-end PDF question answering returns correct answer and page citation."""
    res = pdf_service.answer_question_from_pdf(
        file_bytes=sample_pdf_bytes,
        filename="companies.pdf",
        question="Who founded Amazon?",
        top_k=1
    )
    assert res["is_answerable"] is True
    assert "Jeff Bezos" in res["answer"]
    assert res["page_number"] == 2
    assert res["total_pages"] == 3
    assert "Bellevue" in res["matched_passage"]


def test_api_predict_pdf(client, auth_headers, sample_pdf_bytes):
    """Verify POST /api/v1/qa/predict-pdf endpoint."""
    files = {"file": ("tech_giants.pdf", sample_pdf_bytes, "application/pdf")}
    data = {"question": "Who founded Apple?", "top_k": 1}

    response = client.post("/api/v1/qa/predict-pdf", headers=auth_headers, files=files, data=data)
    assert response.status_code == 200
    res = response.json()
    assert res["is_answerable"] is True
    assert "Steve Jobs" in res["answer"]
    assert res["page_number"] == 1
    assert res["total_pages"] == 3
    assert res["filename"] == "tech_giants.pdf"


def test_api_extract_pdf_text(client, auth_headers, sample_pdf_bytes):
    """Verify POST /api/v1/qa/extract-pdf-text endpoint."""
    files = {"file": ("tech_giants.pdf", sample_pdf_bytes, "application/pdf")}

    response = client.post("/api/v1/qa/extract-pdf-text", headers=auth_headers, files=files)
    assert response.status_code == 200
    res = response.json()
    assert res["total_pages"] == 3
    assert "--- Page 1 ---" in res["text"]
    assert len(res["pages"]) == 3


def test_api_predict_pdf_invalid_extension(client, auth_headers):
    """Verify rejection of non-PDF files."""
    files = {"file": ("data.txt", b"plain text", "text/plain")}
    data = {"question": "What is this?"}

    response = client.post("/api/v1/qa/predict-pdf", headers=auth_headers, files=files, data=data)
    assert response.status_code == 400
    assert "Uploaded file must be a PDF" in response.json()["detail"]


def test_api_predict_pdf_empty_file(client, auth_headers):
    """Verify rejection of empty PDF files."""
    files = {"file": ("empty.pdf", b"", "application/pdf")}
    data = {"question": "What is this?"}

    response = client.post("/api/v1/qa/predict-pdf", headers=auth_headers, files=files, data=data)
    assert response.status_code == 400
