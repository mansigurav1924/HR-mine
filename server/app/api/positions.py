from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.dependencies.auth import require_hr_admin, get_current_user
from app.services.positions_service import PositionsService

router = APIRouter(prefix="/api/positions", tags=["Positions"])
service = PositionsService()

@router.get("")
def get_all_positions(current_user=Depends(get_current_user)):
    return service.get_all_positions()

@router.get("/{position_id}")
def get_position(position_id: str, current_user=Depends(get_current_user)):
    return service.get_position_by_id(position_id)

@router.post("")
def create_position(data: dict, current_user=Depends(require_hr_admin)):
    return service.create_position(data, current_user.id)

@router.patch("/{position_id}")
def update_position(position_id: str, data: dict, current_user=Depends(require_hr_admin)):
    return service.update_position(position_id, data, current_user.id)

@router.post("/{position_id}/publish")
def publish_position(position_id: str, current_user=Depends(require_hr_admin)):
    return service.change_position_status(position_id, "publish", current_user.id)

@router.post("/{position_id}/pause")
def pause_position(position_id: str, current_user=Depends(require_hr_admin)):
    return service.change_position_status(position_id, "pause", current_user.id)

@router.post("/{position_id}/close")
def close_position(position_id: str, current_user=Depends(require_hr_admin)):
    return service.change_position_status(position_id, "close", current_user.id)

@router.post("/{position_id}/reopen")
def reopen_position(position_id: str, data: dict = None, current_user=Depends(require_hr_admin)):
    return service.change_position_status(position_id, "reopen", current_user.id, data)

@router.post("/{position_id}/extend-deadline")
def extend_deadline(position_id: str, data: dict, current_user=Depends(require_hr_admin)):
    return service.change_position_status(position_id, "extend", current_user.id, data)

@router.post("/{position_id}/archive")
def archive_position(position_id: str, current_user=Depends(require_hr_admin)):
    return service.change_position_status(position_id, "archive", current_user.id)

@router.get("/{position_id}/stats")
def get_position_stats(position_id: str, current_user=Depends(get_current_user)):
    return service.get_position_stats(position_id)
