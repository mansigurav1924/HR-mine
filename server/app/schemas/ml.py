from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from datetime import datetime
from uuid import UUID

class MLModelInfoResponse(BaseModel):
    available: bool
    model_version: Optional[str] = None
    algorithm: Optional[str] = None
    labels: Optional[List[str]] = None
    
class MLEvaluationResponse(BaseModel):
    evaluation_id: UUID
    application_id: UUID
    position_id: UUID
    model_version: str
    predicted_class: str
    match_score: Optional[float] = None
    matching_skills: List[str]
    missing_skills: List[str]
    relevant_experience: Optional[List[Dict[str, Any]]] = None
    relevant_projects: Optional[List[Dict[str, Any]]] = None
    recommendation: str
    evaluated_at: datetime
    
class MLBatchEvaluationResponse(BaseModel):
    position_id: UUID
    total_eligible: int
    evaluated: int
    failed: int
    results: List[MLEvaluationResponse]
