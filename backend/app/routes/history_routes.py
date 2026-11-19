"""History management endpoints"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from ..schemas import TaskHistoryListResponse, TaskHistoryItem, HistoryStatsResponse, ChatSessionListResponse, ChatSessionItem
from ..services.history_service import history_service
from ..auth import get_current_user

router = APIRouter()


@router.get("", response_model=TaskHistoryListResponse)
async def get_history(
    task_type: Optional[str] = Query(None, description="Filter by task type ('text_qa', 'pdf_qa', 'pdf_extract', or 'all')"),
    search: Optional[str] = Query(None, description="Search query matching questions, answers, or document names"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve paginated user task execution history.
    Scoped to the authenticated user.
    """
    user_id = current_user.get("username", "user")
    items, total = history_service.list_history(
        user_id=user_id,
        task_type=task_type,
        search=search,
        limit=limit,
        offset=offset
    )
    return TaskHistoryListResponse(
        history=items,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/sessions", response_model=ChatSessionListResponse)
async def get_chat_sessions(
    limit: int = Query(50, ge=1, le=100, description="Sessions per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve conversation session tabs grouped by passage or document.
    All questions asked on the same passage appear under a single tab.
    """
    user_id = current_user.get("username", "user")
    sessions, total = history_service.list_sessions(user_id=user_id, limit=limit, offset=offset)
    return ChatSessionListResponse(
        sessions=[ChatSessionItem(**s) for s in sessions],
        total=total
    )


@router.get("/sessions/{session_id}", response_model=list[TaskHistoryItem])
async def get_session_messages(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve all questions and answers belonging to a specific passage session.
    """
    user_id = current_user.get("username", "user")
    messages = history_service.get_session_tasks(session_id=session_id, user_id=user_id)
    return [TaskHistoryItem(**m) for m in messages]


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete an entire passage conversation tab and all its associated questions.
    """
    user_id = current_user.get("username", "user")
    deleted = history_service.delete_session(session_id=session_id, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found or already deleted")
    return {"success": True, "message": "Session tab deleted successfully", "session_id": session_id}


@router.get("/stats", response_model=HistoryStatsResponse)
async def get_user_stats(current_user: dict = Depends(get_current_user)):
    """
    Retrieve aggregate statistics for user's past tasks and stored client documents.
    """
    user_id = current_user.get("username", "user")
    stats = history_service.get_user_stats(user_id=user_id)
    return HistoryStatsResponse(**stats)


@router.get("/{history_id}", response_model=TaskHistoryItem)
async def get_history_detail(
    history_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve single task execution record details by ID.
    """
    user_id = current_user.get("username", "user")
    item = history_service.get_history_item(history_id=history_id, user_id=user_id)
    if not item:
        raise HTTPException(status_code=404, detail="History record not found")
    return TaskHistoryItem(**item)


@router.delete("/{history_id}")
async def delete_history_record(
    history_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete an individual task execution record.
    """
    user_id = current_user.get("username", "user")
    deleted = history_service.delete_history_item(history_id=history_id, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="History record not found or already deleted")
    return {"success": True, "message": "History record deleted successfully", "id": history_id}


@router.delete("")
async def clear_all_history(current_user: dict = Depends(get_current_user)):
    """
    Clear all task execution history records for the authenticated user.
    """
    user_id = current_user.get("username", "user")
    deleted_count = history_service.clear_user_history(user_id=user_id)
    return {
        "success": True,
        "message": f"Successfully cleared {deleted_count} history records",
        "deleted_count": deleted_count
    }
