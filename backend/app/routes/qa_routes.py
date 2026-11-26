"""Question Answering routes with automated document vault and task history recording"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from ..schemas import QARequest, QAResponse, PDFQAResponse, DocumentQARequest, PDFExtractResponse, PDFPageData
from ..services.predictor import predictor
from ..services.pdf_service import pdf_service
from ..services.document_service import document_service
from ..services.history_service import history_service
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
    Requires JWT authentication and automatically records task in user history
    """
    try:
        result = predictor.predict(
            context=request.context,
            question=request.question,
            top_k=request.top_k or 1
        )

        # Automatically preserve task execution in history
        user_id = current_user.get("username", "user")
        try:
            history_service.record_task(
                user_id=user_id,
                session_id=request.session_id,
                task_type="text_qa",
                question=request.question,
                context_preview=request.context,
                answer=result.get("answer"),
                descriptive_answer=result.get("descriptive_answer"),
                is_answerable=result.get("is_answerable", True),
                confidence_score=result.get("confidence_score", 0.0),
                citations=result.get("answers"),
                execution_time_ms=result.get("execution_time_ms", 0.0)
            )
        except Exception as log_err:
            print(f"Warning: Failed to record task history: {log_err}")

        return QAResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@router.post("/predict-pdf", response_model=PDFQAResponse)
async def predict_pdf_answer(
    file: UploadFile = File(...),
    question: str = Form(...),
    top_k: Optional[int] = Form(1),
    session_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    PDF Document Question Answering endpoint
    Extracts text page-by-page, retrieves candidate sections via BM25,
    runs BERT QA to identify answer span, preserves the client document in the vault,
    and logs the task in the user history.
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

        user_id = current_user.get("username", "user")

        # 1. Preserve client document in document vault
        doc_id = None
        try:
            doc_record = document_service.save_document(
                user_id=user_id,
                filename=file.filename,
                file_bytes=file_bytes,
                page_count=result.get("total_pages", 1)
            )
            doc_id = doc_record.get("id")
        except Exception as doc_err:
            print(f"Warning: Failed to store document in vault: {doc_err}")

        # 2. Record task in user history under same session
        try:
            history_service.record_task(
                user_id=user_id,
                session_id=session_id,
                task_type="pdf_qa",
                document_id=doc_id,
                document_name=file.filename,
                question=question.strip(),
                context_preview=result.get("matched_passage"),
                answer=result.get("answer"),
                descriptive_answer=result.get("descriptive_answer"),
                is_answerable=result.get("is_answerable", True),
                confidence_score=result.get("confidence_score", 0.0),
                page_number=result.get("page_number"),
                citations=result.get("answers"),
                execution_time_ms=result.get("execution_time_ms", 0.0)
            )
        except Exception as log_err:
            print(f"Warning: Failed to record PDF QA history: {log_err}")

        return PDFQAResponse(**result, document_id=doc_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF prediction error: {str(e)}")


@router.post("/predict-document", response_model=PDFQAResponse)
async def predict_document_answer(
    request: DocumentQARequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Answer a follow-up question on an already-uploaded PDF document by document_id
    without re-uploading the file.
    """
    user_id = current_user.get("username", "user")
    doc = document_service.get_document(request.document_id, user_id=user_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_bytes = document_service.get_document_bytes(doc)
    if not file_bytes:
        raise HTTPException(status_code=404, detail="Document file is missing from storage")

    try:
        result = pdf_service.answer_question_from_pdf(
            file_bytes=file_bytes,
            filename=doc["filename"],
            question=request.question.strip(),
            top_k=request.top_k or 1,
        )

        try:
            history_service.record_task(
                user_id=user_id,
                session_id=request.session_id,
                task_type="pdf_qa",
                document_id=request.document_id,
                document_name=doc["filename"],
                question=request.question.strip(),
                context_preview=result.get("matched_passage"),
                answer=result.get("answer"),
                descriptive_answer=result.get("descriptive_answer"),
                is_answerable=result.get("is_answerable", True),
                confidence_score=result.get("confidence_score", 0.0),
                page_number=result.get("page_number"),
                citations=result.get("answers"),
                execution_time_ms=result.get("execution_time_ms", 0.0),
            )
        except Exception as log_err:
            print(f"Warning: Failed to record document QA history: {log_err}")

        return PDFQAResponse(**result, document_id=request.document_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document prediction error: {str(e)}")


@router.post("/extract-pdf-text", response_model=PDFExtractResponse)
async def extract_pdf_text(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Extract text from uploaded PDF for direct inspection or loading into context editor.
    Automatically preserves client document in vault and records extraction task in history.
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

        user_id = current_user.get("username", "user")

        # 1. Preserve client document in document vault
        doc_id = None
        try:
            doc_record = document_service.save_document(
                user_id=user_id,
                filename=file.filename,
                file_bytes=file_bytes,
                page_count=len(pages)
            )
            doc_id = doc_record.get("id")
        except Exception as doc_err:
            print(f"Warning: Failed to store document in vault: {doc_err}")

        # 2. Record extraction task in history
        try:
            history_service.record_task(
                user_id=user_id,
                task_type="pdf_extract",
                document_id=doc_id,
                document_name=file.filename,
                question=f"Document Text Extraction: {file.filename}",
                context_preview=combined_text[:400] if combined_text else "",
                answer=f"Extracted {len(pages)} pages with {len(combined_text)} characters",
                is_answerable=True,
                confidence_score=1.0,
                page_number=1,
                execution_time_ms=0.0
            )
        except Exception as log_err:
            print(f"Warning: Failed to record extract task history: {log_err}")

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
