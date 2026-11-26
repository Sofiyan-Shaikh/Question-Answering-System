"""JWT Authentication and Database User Management"""
import re
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import settings
from .db import get_db_connection, init_db

security = HTTPBearer()

DEFAULT_DEMO_USERS = [
    ("analyst", "analyst@qasystem.com", "password123", "analyst"),
    ("admin", "admin@qasystem.com", "password123", "admin"),
]


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    if not plain_password or not password_hash:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def _ensure_users_table_and_seed() -> None:
    """Ensure users table exists and seed default demo users if missing."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users';")
            if not cursor.fetchone():
                init_db()
    except Exception:
        init_db()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        for username, email, raw_pw, role in DEFAULT_DEMO_USERS:
            cursor.execute("SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1", (username, email))
            if not cursor.fetchone():
                cursor.execute(
                    """
                    INSERT INTO users (id, username, email, password_hash, role, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        f"usr_{uuid.uuid4().hex[:12]}",
                        username,
                        email,
                        hash_password(raw_pw),
                        role,
                        datetime.utcnow().isoformat() + "Z",
                    ),
                )


def register_user(email: str, password: str, username: Optional[str] = None) -> Dict[str, Any]:
    """Register a new user in the database and return the created user record."""
    _ensure_users_table_and_seed()

    clean_email = email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean_email):
        raise ValueError("Please enter a valid email address.")

    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")

    clean_username = (username or clean_email.split("@")[0]).strip().lower()
    clean_username = re.sub(r"[^\w.-]", "", clean_username) or "user"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1", (clean_email,))
        if cursor.fetchone():
            raise ValueError("An account with this email already exists.")

        # Ensure unique username if derived from email
        base_username = clean_username
        suffix = 1
        while True:
            cursor.execute("SELECT id FROM users WHERE LOWER(username) = ? LIMIT 1", (clean_username,))
            if not cursor.fetchone():
                break
            if username:
                raise ValueError("This username is already taken.")
            clean_username = f"{base_username}{suffix}"
            suffix += 1

        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        created_at = datetime.utcnow().isoformat() + "Z"
        cursor.execute(
            """
            INSERT INTO users (id, username, email, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, clean_username, clean_email, hash_password(password), "analyst", created_at),
        )

    return {
        "id": user_id,
        "username": clean_username,
        "email": clean_email,
        "role": "analyst",
        "created_at": created_at,
    }


def authenticate_user(identifier: str, password: str):
    """Authenticate a user by username or email against the database."""
    if not identifier or not password:
        return False
    _ensure_users_table_and_seed()

    clean_id = identifier.strip().lower()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1",
            (clean_id, clean_id),
        )
        row = cursor.fetchone()
        if row and verify_password(password, row["password_hash"]):
            return dict(row)
    return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta if expires_delta else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get the current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    _ensure_users_table_and_seed()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, email, role FROM users WHERE LOWER(username) = ? LIMIT 1", (username.lower(),))
        row = cursor.fetchone()
        if row:
            return dict(row)

    return {"username": username, "email": payload.get("email"), "role": payload.get("role", "analyst")}
