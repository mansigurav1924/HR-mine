from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Any
from datetime import date, datetime

class OfferGenerateRequest(BaseModel):
    application_id: str
    template_id: Optional[str] = None
    designation: str
    department: Optional[str] = ""
    joining_date: Any
    end_date: Optional[Any] = None
    duration: Optional[str] = ""
    stipend: Any
    work_mode: Optional[str] = "Remote"
    location: Optional[str] = ""
    expiry_at: Optional[Any] = None
    offer_expiry_date: Optional[Any] = None
    offer_issue_date: Optional[Any] = None
    candidate_name: Optional[str] = ""
    candidate_email: Optional[EmailStr] = None

class OfferPreviewRequest(BaseModel):
    application_id: Optional[str] = None
    template_id: Optional[str] = None
    designation: str
    department: Optional[str] = ""
    joining_date: Any
    end_date: Optional[Any] = ""
    duration: Optional[str] = ""
    stipend: Any
    work_mode: Optional[str] = "Remote"
    location: Optional[str] = ""
    expiry_at: Optional[Any] = ""
    offer_expiry_date: Optional[Any] = ""
    candidate_name: Optional[str] = "Candidate"
    candidate_email: Optional[EmailStr] = None

class OfferResponseRequest(BaseModel):
    decision: str = Field(..., description="Must be 'accept', 'decline', or 'discussion'")
    reason: Optional[str] = None
    discussion_message: Optional[str] = None

class ExtendDeadlineRequest(BaseModel):
    new_expiry: datetime

class SendReminderRequest(BaseModel):
    pass
