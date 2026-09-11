from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from app.dependencies.auth import get_current_user, require_hr_admin
from app.schemas.interview import ScheduleInterviewRequest, AttendanceRequest, EvaluationRequest, RescheduleRequest, FlagRescheduleRequest
from app.services.interview_service import InterviewService
from pydantic import BaseModel

router = APIRouter()
service = InterviewService()

class CancelRequest(BaseModel):
    reason: str

@router.get("/interviewers")
def get_interviewers(current_user = Depends(require_hr_admin)):
    try:
        return service.get_interviewers()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def schedule_interview(req: ScheduleInterviewRequest, current_user = Depends(require_hr_admin)):
    try:
        return service.schedule_interview(req, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
def list_interviews(
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    current_user = Depends(get_current_user)
):
    try:
        return service.get_interviews(current_user, status, page, page_size)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{interview_id}")
def get_interview(interview_id: str, current_user = Depends(get_current_user)):
    try:
        return service.get_interview(interview_id, current_user)
    except ValueError as e:
        if "Forbidden" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{interview_id}/attendance")
def mark_attendance(interview_id: str, req: AttendanceRequest, current_user = Depends(get_current_user)):
    try:
        return service.mark_attendance(interview_id, req, current_user)
    except ValueError as e:
        if "Forbidden" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{interview_id}/evaluation")
def submit_evaluation(interview_id: str, req: EvaluationRequest, current_user = Depends(get_current_user)):
    try:
        return service.evaluate_interview(interview_id, req, current_user)
    except ValueError as e:
        if "Forbidden" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{interview_id}/reschedule")
def reschedule_interview(interview_id: str, req: RescheduleRequest, current_user = Depends(require_hr_admin)):
    try:
        return service.reschedule(interview_id, req, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{interview_id}/flag-reschedule")
def flag_reschedule(interview_id: str, req: FlagRescheduleRequest, current_user = Depends(get_current_user)):
    try:
        return service.flag_reschedule(interview_id, req, current_user)
    except ValueError as e:
        if "Forbidden" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{interview_id}/cancel")
def cancel_interview(interview_id: str, req: CancelRequest, current_user = Depends(require_hr_admin)):
    try:
        return service.cancel(interview_id, req.reason, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{interview_id}/calendar-sync")
def retry_calendar_sync(interview_id: str, current_user = Depends(require_hr_admin)):
    """HR Admin only. Retries synchronization of an interview event with Google Calendar / Outlook Calendar."""
    try:
        return service.retry_calendar_sync(interview_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
