from typing import Dict, Any, List
from app.services.supabase_client import supabase

class SearchService:
    def global_search(self, query_str: str) -> Dict[str, List[Dict[str, Any]]]:
        q = query_str.strip()
        if len(q) < 2:
            return {"applications": [], "interviews": [], "offers": []}

        # 1. Search Applications (name, email, position, department)
        # Using Supabase ilike or or_ filter
        app_resp = supabase.table("applications").select(
            "application_id, candidate_name, email, department, position, current_status"
        ).or_(
            f"candidate_name.ilike.%{q}%,email.ilike.%{q}%,position.ilike.%{q}%,department.ilike.%{q}%"
        ).limit(8).execute()

        matched_apps = app_resp.data or []

        # 2. Search Interviews
        intv_resp = supabase.table("interviews").select(
            "interview_id, application_id, round_number, date, time, status, applications(candidate_name, position, department)"
        ).or_(
            f"status.ilike.%{q}%"
        ).limit(5).execute()

        # Also search interviews by candidate name if found
        app_ids = [a["application_id"] for a in matched_apps]
        if app_ids:
            intv_by_app = supabase.table("interviews").select(
                "interview_id, application_id, round_number, date, time, status, applications(candidate_name, position, department)"
            ).in_("application_id", app_ids[:5]).limit(5).execute()
            
            existing_ids = {i["interview_id"] for i in (intv_resp.data or [])}
            for i in (intv_by_app.data or []):
                if i["interview_id"] not in existing_ids:
                    intv_resp.data.append(i)

        formatted_interviews = []
        for i in (intv_resp.data or [])[:5]:
            app = i.get("applications") or {}
            formatted_interviews.append({
                "interview_id": i.get("interview_id"),
                "application_id": i.get("application_id"),
                "candidate_name": app.get("candidate_name", "Unknown"),
                "position": app.get("position", "Unknown"),
                "round_number": i.get("round_number"),
                "date": i.get("date"),
                "status": i.get("status")
            })

        # 3. Search Offers
        offer_resp = supabase.table("offers").select(
            "offer_id, application_id, designation, department, offer_status, email, applications(candidate_name)"
        ).or_(
            f"designation.ilike.%{q}%,email.ilike.%{q}%,department.ilike.%{q}%"
        ).limit(5).execute()

        if app_ids:
            offers_by_app = supabase.table("offers").select(
                "offer_id, application_id, designation, department, offer_status, email, applications(candidate_name)"
            ).in_("application_id", app_ids[:5]).limit(5).execute()

            existing_offer_ids = {o["offer_id"] for o in (offer_resp.data or [])}
            for o in (offers_by_app.data or []):
                if o["offer_id"] not in existing_offer_ids:
                    offer_resp.data.append(o)

        formatted_offers = []
        for o in (offer_resp.data or [])[:5]:
            app = o.get("applications") or {}
            formatted_offers.append({
                "offer_id": o.get("offer_id"),
                "application_id": o.get("application_id"),
                "candidate_name": app.get("candidate_name") or o.get("email"),
                "designation": o.get("designation"),
                "department": o.get("department"),
                "offer_status": o.get("offer_status")
            })

        return {
            "applications": matched_apps,
            "interviews": formatted_interviews,
            "offers": formatted_offers
        }
