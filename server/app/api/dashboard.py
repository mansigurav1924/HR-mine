from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from app.dependencies.auth import require_hr_admin
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])
service = DashboardService()

@router.get("")
def get_dashboard(
    department: Optional[str] = Query(None),
    position_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user = Depends(require_hr_admin)
):
    try:
        return service.get_dashboard_metrics(
            department=department,
            position_id=position_id,
            date_from=date_from,
            date_to=date_to
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/department/{department}")
def get_department_dashboard(
    department: str,
    current_user = Depends(require_hr_admin)
):
    try:
        return service.get_department_dashboard(department=department)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
