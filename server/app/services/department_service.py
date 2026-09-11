from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from app.services.supabase_client import supabase
import logging

logger = logging.getLogger(__name__)

class DepartmentService:
    def get_all_departments(self) -> List[Dict[str, Any]]:
        try:
            resp = supabase.table("departments").select("*").order("name").execute()
            
            # Fetch position counts manually
            depts = resp.data or []
            pos_resp = supabase.table("job_requirements").select("department_id, is_active").execute()
            positions = pos_resp.data or []
            
            for d in depts:
                dept_positions = [p for p in positions if p.get("department_id") == d["department_id"]]
                d["position_count"] = len(dept_positions)
                d["open_position_count"] = len([p for p in dept_positions if p.get("is_active")])
                
            return depts
        except Exception as e:
            logger.error(f"Error fetching departments: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch departments")

    def get_department_by_id(self, department_id: str) -> Dict[str, Any]:
        try:
            resp = supabase.table("departments").select("*").eq("department_id", department_id).single().execute()
            if not resp.data:
                raise HTTPException(status_code=404, detail="Department not found")
            return resp.data
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            logger.error(f"Error fetching department {department_id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch department")

    def create_department(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        try:
            # Check for duplicates (case insensitive name)
            existing = supabase.table("departments").select("department_id").ilike("name", data.get("name", "").strip()).execute()
            if existing.data:
                raise HTTPException(status_code=400, detail="Department with this name already exists")
                
            payload = {
                "name": data.get("name", "").strip(),
                "code": data.get("code", "").strip() or None,
                "description": data.get("description", "").strip() or None,
                "is_active": data.get("is_active", True),
                "created_by": user_id
            }
            resp = supabase.table("departments").insert(payload).execute()
            
            # Log audit
            if resp.data:
                try:
                    supabase.table("audit_logs").insert({
                        "action": "DEPARTMENT_CREATED",
                        "hr_user": str(user_id) if user_id else None,
                        "metadata": {"department_id": resp.data[0]["department_id"], "name": payload["name"]}
                    }).execute()
                except Exception as audit_err:
                    logger.warning(f"Audit log failed (non-critical): {audit_err}")
                
            return resp.data[0] if resp.data else {}
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            logger.error(f"Error creating department: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def update_department(self, department_id: str, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        try:
            # If changing name, check dupe
            if "name" in data:
                existing = supabase.table("departments").select("department_id").ilike("name", data.get("name", "").strip()).neq("department_id", department_id).execute()
                if existing.data:
                    raise HTTPException(status_code=400, detail="Department with this name already exists")

            payload = {k: v for k, v in data.items() if k in ["name", "code", "description", "is_active"]}
            
            resp = supabase.table("departments").update(payload).eq("department_id", department_id).execute()
            
            action = "DEPARTMENT_DISABLED" if payload.get("is_active") is False else "DEPARTMENT_UPDATED"
            try:
                supabase.table("audit_logs").insert({
                    "action": action,
                    "hr_user": str(user_id) if user_id else None,
                    "metadata": {"department_id": department_id, "changes": payload}
                }).execute()
            except Exception as audit_err:
                logger.warning(f"Audit log failed (non-critical): {audit_err}")

            return resp.data[0] if resp.data else {}
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            logger.error(f"Error updating department {department_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def toggle_department_status(self, department_id: str, is_active: bool, user_id: str) -> Dict[str, Any]:
        return self.update_department(department_id, {"is_active": is_active}, user_id)
