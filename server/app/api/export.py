from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from typing import Optional
from app.dependencies.auth import require_hr_admin
from app.services.export_service import ExportService

router = APIRouter(prefix="/api/export", tags=["Export"])
service = ExportService()

@router.get("/{resource}")
def export_resource(
    resource: str,
    format: str = Query("csv"),
    department: Optional[str] = Query(None),
    position_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    offer_status: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user = Depends(require_hr_admin)
):
    try:
        filters = {
            "department": department,
            "position_id": position_id,
            "status": status,
            "offer_status": offer_status,
            "action": action,
            "role": role,
            "date_from": date_from,
            "date_to": date_to,
        }
        # Clean None values
        filters = {k: v for k, v in filters.items() if v is not None}

        buffer, filename, media_type = service.export_resource(
            resource=resource,
            export_format=format,
            filters=filters
        )

        return StreamingResponse(
            buffer,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
