from fastapi import APIRouter, Depends, HTTPException
from app.dependencies.auth import get_current_user
from app.schemas.offer_template import OfferTemplateCreateRequest, OfferTemplateVersionRequest, OfferTemplateActiveRequest
from app.services.offer_template_service import OfferTemplateService

router = APIRouter()
service = OfferTemplateService()

def require_hr_admin(current_user):
    if current_user.role != "hr_admin":
        raise HTTPException(status_code=403, detail="Not authorized. HR Admin only.")
    return current_user

@router.get("/")
def get_templates(current_user = Depends(require_hr_admin)):
    try:
        return service.get_templates()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{template_id}")
def get_template(template_id: str, current_user = Depends(require_hr_admin)):
    try:
        return service.get_template(template_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_template(req: OfferTemplateCreateRequest, current_user = Depends(require_hr_admin)):
    try:
        return service.create_template(req, current_user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{template_id}/new-version")
def create_new_version(template_id: str, req: OfferTemplateVersionRequest, current_user = Depends(require_hr_admin)):
    try:
        return service.create_new_version(template_id, req, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{template_id}/active")
def update_active_status(template_id: str, req: OfferTemplateActiveRequest, current_user = Depends(require_hr_admin)):
    try:
        return service.update_active_status(template_id, req, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
