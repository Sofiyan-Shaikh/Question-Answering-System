"""User task history management service with session support for grouping questions on the same passage"""
import hashlib
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any

from ..db import get_db_connection


class HistoryService:
    """Service to record, query, and manage all user task executions."""

    @staticmethod
    def derive_session_id(
        session_id: Optional[str] = None,
        document_id: Optional[str] = None,
        context_preview: Optional[str] = None
    ) -> str:
        """Derive or reuse a stable session ID for the same passage or document"""
        if session_id and session_id.strip():
            return session_id.strip()
        if document_id and document_id.strip():
            return f"sess_doc_{document_id.strip()}"
        if context_preview and context_preview.strip():
            norm = context_preview.strip()[:150].lower()
            h = hashlib.sha256(norm.encode('utf-8')).hexdigest()[:12]
            return f"sess_txt_{h}"
        return f"sess_{uuid.uuid4().hex[:12]}"

    def record_task(
        self,
        user_id: str,
        task_type: str,
        session_id: Optional[str] = None,
        question: Optional[str] = None,
        context_preview: Optional[str] = None,
        answer: Optional[str] = None,
        descriptive_answer: Optional[str] = None,
        is_answerable: bool = True,
        confidence_score: float = 0.0,
        page_number: Optional[int] = None,
        citations: Optional[Any] = None,
        execution_time_ms: float = 0.0,
        document_id: Optional[str] = None,
        document_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Record a completed user task/query into history under a session"""
        history_id = f"task_{uuid.uuid4().hex[:12]}"
        created_at = datetime.utcnow().isoformat() + "Z"
        resolved_session_id = self.derive_session_id(session_id, document_id, context_preview)

        # Store the complete passage context in full without truncation
        stored_context = context_preview.strip() if context_preview else None

        citations_json = None
        if citations is not None:
            try:
                citations_json = json.dumps(citations)
            except Exception:
                citations_json = None

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO task_history (
                    id, user_id, session_id, task_type, document_id, document_name,
                    question, context_preview, answer, descriptive_answer,
                    is_answerable, confidence_score, page_number,
                    citations_json, execution_time_ms, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    history_id, user_id, resolved_session_id, task_type, document_id, document_name,
                    question, stored_context, answer, descriptive_answer,
                    1 if is_answerable else 0, float(confidence_score), page_number,
                    citations_json, float(execution_time_ms), created_at
                )
            )

        return {
            "id": history_id,
            "user_id": user_id,
            "session_id": resolved_session_id,
            "task_type": task_type,
            "document_id": document_id,
            "document_name": document_name,
            "question": question,
            "context_preview": stored_context,
            "answer": answer,
            "descriptive_answer": descriptive_answer,
            "is_answerable": is_answerable,
            "confidence_score": confidence_score,
            "page_number": page_number,
            "citations": citations,
            "execution_time_ms": execution_time_ms,
            "created_at": created_at
        }

    def list_history(
        self,
        user_id: str,
        task_type: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Query user task history with optional task_type and text search filters"""
        where_clauses = ["user_id = ?"]
        params: List[Any] = [user_id]

        if task_type and task_type != "all":
            where_clauses.append("task_type = ?")
            params.append(task_type)

        if search and search.strip():
            search_pattern = f"%{search.strip()}%"
            where_clauses.append(
                "(question LIKE ? OR answer LIKE ? OR document_name LIKE ? OR descriptive_answer LIKE ?)"
            )
            params.extend([search_pattern, search_pattern, search_pattern, search_pattern])

        where_sql = " AND ".join(where_clauses)

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Count total matching rows
            cursor.execute(f"SELECT COUNT(*) as count FROM task_history WHERE {where_sql}", params)
            total = cursor.fetchone()["count"]

            # Query rows with limit & offset
            query_sql = f"""
                SELECT * FROM task_history
                WHERE {where_sql}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """
            cursor.execute(query_sql, params + [limit, offset])
            rows = cursor.fetchall()

            results = []
            for r in rows:
                item = dict(r)
                if item.get("citations_json"):
                    try:
                        item["citations"] = json.loads(item["citations_json"])
                    except Exception:
                        item["citations"] = None
                else:
                    item["citations"] = None
                item["is_answerable"] = bool(item.get("is_answerable", 1))
                results.append(item)

            return results, total

    def list_sessions(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Group tasks by session_id (same passage or document).
        Returns a single tab per passage with message count and latest update.
        """
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Count distinct sessions
            cursor.execute(
                """
                SELECT COUNT(DISTINCT COALESCE(session_id, id)) as count
                FROM task_history
                WHERE user_id = ?
                """,
                (user_id,)
            )
            total = cursor.fetchone()["count"]

            # Query grouped sessions
            cursor.execute(
                """
                SELECT
                    COALESCE(session_id, id) as session_id,
                    COUNT(*) as messages_count,
                    MAX(created_at) as updated_at,
                    MIN(created_at) as created_at,
                    MAX(task_type) as task_type,
                    MAX(document_id) as document_id,
                    MAX(document_name) as document_name,
                    MAX(context_preview) as context_preview,
                    (SELECT question FROM task_history t2 WHERE COALESCE(t2.session_id, t2.id) = COALESCE(t1.session_id, t1.id) AND t2.user_id = t1.user_id ORDER BY t2.created_at DESC LIMIT 1) as latest_question,
                    (SELECT answer FROM task_history t2 WHERE COALESCE(t2.session_id, t2.id) = COALESCE(t1.session_id, t1.id) AND t2.user_id = t1.user_id ORDER BY t2.created_at DESC LIMIT 1) as latest_answer,
                    (SELECT confidence_score FROM task_history t2 WHERE COALESCE(t2.session_id, t2.id) = COALESCE(t1.session_id, t1.id) AND t2.user_id = t1.user_id ORDER BY t2.created_at DESC LIMIT 1) as latest_confidence,
                    (SELECT question FROM task_history t2 WHERE COALESCE(t2.session_id, t2.id) = COALESCE(t1.session_id, t1.id) AND t2.user_id = t1.user_id ORDER BY t2.created_at ASC LIMIT 1) as first_question
                FROM task_history t1
                WHERE user_id = ?
                GROUP BY COALESCE(session_id, id)
                ORDER BY updated_at DESC
                LIMIT ? OFFSET ?
                """,
                (user_id, limit, offset)
            )
            rows = cursor.fetchall()

            sessions = []
            for r in rows:
                item = dict(r)
                # Build human-friendly title for the passage tab
                if item.get("document_name"):
                    title = item["document_name"]
                elif item.get("first_question"):
                    title = item["first_question"]
                elif item.get("context_preview"):
                    ctx = item["context_preview"].strip()
                    title = (ctx[:50] + "...") if len(ctx) > 50 else ctx
                else:
                    title = "Passage Q&A Session"

                item["title"] = title
                item["latest_confidence"] = float(item.get("latest_confidence") or 0.0)
                sessions.append(item)

            return sessions, total

    def get_session_tasks(self, session_id: str, user_id: str) -> List[Dict[str, Any]]:
        """Retrieve all Q&A messages in chronological order for a passage session"""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM task_history
                WHERE (session_id = ? OR id = ?) AND user_id = ?
                ORDER BY created_at ASC
                """,
                (session_id, session_id, user_id)
            )
            rows = cursor.fetchall()
            results = []
            for r in rows:
                item = dict(r)
                if item.get("citations_json"):
                    try:
                        item["citations"] = json.loads(item["citations_json"])
                    except Exception:
                        item["citations"] = None
                else:
                    item["citations"] = None
                item["is_answerable"] = bool(item.get("is_answerable", 1))
                results.append(item)
            return results

    def delete_session(self, session_id: str, user_id: str) -> bool:
        """Delete an entire passage session and all its questions"""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM task_history WHERE (session_id = ? OR id = ?) AND user_id = ?",
                (session_id, session_id, user_id)
            )
            return cursor.rowcount > 0

    def get_history_item(self, history_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve single task history item"""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM task_history WHERE id = ? AND user_id = ? LIMIT 1",
                (history_id, user_id)
            )
            row = cursor.fetchone()
            if not row:
                return None
            item = dict(row)
            if item.get("citations_json"):
                try:
                    item["citations"] = json.loads(item["citations_json"])
                except Exception:
                    item["citations"] = None
            item["is_answerable"] = bool(item.get("is_answerable", 1))
            return item

    def delete_history_item(self, history_id: str, user_id: str) -> bool:
        """Delete specific task history record"""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM task_history WHERE id = ? AND user_id = ?",
                (history_id, user_id)
            )
            return cursor.rowcount > 0

    def clear_user_history(self, user_id: str) -> int:
        """Clear all task history records for a user"""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM task_history WHERE user_id = ?", (user_id,))
            return cursor.rowcount

    def get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """Aggregate summary metrics for user's history and documents"""
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Tasks breakdown
            cursor.execute(
                """
                SELECT
                    COUNT(*) as total_tasks,
                    SUM(CASE WHEN task_type = 'text_qa' THEN 1 ELSE 0 END) as text_qa_count,
                    SUM(CASE WHEN task_type = 'pdf_qa' THEN 1 ELSE 0 END) as pdf_qa_count,
                    SUM(CASE WHEN task_type = 'pdf_extract' THEN 1 ELSE 0 END) as pdf_extract_count,
                    AVG(confidence_score) as avg_confidence,
                    MAX(created_at) as latest_task_at
                FROM task_history
                WHERE user_id = ?
                """,
                (user_id,)
            )
            task_stats = dict(cursor.fetchone())

            # Document count
            cursor.execute("SELECT COUNT(*) as doc_count FROM documents WHERE user_id = ?", (user_id,))
            doc_count = cursor.fetchone()["doc_count"]

            return {
                "total_tasks": task_stats.get("total_tasks") or 0,
                "text_qa_count": task_stats.get("text_qa_count") or 0,
                "pdf_qa_count": task_stats.get("pdf_qa_count") or 0,
                "pdf_extract_count": task_stats.get("pdf_extract_count") or 0,
                "avg_confidence": round(task_stats.get("avg_confidence") or 0.0, 4),
                "total_documents": doc_count,
                "latest_task_at": task_stats.get("latest_task_at")
            }


history_service = HistoryService()
