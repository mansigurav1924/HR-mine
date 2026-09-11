from pydantic import BaseModel
from typing import List, Dict, Any

class ParsedProfile(BaseModel):
    skills: List[str]
    education: List[Dict[str, Any]]
    experience: List[Dict[str, Any]]
    projects: List[Dict[str, Any]]

class ParseResumeResponse(BaseModel):
    application_id: str
    parser_status: str # "success", "partial", "manual_review_required", "failed"
    file_type: str
    parsed_profile: ParsedProfile
    warnings: List[str]
