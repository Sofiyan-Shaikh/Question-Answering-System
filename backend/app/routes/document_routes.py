"""Document Vault API routes"""
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from ..schemas import DocumentListResponse, DocumentItem
from ..services.document_service import document_service
from ..services.history_service import history_service
from ..auth import get_current_user

router = APIRouter()


@router.get("", response_model=DocumentListResponse)
async def list_user_documents(
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    current_user: dict = Depends(get_current_user)
):
    """
    List all client documents preserved in the vault for the authenticated user.
    Includes count of QA tasks performed against each document.
    """
    user_id = current_user.get("username", "user")
    docs, total = document_service.list_documents(user_id=user_id, limit=limit, offset=offset)
    return DocumentListResponse(
        documents=[DocumentItem(**d) for d in docs],
        total=total,
        limit=limit,
        offset=offset
    )


@router.post("/upload", response_model=DocumentItem)
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Directly upload a client document into the user's document vault.
    Supports PDF files.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF (.pdf)")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    user_id = current_user.get("username", "user")
    doc_record = document_service.save_document(
        user_id=user_id,
        filename=file.filename,
        file_bytes=file_bytes
    )

    # Also log a vault document upload task into history
    history_service.record_task(
        user_id=user_id,
        task_type="document_upload",
        document_id=doc_record["id"],
        document_name=doc_record["filename"],
        question=f"Vault Upload: {doc_record['filename']}",
        answer=f"Stored successfully ({round(doc_record['file_size'] / 1024, 1)} KB, {doc_record['page_count']} pages)",
        is_answerable=True,
        confidence_score=1.0,
        page_number=1,
        execution_time_ms=0.0
    )

    return DocumentItem(**doc_record)


@router.get("/{doc_id}", response_model=DocumentItem)
async def get_document_details(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get metadata for a specific client document.
    """
    user_id = current_user.get("username", "user")
    doc = document_service.get_document(doc_id=doc_id, user_id=user_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentItem(**doc)


@router.get("/{doc_id}/download")
async def download_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Stream/download original client document file from vault storage.
    """
    user_id = current_user.get("username", "user")
    doc = document_service.get_document(doc_id=doc_id, user_id=user_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    storage_path = doc.get("storage_path")
    if not storage_path or not os.path.exists(storage_path):
        raise HTTPException(status_code=404, detail="Physical document file missing from storage")

    return FileResponse(
        path=storage_path,
        filename=doc["filename"],
        media_type=doc.get("mime_type", "application/pdf")
    )


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete client document from database vault and remove physical file from disk.
    """
    user_id = current_user.get("username", "user")
    deleted = document_service.delete_document(doc_id=doc_id, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found or already deleted")

    return {"success": True, "message": "Document removed from vault", "id": doc_id}
