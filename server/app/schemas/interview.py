from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, time

class ScheduleInterviewRequest(BaseModel):
    application_id: str
    round_number: Optional[int] = None
    depends_on_round: Optional[str] = None
    date: date
    time: time
    interviewer_id: str
    type: str
    mode: str = Field(..., pattern="^(online|offline)$")
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    calendar_provider: Optional[str] = Field("google", pattern="^(google|outlook)$")
    duration_minutes: Optional[int] = Field(45, ge=15, le=240)
    timezone_str: Optional[str] = "UTC"

class AttendanceRequest(BaseModel):
    attendance: str = Field(..., pattern="^(present|absent|no_show)$")

class EvaluationRequest(BaseModel):
    technical: int = Field(..., ge=1, le=5)
    communication: int = Field(..., ge=1, le=5)
    problem_solving: int = Field(..., ge=1, le=5)
    project_knowledge: int = Field(..., ge=1, le=5)
    confidence: int = Field(..., ge=1, le=5)
    notes: Optional[str] = None
    decision: str = Field(..., pattern="^(selected|rejected)$")

class RescheduleRequest(BaseModel):
    date: date
    time: time
    interviewer_id: str
    mode: str = Field(..., pattern="^(online|offline)$")
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    reason: str
    calendar_provider: Optional[str] = None
    duration_minutes: Optional[int] = 45
    timezone_str: Optional[str] = "UTC"

class FlagRescheduleRequest(BaseModel):
    reason: str
