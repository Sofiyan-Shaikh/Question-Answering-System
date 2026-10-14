"""Configuration settings for the QA System"""
from pydantic_settings import BaseSettings


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
    
    # CORS
    BACKEND_CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:8000"]
    
    # Device Configuration
    DEVICE: str = "cpu"  # Can be changed to "cuda" if GPU available
    
    # Null Threshold for unanswerable detection
    NULL_THRESHOLD: float = -2.35
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
