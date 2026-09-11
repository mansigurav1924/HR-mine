from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime

ALLOWED_INTEGRITY_EVENT_TYPES = {
    'TAB_SWITCH', 'WINDOW_BLUR', 'WINDOW_FOCUS',
    'FULLSCREEN_ENTERED', 'FULLSCREEN_EXIT', 'FULLSCREEN_REENTERED',
    'FULLSCREEN_UNSUPPORTED', 'COPY_ATTEMPT', 'PASTE_ATTEMPT', 'CUT_ATTEMPT'
}

class AssessmentGenerateRequest(BaseModel):
    question_count: int = Field(default=20, ge=1, le=50)
    pass_threshold: float = Field(default=60.0, ge=0.0, le=100.0)

class AssessmentTokenResponse(BaseModel):
    assessment_id: str
    candidate_url: str
    expires_at: datetime

class SkillRating(BaseModel):
    name: str
    rating: int = Field(..., ge=1, le=5)

class VerifySkillsRequest(BaseModel):
    confirmed: bool
    skills: List[SkillRating]

class CandidateAssessmentStateResponse(BaseModel):
    candidate_name: Optional[str] = None
    first_name: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    total_questions: int = 20
    answered_count: int = 0
    completed: bool = False
    result: Optional[str] = None
    status: str = "ready"

class CandidateQuestionResponse(BaseModel):
    question_number: Optional[int] = None
    total_questions: Optional[int] = None
    question: Optional[str] = None
    options: Optional[List[str]] = None
    ready_to_submit: Optional[bool] = False
    answered_count: Optional[int] = 0
    deadline_at: Optional[datetime] = None    # Server-authoritative question deadline

class AnswerRequest(BaseModel):
    question_index: int
    selected_option: int

class SubmitResponse(BaseModel):
    completed: bool
    result: str
    message: str

class HROverrideRequest(BaseModel):
    result: str  # "pass" or "fail"
    reason: str = Field(..., min_length=1)

class AssessmentDetailResponse(BaseModel):
    assessment_id: str
    application_id: Optional[str] = None
    candidate_name: str
    email: Optional[str] = None
    position: str
    department: Optional[str] = None
    verified_skills: Optional[List[str]] = []
    predicted_class: Optional[str] = None
    match_score: Optional[float] = None
    question_count: int
    correct_count: Optional[int] = 0
    incorrect_count: Optional[int] = 0
    timed_out_count: Optional[int] = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    score: Optional[float] = None             # backward compat (= adjusted_score)
    raw_score: Optional[float] = None
    integrity_penalty: Optional[float] = 0.0
    adjusted_score: Optional[float] = None
    threshold: float
    result: Optional[str] = None
    time_taken_seconds: Optional[int] = None
    question_breakdown: Optional[List[Dict[str, Any]]] = []
    violation_episodes: Optional[List[Dict[str, Any]]] = []


# --- Integrity Event Schemas ---

class IntegrityEventRequest(BaseModel):
    """Candidate submits a single browser integrity signal."""
    event_type: str
    question_index: Optional[int] = None

    @validator('event_type')
    def validate_event_type(cls, v):
        if v not in ALLOWED_INTEGRITY_EVENT_TYPES:
            raise ValueError(f"Invalid event_type '{v}'. Must be one of: {', '.join(sorted(ALLOWED_INTEGRITY_EVENT_TYPES))}")
        return v


class IntegrityEventEntry(BaseModel):
    """A single event entry in the HR integrity timeline."""
    event_id: str
    event_type: str
    question_index: Optional[int] = None
    occurred_at: datetime


class IntegritySummaryResponse(BaseModel):
    """HR integrity summary for a completed assessment."""
    assessment_id: str
    tab_switches: int = 0
    window_blurs: int = 0
    fullscreen_exits: int = 0
    copy_attempts: int = 0
    paste_attempts: int = 0
    cut_attempts: int = 0
    fullscreen_supported: bool = True
    integrity_status: str = "clear"  # 'clear' | 'review_recommended'
    warnings_issued: int = 0
    penalties_applied: int = 0
    total_penalty: float = 0.0
    event_timeline: List[IntegrityEventEntry] = []
    violation_episodes: List[Dict[str, Any]] = []
    disclaimer: str = "Integrity signals are provided for HR review and are not proof of misconduct on their own."
    review_threshold: int = 3
