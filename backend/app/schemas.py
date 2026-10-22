"""Pydantic schemas for request/response validation"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class AnswerSpan(BaseModel):
    """Individual extracted answer span schema"""
    answer: str = Field(..., description="Extracted answer span text")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    start_char: int = Field(..., description="Start character index in context")
    end_char: int = Field(..., description="End character index in context")
    sub_question: Optional[str] = Field(default=None, description="Corresponding sub-question if decomposed")


class QARequest(BaseModel):
    """Question Answering request schema"""
    context: str = Field(..., min_length=1, max_length=10000, description="Context passage")
    question: str = Field(..., min_length=1, max_length=500, description="Question to answer")
    top_k: Optional[int] = Field(default=1, ge=1, le=10, description="Maximum number of distinct answers to return")
    
    class Config:
        json_schema_extra = {
            "example": {
                "context": "SQuAD 2.0 combines the 100,000 questions in SQuAD 1.1 with over 50,000 unanswerable questions written adversarially by crowdworkers.",
                "question": "How many unanswerable questions are in SQuAD 2.0?",
                "top_k": 1
            }
        }


class QAResponse(BaseModel):
    """Question Answering response schema"""
    answer: str = Field(..., description="Primary extracted answer or joined answers if multi-answer")
    answers: Optional[List[AnswerSpan]] = Field(default=None, description="All extracted distinct answer spans")
    is_answerable: bool = Field(..., description="Whether the question can be answered")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    start_char: int = Field(..., description="Start character index in context")
    end_char: int = Field(..., description="End character index in context")
    model_version: str = Field(..., description="Model version identifier")
    execution_time_ms: float = Field(..., description="Execution time in milliseconds")
    
    class Config:
        json_schema_extra = {
            "example": {
                "answer": "over 50,000",
                "is_answerable": True,
                "confidence_score": 0.964,
                "start_char": 58,
                "end_char": 70,
                "model_version": "bert-base-squad2-v1",
                "execution_time_ms": 38.5
            }
        }


class LoginRequest(BaseModel):
    """Login request schema"""
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loaded: bool
    model_version: str
    device: str


class MetricsResponse(BaseModel):
    """Evaluation metrics response"""
    dataset: str
    exact_match: float
    f1_score: float
    null_threshold: float
    total_samples: int


class PDFPageData(BaseModel):
    """Metadata and extracted text for an individual PDF page"""
    page_number: int
    text: str
    char_count: int


class PDFExtractResponse(BaseModel):
    """Extracted text and metadata for a PDF document"""
    filename: str
    total_pages: int
    text: str
    pages: List[PDFPageData]


class PDFQAResponse(BaseModel):
    """Question Answering response schema for PDF documents"""
    answer: str = Field(..., description="Primary extracted answer")
    answers: Optional[List[AnswerSpan]] = Field(default=None, description="All extracted distinct answer spans")
    is_answerable: bool = Field(..., description="Whether the question can be answered from the PDF")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    page_number: Optional[int] = Field(default=None, description="1-indexed page where the answer was found")
    total_pages: int = Field(..., description="Total pages in the PDF")
    matched_passage: Optional[str] = Field(default=None, description="Context excerpt containing the answer")
    filename: str = Field(..., description="Name of the PDF file")
    model_version: str = Field(..., description="Model version identifier")
    execution_time_ms: float = Field(..., description="Execution time in milliseconds")

