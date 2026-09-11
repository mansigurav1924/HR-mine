from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.dependencies.auth import get_current_user, require_hr_admin
from app.services.group_interview_service import GroupInterviewService, CreateBatchRequest

router = APIRouter()
service = GroupInterviewService()

@router.get("/ready-candidates")
def get_ready_candidates(department: Optional[str] = None, position: Optional[str] = None, user = Depends(require_hr_admin)):
    return service.get_eligible_candidates(department, position)

@router.post("/batches")
def create_batch(req: CreateBatchRequest, user = Depends(require_hr_admin)):
    try:
        return service.create_batch(req, user.id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/batches")
def get_batches(user = Depends(require_hr_admin)):
    return service.get_batches()

@router.get("/batches/{batch_id}")
def get_batch(batch_id: str, user = Depends(require_hr_admin)):
    batch = service.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch

@router.post("/batches/{batch_id}/send-invites")
def send_invites(batch_id: str, user = Depends(require_hr_admin)):
    try:
        return service.send_invitations(batch_id, user.id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class AttendanceUpdate(BaseModel):
    status: str

@router.put("/batches/{batch_id}/candidates/{application_id}/attendance")
def update_attendance(batch_id: str, application_id: str, req: AttendanceUpdate, user = Depends(get_current_user)):
    if getattr(user, "role", None) not in ["hr_admin", "interviewer"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    service.update_attendance(batch_id, application_id, req.status)
    return {"status": "success"}

class EvaluateCandidate(BaseModel):
    technical_score: int
    problem_solving_score: int
    communication_score: int
    relevant_skills_score: int
    overall_rating: int
    feedback: str
    decision: str
    round_number: int = 1

@router.post("/batches/{batch_id}/candidates/{application_id}/evaluate")
def evaluate_candidate(batch_id: str, application_id: str, req: EvaluateCandidate, user = Depends(get_current_user)):
    if getattr(user, "role", None) not in ["hr_admin", "interviewer"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    service.evaluate_candidate(batch_id, application_id, req.dict(), user.id)
    return {"status": "success"}
