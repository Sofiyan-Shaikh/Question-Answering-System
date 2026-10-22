"""Question Answering routes"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from ..schemas import QARequest, QAResponse, PDFQAResponse, PDFExtractResponse, PDFPageData
from ..services.predictor import predictor
from ..services.pdf_service import pdf_service
from ..auth import get_current_user

router = APIRouter()


@router.post("/predict", response_model=QAResponse)
async def predict_answer(
    request: QARequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Primary inference endpoint
    Extract answer from context based on question
    Requires JWT authentication
    """
    try:
        result = predictor.predict(
            context=request.context,
            question=request.question,
            top_k=request.top_k or 1
        )
        return QAResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@router.post("/predict-pdf", response_model=PDFQAResponse)
async def predict_pdf_answer(
    file: UploadFile = File(...),
    question: str = Form(...),
    top_k: Optional[int] = Form(1),
    current_user: dict = Depends(get_current_user)
):
    """
    PDF Document Question Answering endpoint
    Extracts text page-by-page, retrieves candidate sections via BM25,
    and runs BERT QA to identify answer span and source page citation.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF (.pdf)")

    try:
        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded PDF file is empty")

        result = pdf_service.answer_question_from_pdf(
            file_bytes=file_bytes,
            filename=file.filename,
            question=question.strip(),
            top_k=top_k or 1
        )
        return PDFQAResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF prediction error: {str(e)}")


@router.post("/extract-pdf-text", response_model=PDFExtractResponse)
async def extract_pdf_text(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Extract text from uploaded PDF for direct inspection or loading into context editor.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF (.pdf)")

    try:
        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded PDF file is empty")

        pages = pdf_service.extract_pdf_pages(file_bytes)
        combined_text = "\n\n".join(
            f"--- Page {p['page_number']} ---\n{p['text']}" for p in pages if p['text']
        )
        pages_models = [
            PDFPageData(
                page_number=p["page_number"],
                text=p["text"],
                char_count=p["char_count"]
            )
            for p in pages
        ]
        return PDFExtractResponse(
            filename=file.filename,
            total_pages=len(pages),
            text=combined_text,
            pages=pages_models
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction error: {str(e)}")

