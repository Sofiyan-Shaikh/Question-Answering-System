"""Authentication routes"""
from datetime import timedelta
from fastapi import APIRouter, HTTPException, status
from ..schemas import LoginRequest, Token
from ..auth import authenticate_user, create_access_token
from ..config import settings

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(request: LoginRequest):
    """
    Authenticate user and return JWT bearer token
    """
    user = authenticate_user(request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer")
