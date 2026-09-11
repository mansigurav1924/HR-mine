from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import HTTPException
from app.services.supabase_client import supabase
import logging

logger = logging.getLogger(__name__)

class PositionsService:
    def _parse_iso(self, dt_str: str) -> Optional[datetime]:
        if not dt_str:
            return None
        dt_str = dt_str.replace('Z', '+00:00')
        try:
            return datetime.fromisoformat(dt_str)
        except ValueError:
            # Fallback for Python < 3.11 with non-6-digit fractional seconds
            if '.' in dt_str:
                main, rest = dt_str.split('.', 1)
                tz_sep = '+' if '+' in rest else '-' if '-' in rest else None
                if tz_sep:
                    frac, tz = rest.split(tz_sep, 1)
                    frac = (frac + '000000')[:6]
                    dt_str = f"{main}.{frac}{tz_sep}{tz}"
                else:
                    dt_str = f"{main}.{(rest + '000000')[:6]}"
            try:
                return datetime.fromisoformat(dt_str)
            except ValueError:
                return None

    def _calculate_effective_status(self, pos: Dict[str, Any]) -> str:
        if not pos.get('is_active', True):
            return "ARCHIVED"
            
        manual_status = pos.get('manual_application_status')
        if manual_status == "PAUSED":
            return "PAUSED"
        if manual_status == "CLOSED":
            return "CLOSED"
            
        pub_status = pos.get('publication_status', 'DRAFT')
        if pub_status == 'DRAFT':
            return "DRAFT"
            
        now = datetime.now(timezone.utc)
        
        open_at_str = pos.get('application_open_at')
        close_at_str = pos.get('application_close_at')
        
        open_at = self._parse_iso(open_at_str)
        close_at = self._parse_iso(close_at_str)
        
        if open_at and now < open_at:
            return "SCHEDULED"
            
        if close_at and now > close_at:
            return "CLOSED"
            
        return "OPEN"

    def get_all_positions(self) -> List[Dict[str, Any]]:
        try:
            resp = supabase.table("job_requirements").select("*, departments(name, code)").execute()
            positions = resp.data or []
            
            # Application counts
            app_resp = supabase.table("applications").select("position_id").execute()
            apps = app_resp.data or []
            
            app_counts = {}
            for app in apps:
                pid = app.get("position_id")
                if pid:
                    app_counts[pid] = app_counts.get(pid, 0) + 1
                    
            for p in positions:
                p["effective_status"] = self._calculate_effective_status(p)
                p["application_count"] = app_counts.get(p.get("position_id"), 0)
                
            return positions
        except Exception as e:
            logger.error(f"Error fetching positions: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch positions")

    def get_position_by_id(self, position_id: str) -> Dict[str, Any]:
        try:
            resp = supabase.table("job_requirements").select("*, departments(name, code)").eq("position_id", position_id).single().execute()
            if not resp.data:
                raise HTTPException(status_code=404, detail="Position not found")
            
            pos = resp.data
            pos["effective_status"] = self._calculate_effective_status(pos)
            return pos
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            logger.error(f"Error fetching position {position_id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch position")

    def create_position(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        try:
            # Validate dates
            if data.get('application_open_at') and data.get('application_close_at'):
                if data['application_close_at'] <= data['application_open_at']:
                    raise HTTPException(status_code=400, detail="Closing date must be after opening date")

            # Fallback department name logic if needed
            dept_name = None
            if data.get("department_id"):
                dept = supabase.table("departments").select("name").eq("department_id", data["department_id"]).single().execute()
                if dept.data:
                    dept_name = dept.data["name"]

            payload = {
                "department_id": data.get("department_id"),
                "department": dept_name,
                "position_title": data.get("position_title", "").strip(),
                "job_code": data.get("job_code", "").strip() or None,
                "description": data.get("description", "").strip() or None,
                "required_skills": data.get("required_skills", []),
                "preferred_skills": data.get("preferred_skills", []),
                "education": data.get("education", {}),
                "experience_min": data.get("experience_min"),
                "experience_max": data.get("experience_max"),
                "number_of_openings": data.get("number_of_openings", 1),
                "employment_type": data.get("employment_type", "Internship"),
                "work_mode": data.get("work_mode", "Remote"),
                "location": data.get("location", "").strip() or None,
                "application_open_at": data.get("application_open_at"),
                "application_close_at": data.get("application_close_at"),
                "publication_status": data.get("publication_status", "DRAFT"),
                "is_active": True,
                "created_by": user_id
            }
            
            resp = supabase.table("job_requirements").insert(payload).execute()
            
            if resp.data:
                try:
                    supabase.table("audit_logs").insert({
                        "action": "POSITION_CREATED",
                        "hr_user": str(user_id) if user_id else None,
                        "metadata": {"position_id": resp.data[0]["position_id"], "title": payload["position_title"]}
                    }).execute()
                except Exception as audit_err:
                    logger.warning(f"Audit log failed (non-critical): {audit_err}")
                
            return resp.data[0] if resp.data else {}
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            logger.error(f"Error creating position: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def update_position(self, position_id: str, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        try:
            # Validate dates
            if data.get('application_open_at') and data.get('application_close_at'):
                if data['application_close_at'] <= data['application_open_at']:
                    raise HTTPException(status_code=400, detail="Closing date must be after opening date")

            # Fallback department name logic if needed
            if data.get("department_id"):
                dept = supabase.table("departments").select("name").eq("department_id", data["department_id"]).single().execute()
                if dept.data:
                    data["department"] = dept.data["name"]

            allowed_keys = ["department_id", "department", "position_title", "job_code", "description", 
                            "required_skills", "preferred_skills", "education", "experience_min", "experience_max", 
                            "number_of_openings", "employment_type", "work_mode", "location", "application_open_at", 
                            "application_close_at", "publication_status"]
            payload = {k: v for k, v in data.items() if k in allowed_keys}
            
            resp = supabase.table("job_requirements").update(payload).eq("position_id", position_id).execute()
            
            if resp.data:
                try:
                    supabase.table("audit_logs").insert({
                        "action": "POSITION_UPDATED",
                        "hr_user": str(user_id) if user_id else None,
                        "metadata": {"position_id": position_id, "changes": payload}
                    }).execute()
                except Exception as audit_err:
                    logger.warning(f"Audit log failed (non-critical): {audit_err}")

            return resp.data[0] if resp.data else {}
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            logger.error(f"Error updating position: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def change_position_status(self, position_id: str, action: str, user_id: str, extra_data: dict = None) -> Dict[str, Any]:
        try:
            payload = {}
            audit_action = ""
            
            if action == "publish":
                payload = {"publication_status": "PUBLISHED", "manual_application_status": None}
                audit_action = "POSITION_PUBLISHED"
            elif action == "close":
                payload = {"manual_application_status": "CLOSED"}
                audit_action = "APPLICATIONS_CLOSED"
            elif action == "pause":
                payload = {"manual_application_status": "PAUSED"}
                audit_action = "APPLICATIONS_PAUSED"
            elif action == "reopen":
                payload = {"manual_application_status": None}
                if extra_data and "application_close_at" in extra_data:
                    payload["application_close_at"] = extra_data["application_close_at"]
                audit_action = "APPLICATIONS_REOPENED"
            elif action == "extend":
                if not extra_data or "application_close_at" not in extra_data:
                    raise HTTPException(status_code=400, detail="New closing date is required")
                payload = {"application_close_at": extra_data["application_close_at"], "manual_application_status": None}
                audit_action = "APPLICATION_DEADLINE_EXTENDED"
            elif action == "archive":
                # Check for active interviews?
                payload = {"is_active": False}
                audit_action = "POSITION_ARCHIVED"
            else:
                raise HTTPException(status_code=400, detail="Invalid action")

            resp = supabase.table("job_requirements").update(payload).eq("position_id", position_id).execute()
            
            if resp.data:
                try:
                    supabase.table("audit_logs").insert({
                        "action": audit_action,
                        "hr_user": str(user_id) if user_id else None,
                        "metadata": {"position_id": position_id, "changes": payload}
                    }).execute()
                except Exception as audit_err:
                    logger.warning(f"Audit log failed (non-critical): {audit_err}")

                pos = resp.data[0]
                pos["effective_status"] = self._calculate_effective_status(pos)
                return pos
            return {}
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            logger.error(f"Error changing position status: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def get_position_stats(self, position_id: str) -> Dict[str, Any]:
        try:
            resp = supabase.table("applications").select("current_status").eq("position_id", position_id).execute()
            apps = resp.data or []
            
            stats = {
                "Total Applications": len(apps),
                "ML Recommended": 0,
                "Shortlisted": 0,
                "Assessment Passed": 0,
                "AI Interview Done": 0,
                "Human Interview Ready": 0,
                "Final Selected": 0,
                "Offers Sent": 0,
                "Hired": 0
            }
            
            for app in apps:
                st = app.get("current_status")
                if st in ('ml_recommended', 'ml_evaluated'):
                    stats["ML Recommended"] += 1
                elif st in ('shortlisted', 'human_shortlisted'):
                    stats["Shortlisted"] += 1
                elif st in ('assessment_passed', 'assessment_completed'):
                    stats["Assessment Passed"] += 1
                elif st in ('ai_interview_completed', 'human_interview_ready', 'interview_scheduled'):
                    stats["AI Interview Done"] += 1
                    if st in ('human_interview_ready', 'interview_scheduled'):
                        stats["Human Interview Ready"] += 1
                elif st == 'final_selected':
                    stats["Final Selected"] += 1
                elif st in ('offer_extended', 'offer_sent'):
                    stats["Offers Sent"] += 1
                elif st in ('onboarding', 'hired', 'onboarding_handoff_ready'):
                    stats["Hired"] += 1
                    
            return stats
        except Exception as e:
            logger.error(f"Error fetching position stats: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch position stats")
