from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from app.dependencies.auth import require_hr_admin
from app.services.audit_service import AuditService

router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])
service = AuditService()

@router.get("")
def get_audit_logs(
    action: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    application_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user = Depends(require_hr_admin)
):
    try:
        return service.get_audit_logs(
            action=action,
            role=role,
            application_id=application_id,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
