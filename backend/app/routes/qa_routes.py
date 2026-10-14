"""Question Answering routes"""
from fastapi import APIRouter, Depends, HTTPException
from ..schemas import QARequest, QAResponse
from ..services.predictor import predictor
from ..auth import get_current_user

router = APIRouter()


@router.post("/predict", response_model=QAResponse)
async def predict_answer(
    request: QARequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Primary inference endpoint
    Extract answer from context based on question
    Requires JWT authentication
    """
    try:
        result = predictor.predict(
            context=request.context,
            question=request.question,
            top_k=request.top_k or 1
        )
        return QAResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")
