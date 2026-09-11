from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from app.dependencies.auth import require_hr_admin
from app.services.reports_service import ReportsService

router = APIRouter(prefix="/api/reports", tags=["Reports"])
service = ReportsService()

@router.get("/funnel")
def get_funnel_report(
    department: Optional[str] = Query(None),
    position_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user = Depends(require_hr_admin)
):
    try:
        return service.get_funnel_report(department, position_id, date_from, date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/departments")
def get_departments_report(
    department: Optional[str] = Query(None),
    position_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user = Depends(require_hr_admin)
):
    try:
        return service.get_departments_report(department, position_id, date_from, date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/positions")
def get_positions_report(
    department: Optional[str] = Query(None),
    position_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user = Depends(require_hr_admin)
):
    try:
        return service.get_positions_report(department, position_id, date_from, date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/application-sources")
def get_application_sources_report(
    department: Optional[str] = Query(None),
    position_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user = Depends(require_hr_admin)
):
    try:
        return service.get_application_sources_report(department, position_id, date_from, date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/assessments")
def get_assessments_report(
    department: Optional[str] = Query(None),
    position_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user = Depends(require_hr_admin)
):
    try:
        return service.get_assessments_report(department, position_id, date_from, date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/interviews")
def get_interviews_report(
    department: Optional[str] = Query(None),
    position_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user = Depends(require_hr_admin)
):
    try:
        return service.get_interviews_report(department, position_id, date_from, date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/offers")
def get_offers_report(
    department: Optional[str] = Query(None),
    position_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user = Depends(require_hr_admin)
):
    try:
        return service.get_offers_report(department, position_id, date_from, date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/onboarding")
def get_onboarding_report(
    department: Optional[str] = Query(None),
    position_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user = Depends(require_hr_admin)
):
    try:
        return service.get_onboarding_report(department, position_id, date_from, date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
