from pydantic import BaseModel, Field, constr
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class ShortlistingDecisionRequest(BaseModel):
    decision: str = Field(..., description="Must be 'shortlisted' or 'non_shortlisted'")
    reason: constr(min_length=1, max_length=1000) = Field(..., description="Required reason for decision")
    send_rejection_email: Optional[bool] = True
    send_assessment_email: Optional[bool] = True

class ShortlistingDecisionResponse(BaseModel):
    decision_id: UUID
    application_id: UUID
    decision: str
    reason: Optional[str] = ""
    decided_by: Optional[UUID] = None
    decided_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    
class ShortlistedCandidateResponse(BaseModel):
    application_id: UUID
    candidate_name: str
    email: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    predicted_class: Optional[str] = None
    match_score: Optional[float] = None
    decision: str
    reason: str
    decided_at: Optional[datetime] = None
    shortlisted_by: Optional[str] = None
    email_status: Optional[str] = None
    resume_url: Optional[str] = None

class BulkShortlistEmailRequest(BaseModel):
    application_ids: Optional[List[str]] = None
    all_shortlisted: Optional[bool] = False
    email_type: Optional[str] = "shortlisted"

class BulkEmailFailure(BaseModel):
    application_id: str
    candidate_name: Optional[str] = None
    email: Optional[str] = None
    reason: str

class BulkEmailResponse(BaseModel):
    requested: int
    sent: int
    failed: int
    failures: List[BulkEmailFailure]
