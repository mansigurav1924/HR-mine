import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel
from typing import Optional, List
from app.dependencies.auth import require_hr_admin
from app.services.supabase_client import supabase

router = APIRouter()

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

def validate_resume_file(filename: str, content: bytes, content_type: Optional[str] = None) -> str:
    """Validates file size, extension whitelist, and magic bytes."""
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum allowed limit of 5 MB."
        )

    ext = filename.lower().split('.')[-1] if '.' in filename else ''
    if ext not in ('pdf', 'docx'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file extension. Only .pdf and .docx files are permitted."
        )

    # Magic byte check
    if ext == 'pdf':
        if not content.startswith(b'%PDF-'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Corrupted or invalid PDF file header signature."
            )
    elif ext == 'docx':
        if not content.startswith(b'PK\x03\x04'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Corrupted or invalid DOCX file header signature."
            )

    return ext

@router.get("/")
def list_applications(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    department: Optional[str] = None,
    position_id: Optional[str] = None,
    current_user = Depends(require_hr_admin)
):
    query = supabase.table("applications").select("*").order("created_at", desc=True)
    
    if status_filter and status_filter.lower() != 'all':
        query = query.eq("current_status", status_filter)
    if department and department.lower() != 'all':
        query = query.eq("department", department)
    if position_id and position_id.lower() != 'all':
        query = query.eq("position_id", position_id)
        
    try:
        response = query.execute()
        data = response.data or []
        
        if search:
            search_lower = search.lower().strip()
            data = [
                app for app in data 
                if search_lower in app.get('candidate_name', '').lower() or 
                   search_lower in app.get('email', '').lower() or
                   search_lower in app.get('position', '').lower()
            ]
            
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
async def add_application(
    candidate_name: str = Form(...),
    email: str = Form(...),
    phone: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    position: Optional[str] = Form(None),
    resume: UploadFile = File(...),
    current_user = Depends(require_hr_admin)
):
    resume_url = None
    if resume:
        file_content = await resume.read()
        file_ext = validate_resume_file(resume.filename or 'resume.pdf', file_content, resume.content_type)
        file_path = f"{uuid.uuid4()}.{file_ext}"
        
        try:
            supabase.storage.from_("resumes").upload(
                file=file_content, 
                path=file_path, 
                file_options={"content-type": resume.content_type or ("application/pdf" if file_ext == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
            )
            resume_url = file_path
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to securely store resume: {str(e)}")

    try:
        data_to_insert = {
            "candidate_name": candidate_name.strip(),
            "email": email.strip().lower(),
            "phone": phone.strip() if phone else None,
            "department": department.strip() if department else None,
            "position": position.strip() if position else None,
            "resume_url": resume_url,
            "current_status": "application_received",
            "source": "website"
        }
        
        response = supabase.table("applications").insert(data_to_insert).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save application: {str(e)}")

@router.get("/{application_id}")
def get_application(application_id: str, current_user = Depends(require_hr_admin)):
    try:
        response = supabase.table("applications").select("*").eq("application_id", application_id).single().execute()
        app_data = response.data
        if not app_data:
            raise HTTPException(status_code=404, detail="Application not found.")
        
        if app_data.get("resume_url"):
            try:
                signed_url_res = supabase.storage.from_("resumes").create_signed_url(app_data["resume_url"], 3600)
                app_data["resume_signed_url"] = signed_url_res.get("signedURL") or signed_url_res.get("signedUrl")
            except Exception as e:
                app_data["resume_signed_url"] = None
                app_data["resume_error"] = f"Could not generate signed URL: {str(e)}"
                
        return app_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Application not found: {str(e)}")

class ApplicationUpdate(BaseModel):
    current_status: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[list] = None
    education: Optional[list] = None
    experience: Optional[list] = None
    projects: Optional[list] = None
    is_parsed_data_applied: Optional[bool] = False
    
@router.put("/{application_id}")
def update_application(
    application_id: str, 
    update_data: ApplicationUpdate,
    current_user = Depends(require_hr_admin)
):
    try:
        data_to_update = {k: v for k, v in update_data.model_dump(exclude={'is_parsed_data_applied'}).items() if v is not None}
        
        if not data_to_update:
            return supabase.table("applications").select("*").eq("application_id", application_id).single().execute().data
            
        response = supabase.table("applications").update(data_to_update).eq("application_id", application_id).execute()
        
        if update_data.is_parsed_data_applied:
            audit_metadata = {
                "skills_count": len(update_data.skills) if update_data.skills else 0,
                "education_entries": len(update_data.education) if update_data.education else 0,
                "experience_entries": len(update_data.experience) if update_data.experience else 0,
                "project_entries": len(update_data.projects) if update_data.projects else 0,
            }
            audit_log = {
                "hr_user": current_user.id,
                "action": "RESUME_PARSED_DATA_APPLIED",
                "application_id": application_id,
                "metadata": audit_metadata
            }
            supabase.table("audit_logs").insert(audit_log).execute()
            
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update application: {str(e)}")
