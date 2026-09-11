from fastapi import APIRouter, Depends, HTTPException
from app.dependencies.auth import require_hr_admin
from app.schemas.onboarding import OnboardingCreate, ChecklistUpdate, ITProvisioningUpdate, HRISStatusUpdate
from app.services.onboarding_service import OnboardingService

router = APIRouter(prefix="/api/onboarding", tags=["Onboarding"])
service = OnboardingService()

@router.post("/{application_id}")
def create_onboarding_handoff(application_id: str, req: OnboardingCreate, current_user = Depends(require_hr_admin)):
    try:
        return service.create_handoff(application_id, req, current_user.id)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
def get_onboarding_list(status: str = None, page: int = 1, page_size: int = 20, current_user = Depends(require_hr_admin)):
    try:
        return service.get_onboarding_list(status, page, page_size)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ready")
def get_ready_for_handoff(current_user = Depends(require_hr_admin)):
    try:
        return service.get_ready_for_handoff()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{handoff_id}")
def get_onboarding_detail(handoff_id: str, current_user = Depends(require_hr_admin)):
    try:
        return service.get_handoff_detail(handoff_id)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{handoff_id}/checklist")
def update_checklist(handoff_id: str, req: ChecklistUpdate, current_user = Depends(require_hr_admin)):
    try:
        return service.update_checklist(handoff_id, req, current_user.id)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{handoff_id}/it-provisioning")
def update_it_provisioning(handoff_id: str, req: ITProvisioningUpdate, current_user = Depends(require_hr_admin)):
    try:
        return service.update_it_provisioning(handoff_id, req, current_user.id)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{handoff_id}/hris-status")
def update_hris_status(handoff_id: str, req: HRISStatusUpdate, current_user = Depends(require_hr_admin)):
    try:
        return service.update_hris_status(handoff_id, req, current_user.id)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{handoff_id}/complete")
def complete_onboarding_handoff(handoff_id: str, current_user = Depends(require_hr_admin)):
    try:
        return service.complete_handoff(handoff_id, current_user.id)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
