from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
from app.dependencies.auth import require_hr_admin
from app.schemas.ai_interview import (
    GenerateInterviewRequest, ProfileConfirmRequest, AnswerRequest, HRReviewRequest
)
from app.services.ai_interview_service import AIInterviewService

router = APIRouter()
interview_service = AIInterviewService()

# HR Endpoints (HR Admin only)
@router.get("/")
def list_interviews(current_user=Depends(require_hr_admin)):
    return interview_service.get_dashboard_data()

@router.post("/{application_id}/generate")
def generate_interview(application_id: str, request: GenerateInterviewRequest, current_user=Depends(require_hr_admin)):
    try:
        return interview_service.generate_interview(application_id, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{ai_interview_id}/token")
def generate_token(ai_interview_id: str, current_user=Depends(require_hr_admin)):
    try:
        return interview_service.generate_token(ai_interview_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{ai_interview_id}/detail")
def get_interview_detail(ai_interview_id: str, current_user=Depends(require_hr_admin)):
    try:
        return interview_service.get_detail(ai_interview_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{ai_interview_id}/manual-complete")
def manual_complete(ai_interview_id: str, current_user=Depends(require_hr_admin)):
    try:
        return interview_service.manual_complete(ai_interview_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{ai_interview_id}/proceed-human-interview")
def proceed_to_human_interview(ai_interview_id: str, current_user=Depends(require_hr_admin)):
    try:
        return interview_service.proceed_to_human_interview(ai_interview_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Candidate Endpoints (Stage-scoped token security)
@router.get("/access/{token}")
def get_candidate_state(token: str):
    try:
        return interview_service.get_candidate_state(token)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

@router.post("/access/{token}/opened")
def record_opened(token: str):
    try:
        return interview_service.record_opened(token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/access/{token}/complete")
def complete_placeholder(token: str):
    try:
        return interview_service.complete_placeholder(token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
