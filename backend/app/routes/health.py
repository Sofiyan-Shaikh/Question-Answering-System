"""Health check endpoint"""
from fastapi import APIRouter
from ..schemas import HealthResponse
from ..services.predictor import predictor
from ..config import settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    Returns operational health, GPU availability, and loaded model version
    """
    return HealthResponse(
        status="healthy",
        model_loaded=predictor.model_loaded,
        model_version=settings.MODEL_VERSION,
        device=settings.DEVICE
    )
