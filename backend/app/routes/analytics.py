"""Analytics and metrics routes"""
from fastapi import APIRouter, Depends
from ..schemas import MetricsResponse
from ..auth import get_current_user
from ..config import settings

router = APIRouter()


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(current_user: dict = Depends(get_current_user)):
    """
    Returns benchmark evaluation metrics evaluated against the SQuAD 2.0 dev set
    Note: These are placeholder values. Replace with actual evaluation results.
    """
    return MetricsResponse(
        dataset="SQuAD 2.0 Official Dev Split",
        exact_match=72.4,
        f1_score=75.8,
        null_threshold=settings.NULL_THRESHOLD,
        total_samples=11873
    )
