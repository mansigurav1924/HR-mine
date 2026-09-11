from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies.auth import require_hr_admin
from app.services.search_service import SearchService

router = APIRouter(prefix="/api/search", tags=["Search"])
service = SearchService()

@router.get("")
def global_search(
    q: str = Query(..., min_length=1),
    current_user = Depends(require_hr_admin)
):
    try:
        return service.global_search(q)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
