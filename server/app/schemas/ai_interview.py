from pydantic import BaseModel
from typing import Optional

class GenerateInterviewRequest(BaseModel):
    question_count: int = 5

class ProfileConfirmRequest(BaseModel):
    confirmed: bool

class AnswerRequest(BaseModel):
    question_index: int
    answer: str

class HRReviewRequest(BaseModel):
    technical_score: Optional[int] = None
    problem_solving_score: Optional[int] = None
    communication_score: Optional[int] = None
    project_knowledge_score: Optional[int] = None
    notes: Optional[str] = None
