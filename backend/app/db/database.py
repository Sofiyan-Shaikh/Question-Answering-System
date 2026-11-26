"""Database session and schema initialization"""
import os
import sqlite3
from contextlib import contextmanager
from typing import Generator
from ..config import settings


def ensure_directories():
    """Ensure data and upload directories exist"""
    os.makedirs(settings.DATA_DIR, exist_ok=True)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


def get_db_path() -> str:
    """Return resolved SQLite database path"""
    ensure_directories()
    return settings.DATABASE_PATH


@contextmanager
def get_db_connection() -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager providing a SQLite database connection with row factory
    and WAL journal mode for concurrent read/write support.
    """
    db_path = get_db_path()
    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize database tables and indexes if they do not exist"""
    ensure_directories()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # ── Users Table ────────────────────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'analyst',
                created_at TEXT NOT NULL
            );
        """)

        # ── Documents Vault Table ──────────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                storage_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                mime_type TEXT DEFAULT 'application/pdf',
                sha256 TEXT,
                page_count INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            );
        """)

        # ── User Task History Table ────────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS task_history (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                session_id TEXT,
                task_type TEXT NOT NULL, -- 'text_qa', 'pdf_qa', 'pdf_extract'
                document_id TEXT,
                document_name TEXT,
                question TEXT,
                context_preview TEXT,
                answer TEXT,
                descriptive_answer TEXT,
                is_answerable INTEGER DEFAULT 1,
                confidence_score REAL DEFAULT 0.0,
                page_number INTEGER,
                citations_json TEXT,
                execution_time_ms REAL DEFAULT 0.0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
            );
        """)

        # Migration: ensure session_id exists if table was created earlier
        cursor.execute("PRAGMA table_info(task_history);")
        columns = [row["name"] for row in cursor.fetchall()]
        if "session_id" not in columns:
            cursor.execute("ALTER TABLE task_history ADD COLUMN session_id TEXT;")

        # ── Indexes for high-performance querying ──────────────────────────────
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_docs_user_created ON documents (user_id, created_at DESC);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_docs_sha256 ON documents (sha256);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_user_created ON task_history (user_id, created_at DESC);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_task_type ON task_history (task_type);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_doc_id ON task_history (document_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_session_id ON task_history (session_id);")

        conn.commit()
    print("Database initialized successfully at", settings.DATABASE_PATH)
