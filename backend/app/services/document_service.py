"""Document storage and management service"""
import hashlib
import io
import os
import re
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from pypdf import PdfReader

from ..config import settings
from ..db import get_db_connection


class DocumentService:
    """Service to persist, retrieve, and manage client documents in local storage and database."""

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        """Strip dangerous path characters and normalize filename"""
        cleaned = re.sub(r"[^\w\s\.-]", "_", filename).strip()
        return cleaned or "document.pdf"

    @staticmethod
    def _calculate_sha256(file_bytes: bytes) -> str:
        """Calculate SHA256 checksum of file bytes"""
        hasher = hashlib.sha256()
        hasher.update(file_bytes)
        return hasher.hexdigest()

    @staticmethod
    def _get_pdf_page_count(file_bytes: bytes) -> int:
        """Extract page count from PDF bytes"""
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            return len(reader.pages)
        except Exception:
            return 1

    def save_document(
        self,
        user_id: str,
        filename: str,
        file_bytes: bytes,
        page_count: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Store client document on disk and record metadata in database.
        Detects duplicates by SHA-256 for the same user.
        """
        sha256_hash = self._calculate_sha256(file_bytes)
        safe_name = self._sanitize_filename(filename)
        mime_type = "application/pdf" if safe_name.lower().endswith(".pdf") else "application/octet-stream"

        if page_count is None and mime_type == "application/pdf":
            page_count = self._get_pdf_page_count(file_bytes)
        page_count = page_count or 1

        # Check if identical document was already saved by this user
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM documents WHERE user_id = ? AND sha256 = ? LIMIT 1",
                (user_id, sha256_hash)
            )
            existing = cursor.fetchone()
            if existing:
                # If file exists on disk, reuse it
                if os.path.exists(existing["storage_path"]):
                    return dict(existing)

        # Generate unique document ID and storage path
        doc_id = f"doc_{uuid.uuid4().hex[:12]}"
        user_dir = os.path.join(settings.UPLOAD_DIR, user_id)
        os.makedirs(user_dir, exist_ok=True)
        storage_filename = f"{doc_id}_{safe_name}"
        storage_path = os.path.join(user_dir, storage_filename)

        # Write file bytes to disk
        with open(storage_path, "wb") as f:
            f.write(file_bytes)

        file_size = len(file_bytes)
        created_at = datetime.utcnow().isoformat() + "Z"

        # Record in database
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO documents (
                    id, user_id, filename, storage_path, file_size,
                    mime_type, sha256, page_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (doc_id, user_id, safe_name, storage_path, file_size,
                 mime_type, sha256_hash, page_count, created_at)
            )

        return {
            "id": doc_id,
            "user_id": user_id,
            "filename": safe_name,
            "storage_path": storage_path,
            "file_size": file_size,
            "mime_type": mime_type,
            "sha256": sha256_hash,
            "page_count": page_count,
            "created_at": created_at
        }

    def get_document(self, doc_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Retrieve document record by ID (scoped to user if user_id is provided)"""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute(
                    "SELECT * FROM documents WHERE id = ? AND user_id = ? LIMIT 1",
                    (doc_id, user_id)
                )
            else:
                cursor.execute("SELECT * FROM documents WHERE id = ? LIMIT 1", (doc_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_documents(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        List all client documents uploaded by a user, including the number
        of QA tasks executed on each document.
        """
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Get total count
            cursor.execute("SELECT COUNT(*) as count FROM documents WHERE user_id = ?", (user_id,))
            total = cursor.fetchone()["count"]

            # Query documents with task count
            cursor.execute(
                """
                SELECT d.*, COUNT(t.id) as task_count
                FROM documents d
                LEFT JOIN task_history t ON d.id = t.document_id
                WHERE d.user_id = ?
                GROUP BY d.id
                ORDER BY d.created_at DESC
                LIMIT ? OFFSET ?
                """,
                (user_id, limit, offset)
            )
            rows = [dict(r) for r in cursor.fetchall()]

            return rows, total

    def delete_document(self, doc_id: str, user_id: str) -> bool:
        """Delete document record from database and purge file from disk"""
        doc = self.get_document(doc_id, user_id)
        if not doc:
            return False

        # Remove file from disk if present
        if doc.get("storage_path") and os.path.exists(doc["storage_path"]):
            try:
                os.remove(doc["storage_path"])
            except OSError:
                pass

        # Remove from database (task_history references will be set to NULL via foreign key)
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id))

        return True


document_service = DocumentService()
