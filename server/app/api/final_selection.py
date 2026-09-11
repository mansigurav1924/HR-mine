from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from app.dependencies.auth import require_hr_admin
from app.schemas.final_selection import FinalSelectionRequest, FinalRejectRequest, FinalHoldRequest
from app.services.final_selection_service import FinalSelectionService

router = APIRouter()
service = FinalSelectionService()


# ------------------------------------------------------------------ #
#  LIST ENDPOINTS                                                       #
# ------------------------------------------------------------------ #

@router.get("/pending")
def get_pending_review(
    page: int = 1,
    page_size: int = 50,
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user=Depends(require_hr_admin),
):
    try:
        return service.get_pending_review(page, page_size, department, position, search)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Backward-compat alias
@router.get("/eligible")
def get_eligible_candidates(page: int = 1, page_size: int = 20, current_user=Depends(require_hr_admin)):
    try:
        return service.get_pending_review(page, page_size)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/selected")
def get_final_selected(
    page: int = 1,
    page_size: int = 50,
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user=Depends(require_hr_admin),
):
    try:
        return service.get_final_selected(page, page_size, department, position, search)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Backward-compat alias
@router.get("/")
def get_final_selected_candidates(page: int = 1, page_size: int = 20, current_user=Depends(require_hr_admin)):
    try:
        return service.get_final_selected(page, page_size)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rejected")
def get_rejected(
    page: int = 1,
    page_size: int = 50,
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user=Depends(require_hr_admin),
):
    try:
        return service.get_rejected(page, page_size, department, position, search)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hold")
def get_hold(
    page: int = 1,
    page_size: int = 50,
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user=Depends(require_hr_admin),
):
    try:
        return service.get_hold(page, page_size, department, position, search)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------------------------------------------------------ #
#  RECRUITMENT SUMMARY                                                  #
# ------------------------------------------------------------------ #

@router.get("/{application_id}/summary")
def get_recruitment_summary(application_id: str, current_user=Depends(require_hr_admin)):
    try:
        return service.get_recruitment_summary(application_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------------------------------------------------------ #
#  DECISION ENDPOINTS                                                   #
# ------------------------------------------------------------------ #

@router.post("/{application_id}/select")
def select_candidate(
    application_id: str,
    req: FinalSelectionRequest,
    current_user=Depends(require_hr_admin),
):
    try:
        return service.select_candidate(application_id, req, str(current_user.id))
    except HTTPException as he:
        raise he
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{application_id}/reject")
def reject_candidate(
    application_id: str,
    req: FinalRejectRequest,
    current_user=Depends(require_hr_admin),
):
    try:
        return service.reject_candidate(application_id, req, str(current_user.id))
    except HTTPException as he:
        raise he
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{application_id}/hold")
def hold_candidate(
    application_id: str,
    req: FinalHoldRequest,
    current_user=Depends(require_hr_admin),
):
    try:
        return service.hold_candidate(application_id, req, str(current_user.id))
    except HTTPException as he:
        raise he
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Backward-compat: old POST /{id} that only did final selection
@router.post("/{application_id}")
def confirm_final_selection(
    application_id: str,
    req: FinalSelectionRequest,
    current_user=Depends(require_hr_admin),
):
    try:
        return service.confirm_final_selection(application_id, req, str(current_user.id))
    except HTTPException as he:
        raise he
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
