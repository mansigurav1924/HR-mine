from typing import Optional, Dict, Any
from app.services.supabase_client import supabase

class AuditService:
    def get_audit_logs(
        self,
        action: Optional[str] = None,
        role: Optional[str] = None,
        application_id: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        query = supabase.table("audit_logs").select(
            "log_id, hr_user, role, action, candidate_id, application_id, timestamp, previous_status, new_status, metadata, users(email), applications(candidate_name)",
            count="exact"
        )

        if action and action.strip() and action.lower() != 'all':
            query = query.eq("action", action.strip())
        if role and role.strip() and role.lower() != 'all':
            query = query.eq("role", role.strip())
        if application_id and application_id.strip():
            query = query.eq("application_id", application_id.strip())
        if date_from:
            query = query.gte("timestamp", date_from)
        if date_to:
            query = query.lte("timestamp", date_to)

        query = query.order("timestamp", desc=True)
        query = query.range((page - 1) * page_size, page * page_size - 1)

        resp = query.execute()
        total = resp.count if resp.count is not None else len(resp.data or [])

        # Fetch distinct actions for filters
        distinct_actions_resp = supabase.table("audit_logs").select("action").execute()
        distinct_actions = sorted(list({r["action"] for r in (distinct_actions_resp.data or []) if r.get("action")}))

        return {
            "logs": resp.data or [],
            "total": total,
            "page": page,
            "page_size": page_size,
            "available_actions": distinct_actions,
            "available_roles": ["hr_admin", "interviewer", "system"]
        }
