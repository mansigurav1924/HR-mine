from fastapi import APIRouter, Depends, HTTPException
from app.dependencies.auth import require_hr_admin
from app.services.resume_parser_service import parse_resume_for_application
from app.schemas.resume_parser import ParseResumeResponse

router = APIRouter()

@router.post("/{application_id}/parse-resume", response_model=ParseResumeResponse)
def parse_resume_endpoint(application_id: str, current_user = Depends(require_hr_admin)):
    """HR Admin only."""
    try:
        response = parse_resume_for_application(application_id)
        return response
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail="An unexpected error occurred while parsing the resume.")
