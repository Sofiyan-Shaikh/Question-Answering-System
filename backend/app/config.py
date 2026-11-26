"""Configuration settings for the QA System"""
from typing import Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings"""
    
    # API Configuration
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Question Answering System"
    VERSION: str = "1.0.0"
    
    # Model Configuration
    MODEL_NAME: str = "qa_model.pkl"
    BASE_MODEL_NAME: str = "bert-base-uncased"
    MODEL_VERSION: str = "qa-model-pkl"
    MAX_LENGTH: int = 512
    DOC_STRIDE: int = 128
    
    # Authentication
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # OTP Verification Settings
    OTP_EXPIRE_SECONDS: int = 300       # 5 minutes validity
    OTP_COOLDOWN_SECONDS: int = 60      # 1 minute between resends
    OTP_MAX_ATTEMPTS: int = 3           # Max failed verification tries
    DEV_SHOW_OTP: bool = True           # Return/log OTP for local dev testing
    
    # Transactional Email Settings (Resend or SMTP)
    RESEND_API_KEY: str = ""            # Resend API key (https://resend.com)
    SMTP_HOST: str = ""                 # e.g., smtp.gmail.com or email-smtp.us-east-1.amazonaws.com
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@qasystem.com"
    SMTP_FROM_NAME: str = "QA Intelligence Engine"
    SMTP_USE_TLS: bool = True
    
    # CORS
    FRONTEND_URL: str = ""
    BACKEND_CORS_ORIGINS: Union[list[str], str] = ["http://localhost:3000", "http://localhost:8000"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip().rstrip("/") for origin in v.split(",") if origin.strip()]
        return v
    
    # Device Configuration
    DEVICE: str = "cpu"  # Can be changed to "cuda" if GPU available
    
    # Null Threshold for unanswerable detection
    NULL_THRESHOLD: float = -2.35
    
    # Storage & History Database Configuration
    DATA_DIR: str = "./data"
    UPLOAD_DIR: str = "./data/uploads"
    DATABASE_PATH: str = "./data/qa_system.db"
    DATABASE_URL: str = ""  # If set, can point to postgresql://user:pass@host/dbname
    
    model_config = SettingsConfigDict(
        env_file=("backend/.env", ".env"),
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
