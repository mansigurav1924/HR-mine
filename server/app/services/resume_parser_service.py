import logging
from app.services.supabase_client import supabase
from app.services.pdf_parser import extract_text_from_pdf, is_scanned_or_empty_pdf
from app.services.docx_parser import extract_text_from_docx
from app.services.profile_extractor import extract_profile
from app.schemas.resume_parser import ParseResumeResponse, ParsedProfile

logger = logging.getLogger(__name__)

def parse_resume_for_application(application_id: str) -> ParseResumeResponse:
    # 1. Fetch application to get resume_url
    try:
        app_res = supabase.table("applications").select("resume_url").eq("application_id", application_id).single().execute()
        app_data = app_res.data
    except Exception as e:
        raise ValueError("Application not found.")
    
    if not app_data or not app_data.get("resume_url"):
        raise ValueError("Application has no resume attached.")
        
    resume_path = app_data["resume_url"]
    file_ext = resume_path.split('.')[-1].lower() if '.' in resume_path else ''
    
    # 2. Download from Supabase private storage
    try:
        storage_res = supabase.storage.from_("resumes").download(resume_path)
    except Exception as e:
        logger.error(f"Failed to download resume from storage: {e}")
        raise ValueError("Failed to download resume from private storage.")

    warnings = []
    text = ""
    file_type = "unknown"
    parser_status = "success"
    
    # 3. Extract Text
    if file_ext == 'pdf':
        file_type = "pdf"
        try:
            text = extract_text_from_pdf(storage_res)
            if is_scanned_or_empty_pdf(text):
                warnings.append("This PDF appears to be scanned or contains insufficient extractable text. Manual review is required.")
                parser_status = "manual_review_required"
        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            raise ValueError("Failed to parse PDF file.")
            
    elif file_ext in ['doc', 'docx']:
        file_type = "docx"
        try:
            text = extract_text_from_docx(storage_res)
        except Exception as e:
            logger.error(f"DOCX extraction failed: {e}")
            raise ValueError("Failed to parse DOCX file.")
    else:
        raise ValueError(f"Unsupported file extension: {file_ext}")
        
    # 4. Extract Structured Data
    profile_data = extract_profile(text)
    
    if parser_status == "success":
        total_items = len(profile_data["skills"]) + len(profile_data["education"]) + len(profile_data["experience"]) + len(profile_data["projects"])
        if total_items == 0 and text.strip():
            warnings.append("Could not confidently extract structured sections. Please review the resume manually.")
            parser_status = "partial"
            
    return ParseResumeResponse(
        application_id=application_id,
        parser_status=parser_status,
        file_type=file_type,
        parsed_profile=ParsedProfile(**profile_data),
        warnings=warnings
    )
