"""Authentication routes"""
from datetime import timedelta
from fastapi import APIRouter, HTTPException, status
from ..schemas import LoginRequest, SendOTPRequest, SendOTPResponse, VerifyOTPRequest, Token
from ..auth import authenticate_user, create_access_token
from ..services.otp_service import otp_service
from ..config import settings

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(request: LoginRequest):
    """
    Authenticate user with username/password and return JWT bearer token
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
    
    return Token(access_token=access_token, token_type="bearer", username=user["username"])


@router.post("/send-otp", response_model=SendOTPResponse)
async def send_otp(request: SendOTPRequest):
    """
    Generate and dispatch a 6-digit one-time password to the specified email
    """
    success, message, dev_otp, expires_in, cooldown = otp_service.request_otp(request.email)
    if not success:
        status_code = status.HTTP_429_TOO_MANY_REQUESTS if cooldown > 0 else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=message,
        )
    
    return SendOTPResponse(
        success=True,
        message=message,
        email=request.email.strip().lower(),
        expires_in_seconds=expires_in,
        cooldown_seconds=cooldown,
        dev_otp=dev_otp
    )


@router.post("/verify-otp", response_model=Token)
async def verify_otp(request: VerifyOTPRequest):
    """
    Verify submitted 6-digit OTP code and issue a JWT authentication bearer token
    """
    clean_email = request.email.strip().lower()
    is_valid, message = otp_service.verify_otp(clean_email, request.otp)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )
    
    # Derive display username from email
    username = clean_email.split("@")[0]
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": username, "email": clean_email, "role": "analyst"},
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        email=clean_email,
        username=username
    )

