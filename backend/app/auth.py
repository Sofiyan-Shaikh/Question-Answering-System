"""JWT Authentication utilities - Simplified version"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import settings

security = HTTPBearer()

# Simple mock users for development/demo
MOCK_USERS = {
    "analyst": {
        "username": "analyst",
        "email": "analyst@qasystem.com",
        "passwords": ["password123", "password", "analyst"],
        "password": "password123",
        "role": "analyst"
    },
    "admin": {
        "username": "admin",
        "email": "admin@qasystem.com",
        "passwords": ["password123", "admin", "password"],
        "password": "password123",
        "role": "admin"
    },
    "sofiyan": {
        "username": "sofiyan",
        "email": "sofiyan@qasystem.com",
        "passwords": ["password123", "sofiyan", "admin", "password"],
        "password": "password123",
        "role": "admin"
    },
    "sofiyanshaikh": {
        "username": "sofiyanshaikh",
        "email": "sofiyanshaikh@qasystem.com",
        "passwords": ["password123", "sofiyan", "admin", "password"],
        "password": "password123",
        "role": "admin"
    },
    "user": {
        "username": "user",
        "email": "user@qasystem.com",
        "passwords": ["password123", "user", "password"],
        "password": "password123",
        "role": "analyst"
    }
}

def verify_password(plain_password: str, user_record: dict) -> bool:
    """Verify password with case and whitespace resilience"""
    if not plain_password:
        return False
    p_clean = plain_password.strip()
    valid_passwords = user_record.get("passwords", [user_record.get("password")])
    for valid_p in valid_passwords:
        if p_clean == valid_p or p_clean.lower() == valid_p.lower():
            return True
    return False

def authenticate_user(identifier: str, password: str):
    """Authenticate a user by username or email"""
    if not identifier:
        return False
    clean_id = identifier.strip().lower()
    user = MOCK_USERS.get(clean_id)
    if user is None and "@" in clean_id:
        user = next(
            (record for record in MOCK_USERS.values() if record.get("email") == clean_id),
            None,
        )
    if user and verify_password(password, user):
        return user
    return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get the current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = MOCK_USERS.get(username.lower())
    if user is None:
        user = {"username": username, "role": "analyst"}
    return user
