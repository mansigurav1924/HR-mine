from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
from app.dependencies.auth import require_hr_admin
from app.schemas.assessment import (
    AssessmentGenerateRequest, AssessmentTokenResponse, VerifySkillsRequest, 
    CandidateAssessmentStateResponse, CandidateQuestionResponse, AnswerRequest, 
    SubmitResponse, HROverrideRequest, AssessmentDetailResponse,
    IntegrityEventRequest, IntegritySummaryResponse
)
from app.services.assessment_service import AssessmentService

router = APIRouter()
assessment_service = AssessmentService()

@router.get("/")
def list_assessments(current_user=Depends(require_hr_admin)):
    return assessment_service.get_dashboard_data()

@router.post("/{application_id}/generate")
def generate_assessment(application_id: str, request: AssessmentGenerateRequest, current_user=Depends(require_hr_admin)):
    try:
        return assessment_service.generate_assessment(application_id, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{assessment_id}/token", response_model=AssessmentTokenResponse)
def generate_token(assessment_id: str, current_user=Depends(require_hr_admin)):
    try:
        return assessment_service.generate_token_and_invite(assessment_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{assessment_id}/detail", response_model=AssessmentDetailResponse)
def get_assessment_detail(assessment_id: str, current_user=Depends(require_hr_admin)):
    try:
        return assessment_service.get_detail(assessment_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{assessment_id}/override")
def override_result(assessment_id: str, request: HROverrideRequest, current_user=Depends(require_hr_admin)):
    try:
        return assessment_service.override_result(assessment_id, request, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{assessment_id}/retry-result-email")
def retry_result_email(assessment_id: str, current_user=Depends(require_hr_admin)):
    """HR Admin: Retry sending the result email if it failed previously."""
    try:
        return assessment_service.retry_result_email(assessment_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{application_id}/invite-interview")
def send_interview_invitation(application_id: str, current_user=Depends(require_hr_admin)):
    """Next stage for assessment_passed candidates: sends automated text interview invitation via Gmail."""
    try:
        return assessment_service.send_interview_invitation(application_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Candidate Endpoints (Secured via stage-scoped candidate tokens, no HR auth)
@router.get("/access/{token}", response_model=CandidateAssessmentStateResponse)
def get_candidate_state(token: str):
    try:
        return assessment_service.get_candidate_state(token)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

@router.get("/access/{token}/question", response_model=CandidateQuestionResponse)
def get_current_question(token: str):
    try:
        return assessment_service.get_current_question(token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/access/{token}/answer")
def submit_answer(token: str, request: AnswerRequest):
    try:
        return assessment_service.submit_answer(token, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/access/{token}/submit", response_model=SubmitResponse)
def submit_assessment(token: str):
    try:
        return assessment_service.submit_assessment(token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/access/{token}/timeout")
def report_question_timeout(token: str):
    """
    Candidate portal: triggered when frontend countdown hits 0.
    Server still independently validates deadline on next get_current_question
    if this request fails or is blocked.
    """
    try:
        # We simulate a get_current_question call, which auto-times-out 
        # the expired question and readies the next one.
        # Returning it gives the frontend the new state.
        return assessment_service.get_current_question(token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Candidate: log a single integrity signal (fire-and-forget, never crashes the assessment)
@router.post("/access/{token}/integrity-event")
def log_integrity_event(token: str, request: IntegrityEventRequest):
    """
    Candidate portal. Logs a single browser integrity signal.
    Token must be valid + assessment active. Never crashes the assessment on failure.
    """
    try:
        return assessment_service.log_integrity_event(token, request)
    except ValueError as e:
        # Return 400 only for token issues (expired/invalid); assessment keeps running
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Swallow unexpected errors silently — integrity logging must not interrupt assessment
        return {"logged": False, "reason": "internal_error"}

# HR Admin: integrity summary for a completed assessment
@router.get("/{assessment_id}/integrity", response_model=IntegritySummaryResponse)
def get_integrity_summary(assessment_id: str, current_user=Depends(require_hr_admin)):
    """HR Admin only. Returns integrity event counts, status, and event timeline."""
    try:
        return assessment_service.get_integrity_summary(assessment_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
