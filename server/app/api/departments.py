from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.dependencies.auth import require_hr_admin, get_current_user
from app.services.department_service import DepartmentService

router = APIRouter(prefix="/api/departments", tags=["Departments"])
service = DepartmentService()

@router.get("")
def get_all_departments(current_user=Depends(get_current_user)):
    return service.get_all_departments()

@router.get("/{department_id}")
def get_department(department_id: str, current_user=Depends(get_current_user)):
    return service.get_department_by_id(department_id)

@router.post("")
def create_department(data: dict, current_user=Depends(require_hr_admin)):
    return service.create_department(data, current_user.id)

@router.patch("/{department_id}")
def update_department(department_id: str, data: dict, current_user=Depends(require_hr_admin)):
    return service.update_department(department_id, data, current_user.id)

@router.post("/{department_id}/disable")
def disable_department(department_id: str, current_user=Depends(require_hr_admin)):
    return service.toggle_department_status(department_id, False, current_user.id)

@router.post("/{department_id}/enable")
def enable_department(department_id: str, current_user=Depends(require_hr_admin)):
    return service.toggle_department_status(department_id, True, current_user.id)
