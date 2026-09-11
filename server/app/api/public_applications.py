import re
import uuid
import logging
import time
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status, Body, Request
from pydantic import BaseModel
from app.services.supabase_client import supabase
from app.services.candidate_token_service import CandidateTokenService
from app.services.ml_evaluation_service import MLEvaluationService
from app.services.pdf_parser import extract_structured_pdf, extract_text_from_pdf, extract_links_from_pdf, is_scanned_or_empty_pdf
from app.services.docx_parser import extract_structured_docx, extract_text_from_docx, extract_links_from_docx
from app.services.profile_extractor import (
    extract_full_profile, extract_skills, extract_urls,
    extract_experience_summary, extract_projects_summary, extract_education
)
from app.api.applications import validate_resume_file
from app.services.positions_service import PositionsService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/public", tags=["Public Candidate Portal"])
token_service = CandidateTokenService()
ml_eval_service = MLEvaluationService()
positions_service = PositionsService()

# In-memory rate limiting for public resume parsing (30 requests per minute per IP)
_PARSE_RATE_LIMITS: Dict[str, List[float]] = {}
RATE_LIMIT_WINDOW = 60.0  # seconds
MAX_PARSE_REQUESTS_PER_WINDOW = 30

def check_parse_rate_limit(client_ip: str):
    now = time.time()
    timestamps = _PARSE_RATE_LIMITS.get(client_ip, [])
    # Filter timestamps within window
    timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
    if len(timestamps) >= MAX_PARSE_REQUESTS_PER_WINDOW:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment before uploading another resume."
        )
    timestamps.append(now)
    _PARSE_RATE_LIMITS[client_ip] = timestamps

class PersonalInfo(BaseModel):
    full_name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""

class EducationInfo(BaseModel):
    college: str = ""
    degree: str = ""
    specialization: str = ""
    current_year: str = ""
    graduation_year: str = ""
    cgpa: str = ""

class ExperienceEntry(BaseModel):
    company: str = ""
    role: str = ""
    duration: str = ""
    description: str = ""

class ExperienceInfo(BaseModel):
    summary: str = ""
    internships: List[ExperienceEntry] = []

class ProjectEntry(BaseModel):
    name: str = ""
    description: str = ""
    technologies: List[str] = []

class LinksInfo(BaseModel):
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None

class PublicResumeParseResponse(BaseModel):
    parsed: bool
    manual_entry_required: bool
    message: str
    personal: PersonalInfo = PersonalInfo()
    education: EducationInfo = EducationInfo()
    skills: List[str] = []
    experience: ExperienceInfo = ExperienceInfo()
    projects: List[Any] = []
    projects_summary: str = ""
    links: LinksInfo = LinksInfo()
    extraction_meta: Optional[Dict[str, Any]] = None

    # Flat convenience fields for backward compatibility
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    specialization: Optional[str] = None
    current_year: Optional[str] = None
    experience_summary: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    education_summary: Optional[str] = None


EMAIL_REGEX = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'

# Domain fallback skill profiles if job requirements skills are empty
DOMAIN_FALLBACK_SKILLS = {
    "data & ai": ["Python", "Machine Learning", "Pandas", "NumPy", "Scikit-Learn", "SQL", "Statistics", "Data Preprocessing", "Deep Learning", "NLP"],
    "machine learning": ["Python", "Machine Learning", "Pandas", "NumPy", "Scikit-Learn", "SQL", "Statistics", "Data Preprocessing", "Deep Learning", "NLP"],
    "human resources": ["Recruitment", "Communication", "Candidate Screening", "Interview Coordination", "MS Excel", "Documentation", "HR Operations", "MS Office"],
    "sales": ["Communication", "Lead Generation", "CRM", "Cold Calling", "Sales Pitching", "Negotiation", "Customer Handling", "Market Research"],
    "business analyst": ["Requirement Gathering", "Business Analysis", "SQL", "Excel", "Power BI", "Data Analysis", "Process Modeling", "Documentation", "Agile", "JIRA"],
    "engineering": ["React", "JavaScript", "Python", "Node.js", "SQL", "Git", "REST APIs", "HTML/CSS", "Docker", "Database Design"],
    "default": ["Communication", "Problem Solving", "Teamwork", "Time Management", "Analytical Thinking", "Documentation"]
}

def get_fallback_skills_for_job(title: str, department: str) -> List[str]:
    combined = f"{title.lower()} {department.lower()}"
    for key, skills in DOMAIN_FALLBACK_SKILLS.items():
        if key in combined:
            return skills
    return DOMAIN_FALLBACK_SKILLS["default"]

@router.get("/jobs")
def get_public_jobs():
    """Returns a list of published, active positions."""
    try:
        all_jobs = positions_service.get_all_positions()
        # Only return OPEN or SCHEDULED jobs to the public
        visible_jobs = [j for j in all_jobs if j.get("effective_status") in ("OPEN", "SCHEDULED")]
        
        results = []
        for row in visible_jobs:
            results.append({
                "position_id": row["position_id"],
                "position": row["position_title"],
                "position_title": row["position_title"],
                "department": row.get("department") or (row.get("departments") or {}).get("name") or "General",
                "effective_status": row.get("effective_status"),
                "application_open_at": row.get("application_open_at"),
                "application_close_at": row.get("application_close_at")
            })
        return results
    except Exception as e:
        logger.error(f"Error fetching public jobs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load open positions at this time."
        )

@router.get("/jobs/{position_id}")
def get_public_job(position_id: str):
    """Returns details for a specific active position. Returns 404 if invalid or inactive."""
    try:
        job = positions_service.get_position_by_id(position_id)
        
        # Don't show DRAFT, ARCHIVED, or internal statuses
        if job.get("effective_status") in ("DRAFT", "ARCHIVED"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Position not found."
            )
            
        return {
            "position_id": job["position_id"],
            "position": job["position_title"],
            "position_title": job["position_title"],
            "department": job.get("department") or (job.get("departments") or {}).get("name") or "General",
            "required_skills": job.get("required_skills") or [],
            "preferred_skills": job.get("preferred_skills") or [],
            "education": job.get("education"),
            "experience_min": job.get("experience_min"),
            "experience_max": job.get("experience_max"),
            "effective_status": job.get("effective_status"),
            "application_open_at": job.get("application_open_at"),
            "application_close_at": job.get("application_close_at"),
            "number_of_openings": job.get("number_of_openings", 1),
            "description": job.get("description", "")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching public job {position_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Position not found."
        )

@router.post("/resume/parse", response_model=PublicResumeParseResponse)
async def parse_public_resume(
    request: Request,
    resume: UploadFile = File(...)
):
    """
    Public resume parsing endpoint for auto-filling the candidate application form.
    Validates file, extracts text in memory only, extracts structured fields.
    Does NOT create application, does NOT run ML classifier, does NOT store raw text.
    """
    # Rate limit check by client IP
    client_ip = request.client.host if request.client else "anonymous"
    check_parse_rate_limit(client_ip)

    if not resume or not resume.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No resume file provided."
        )

    try:
        content = await resume.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded resume: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read uploaded resume file."
        )

    # 1. Validate file extension, size, and header signature
    ext = validate_resume_file(resume.filename, content, resume.content_type)

    # 2. Multi-strategy text, block, link, and table extraction in memory
    text = ""
    embedded_links = []
    blocks = []
    tables = []
    is_scanned = False
    
    try:
        if ext == "pdf":
            pdf_data = extract_structured_pdf(content)
            text = pdf_data.get("plain_text", "")
            embedded_links = pdf_data.get("links", [])
            blocks = pdf_data.get("blocks", [])
            tables = pdf_data.get("tables", [])
            is_scanned = pdf_data.get("is_scanned", False)
        elif ext == "docx":
            docx_data = extract_structured_docx(content)
            text = docx_data.get("plain_text", "")
            embedded_links = docx_data.get("links", [])
            tables = docx_data.get("tables", [])
            is_scanned = docx_data.get("is_scanned", False)
    except Exception as e:
        logger.warning(f"Text extraction failed on {resume.filename}: {e}")
        return PublicResumeParseResponse(
            parsed=False,
            manual_entry_required=True,
            message="We couldn't extract text from this resume. Please enter your details manually.",
            skills=[],
            experience_summary="",
            projects=[],
            projects_summary="",
            links=LinksInfo(github_url="", linkedin_url="", portfolio_url=""),
            github_url="",
            linkedin_url="",
            portfolio_url=""
        )

    # 3. Check for scanned / empty text (no OCR in current scope)
    if is_scanned or len(text.strip()) < 30:
        return PublicResumeParseResponse(
            parsed=False,
            manual_entry_required=True,
            message="We could not extract text from this resume. Please fill the form manually.",
            skills=[],
            experience_summary="",
            projects=[],
            projects_summary="",
            links=LinksInfo(github_url="", linkedin_url="", portfolio_url=""),
            github_url="",
            linkedin_url="",
            portfolio_url=""
        )

    # 4. Extract structured fields with Hybrid Resume Parsing Matrix
    profile = extract_full_profile(
        text,
        embedded_links=embedded_links,
        blocks=blocks,
        tables=tables
    )

    return PublicResumeParseResponse(
        parsed=True,
        manual_entry_required=False,
        message="Resume details extracted successfully. Please review the information before submitting.",
        personal=PersonalInfo(**profile["personal"]),
        education=EducationInfo(**profile["education"]),
        skills=profile["skills"],
        experience=ExperienceInfo(
            summary=profile["experience"]["summary"],
            internships=[ExperienceEntry(**item) for item in profile["experience"]["internships"]]
        ),
        projects=profile["projects"],
        projects_summary=profile["projects_summary"],
        links=LinksInfo(**profile["links"]),
        extraction_meta=profile.get("extraction_meta"),
        full_name=profile["full_name"],
        email=profile["email"],
        phone=profile["phone"],
        college=profile["college"],
        degree=profile["degree"],
        specialization=profile["specialization"],
        current_year=profile["current_year"],
        experience_summary=profile["experience_summary"],
        github_url=profile["github_url"],
        linkedin_url=profile["linkedin_url"],
        portfolio_url=profile["portfolio_url"],
        education_summary=profile["degree"]
    )



@router.post("/applications")
async def submit_public_application(
    position_id: str = Form(...),
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    college: Optional[str] = Form(None),
    degree: Optional[str] = Form(None),
    current_year: Optional[str] = Form(None),
    skills: str = Form(...),
    experience: Optional[str] = Form(None),
    projects: Optional[str] = Form(None),
    github_url: Optional[str] = Form(None),
    linkedin_url: Optional[str] = Form(None),
    portfolio_url: Optional[str] = Form(None),
    consent_given: bool = Form(...),
    resume: UploadFile = File(...)
):
    """Public application submission step 1. Creates application and issues verification token for Step 2."""
    if not consent_given:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent is required to submit an application."
        )

    clean_name = full_name.strip()
    clean_email = email.strip().lower()
    clean_phone = phone.strip()

    if len(clean_name) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a valid full name.")
    if not re.match(EMAIL_REGEX, clean_email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please enter a valid email address.")
    if len(clean_phone) < 7:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a valid phone number.")

    parsed_skills = [s.strip() for s in skills.replace(';', ',').split(',') if s.strip()]
    if not parsed_skills:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide at least one technical skill.")

    # Validate Position and Effective Status
    try:
        job = positions_service.get_position_by_id(position_id)
        if job.get("effective_status") != "OPEN":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"This position is currently {job.get('effective_status').lower()} and is not accepting applications."
            )
    except HTTPException as e:
        # Pass through status-related 400s or 404s
        raise e
    except Exception as e:
        logger.error(f"Error validating position: {e}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected position is not available or inactive.")

    # Duplicate check
    try:
        dup_res = supabase.table("applications").select("application_id").eq("email", clean_email).eq("position_id", position_id).neq("current_status", "withdrawn").execute()
        if dup_res.data and len(dup_res.data) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An application using these details has already been received for this position."
            )
    except HTTPException:
        raise
    except Exception:
        pass

    # Validate Resume
    if not resume:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resume file is required (.pdf or .docx).")

    file_content = await resume.read()
    file_ext = validate_resume_file(resume.filename or "resume.pdf", file_content, resume.content_type)
    
    app_id = str(uuid.uuid4())
    file_path = f"applications/{app_id}/resume.{file_ext}"

    try:
        supabase.storage.from_("resumes").upload(
            file=file_content,
            path=file_path,
            file_options={
                "content-type": resume.content_type or ("application/pdf" if file_ext == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
            }
        )
    except Exception as e:
        logger.error(f"Failed to upload resume: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to store resume file securely.")

    education_data = {
        "college": college.strip() if college else "",
        "degree": degree.strip() if degree else "",
        "current_year": current_year.strip() if current_year else ""
    }

    now_iso = datetime.utcnow().isoformat()
    app_payload = {
        "application_id": app_id,
        "candidate_name": clean_name,
        "email": clean_email,
        "phone": clean_phone,
        "position_id": position_id,
        "position": job["position_title"],
        "department": job["department"],
        "source": "website",
        "current_status": "application_received",
        "application_date": now_iso,
        "consent_version": "v1.0",
        "consented_at": now_iso,
        "education": education_data,
        "skills": parsed_skills,
        "experience": [{"description": experience.strip()}] if experience and experience.strip() else [],
        "projects": [{"name": "Key Project", "description": projects.strip()}] if projects and projects.strip() else [],
        "github": github_url.strip() if github_url else None,
        "linkedin": linkedin_url.strip() if linkedin_url else None,
        "portfolio": portfolio_url.strip() if portfolio_url else None,
        "resume_url": file_path
    }

    try:
        supabase.table("applications").insert(app_payload).execute()
    except Exception as e:
        logger.error(f"Failed to insert application: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to submit application.")

    # Audit log
    try:
        supabase.table("audit_logs").insert({
            "action": "APPLICATION_SUBMITTED",
            "application_id": app_id,
            "hr_user": None,
            "metadata": {
                "source": "website",
                "position_id": position_id,
                "position_title": job["position_title"],
                "actor": "public_candidate"
            }
        }).execute()
    except Exception:
        pass

    # Generate verification token for Step 2 (Skill Verification)
    verification_token = token_service.generate_skill_verification_token(app_id)

    return {
        "success": True,
        "message": "Application submitted successfully.",
        "application_id": app_id,
        "verification_token": verification_token,
        "verification_url": f"/apply/skills/{verification_token}"
    }

# ----------------------------------------------------
# Step 2: Post-Application Skill Verification
# ----------------------------------------------------

@router.get("/applications/skills/{token}")
def get_skills_for_verification(token: str):
    """Loads job-relevant skills for candidate verification using the secure verification token."""
    try:
        app_data = token_service.resolve_skill_verification_token(token)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(ve))

    job = app_data.get("job_requirements") or {}
    req_skills = job.get("required_skills") or []
    pref_skills = job.get("preferred_skills") or []

    # If job has no explicit skills configured, use domain fallbacks
    if not req_skills and not pref_skills:
        fallback = get_fallback_skills_for_job(job.get("position_title", ""), job.get("department", ""))
        req_skills = fallback[:6]
        pref_skills = fallback[6:]

    # Candidate provided initial skills from form
    initial_skills = app_data.get("skills") if isinstance(app_data.get("skills"), list) else []

    return {
        "application_id": app_data["application_id"],
        "candidate_name": app_data["candidate_name"],
        "position": app_data["position"],
        "department": app_data["department"],
        "required_skills": req_skills,
        "preferred_skills": pref_skills,
        "initial_skills": initial_skills,
        "already_verified": app_data.get("current_status") not in ("application_received", "under_review")
    }

class SkillRatingItem(BaseModel):
    skill: str
    rating: str  # beginner, intermediate, advanced, none

class SkillVerificationPayload(BaseModel):
    skills: List[SkillRatingItem]
    confirmed: bool

@router.post("/applications/skills/{token}/verify")
def submit_skill_verification(token: str, payload: SkillVerificationPayload):
    """Saves candidate verified skills, triggers ML recommendation, and advances status to ml_evaluated."""
    if not payload.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must confirm the accuracy of your verified skills."
        )

    if not payload.skills:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please rate at least one skill."
        )

    try:
        app_data = token_service.resolve_skill_verification_token(token)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(ve))

    app_id = app_data["application_id"]

    # Filter out skills with 'none' rating if desired, but keep valid verified skills
    verified_list = [item.model_dump() for item in payload.skills if item.skill.strip()]
    skill_names = [item.skill.strip() for item in payload.skills if item.skill.strip() and item.rating != "none"]

    if not skill_names:
        skill_names = [item.skill.strip() for item in payload.skills if item.skill.strip()]

    # Update application with verified skills
    now_iso = datetime.utcnow().isoformat()
    try:
        supabase.table("applications").update({
            "skills": skill_names,
            "current_status": "under_review"
        }).eq("application_id", app_id).execute()
    except Exception as e:
        logger.error(f"Failed to update verified skills: {e}")

    # Record Audit Log: CANDIDATE_SKILLS_VERIFIED
    try:
        supabase.table("audit_logs").insert({
            "action": "CANDIDATE_SKILLS_VERIFIED",
            "application_id": app_id,
            "hr_user": None,
            "metadata": {
                "verified_skills_count": len(verified_list),
                "actor": "public_candidate"
            }
        }).execute()
    except Exception:
        pass

    # Trigger ML Evaluation automatically
    ml_success = False
    try:
        ml_eval_service.evaluate_application(app_id)
        ml_success = True
    except Exception as e:
        logger.warning(f"Automatic ML evaluation for {app_id} deferred/failed: {e}")
        # Update status to ml_evaluated or keep under_review so HR can review
        try:
            supabase.table("applications").update({"current_status": "ml_evaluated"}).eq("application_id", app_id).execute()
        except Exception:
            pass

    return {
        "success": True,
        "message": "Skill verification complete. Your profile has been queued for recruitment review.",
        "ml_evaluated": ml_success
    }
