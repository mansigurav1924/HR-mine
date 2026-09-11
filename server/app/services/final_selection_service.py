from datetime import datetime, timezone
from typing import Optional, List
from fastapi import HTTPException
from app.services.supabase_client import supabase
from app.schemas.final_selection import FinalSelectionRequest, FinalRejectRequest, FinalHoldRequest
import logging

logger = logging.getLogger(__name__)

# Statuses eligible for final review.
# IMPORTANT: After running migration 011b, uncomment the additional statuses below.
ELIGIBLE_STATUSES = [
    "interview_selected",
    "human_interview_ready",
    "human_interview_completed",
    "final_review_pending",
]

# These statuses require migration 011b to be run in Supabase first.
FINAL_SELECTED_STATUS = "final_selected"
FINAL_REJECTED_STATUS = "final_rejected"
FINAL_HOLD_STATUS = "final_hold"


class FinalSelectionService:

    # ------------------------------------------------------------------ #
    #  LIST ENDPOINTS                                                       #
    # ------------------------------------------------------------------ #

    def get_pending_review(self, page=1, page_size=50,
                           department=None, position=None, search=None):
        """Candidates with human interview completed that require HR final decision."""
        try:
            query = (
                supabase.table("applications")
                .select(
                    "application_id, candidate_name, email, phone, "
                    "department, position, current_status, updated_at, position_id"
                )
                .in_("current_status", ELIGIBLE_STATUSES)
            )
            if department:
                query = query.ilike("department", f"%{department}%")
            if position:
                query = query.ilike("position", f"%{position}%")
            if search:
                query = query.ilike("candidate_name", f"%{search}%")

            query = query.order("updated_at", desc=True)
            query = query.range((page - 1) * page_size, page * page_size - 1)
            apps = query.execute().data or []

            for app in apps:
                self._enrich_with_latest_interview(app, app["application_id"])

            return apps
        except Exception as e:
            logger.error(f"Error fetching pending review: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch pending review candidates")

    def get_final_selected(self, page=1, page_size=50,
                           department=None, position=None, search=None):
        try:
            query = (
                supabase.table("applications")
                .select(
                    "application_id, candidate_name, email, department, position, "
                    "current_status, final_decision_at, final_decision_by, "
                    "final_decision_notes, offer_eligible, updated_at"
                )
                .eq("current_status", FINAL_SELECTED_STATUS)
            )
            if department:
                query = query.ilike("department", f"%{department}%")
            if position:
                query = query.ilike("position", f"%{position}%")
            if search:
                query = query.ilike("candidate_name", f"%{search}%")
            query = query.order("final_decision_at", desc=True)
            query = query.range((page - 1) * page_size, page * page_size - 1)
            return query.execute().data or []
        except Exception as e:
            logger.error(f"Error fetching final selected: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch final selected candidates")

    def get_rejected(self, page=1, page_size=50,
                     department=None, position=None, search=None):
        try:
            query = (
                supabase.table("applications")
                .select(
                    "application_id, candidate_name, email, department, position, "
                    "current_status, final_decision_at, final_decision_by, "
                    "final_rejection_reason, updated_at"
                )
                .eq("current_status", FINAL_REJECTED_STATUS)
            )
            if department:
                query = query.ilike("department", f"%{department}%")
            if position:
                query = query.ilike("position", f"%{position}%")
            if search:
                query = query.ilike("candidate_name", f"%{search}%")
            query = query.order("final_decision_at", desc=True)
            query = query.range((page - 1) * page_size, page * page_size - 1)
            return query.execute().data or []
        except Exception as e:
            logger.error(f"Error fetching rejected: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch rejected candidates")

    def get_hold(self, page=1, page_size=50,
                 department=None, position=None, search=None):
        try:
            query = (
                supabase.table("applications")
                .select(
                    "application_id, candidate_name, email, department, position, "
                    "current_status, final_decision_at, final_decision_by, "
                    "final_decision_notes, updated_at"
                )
                .eq("current_status", FINAL_HOLD_STATUS)
            )
            if department:
                query = query.ilike("department", f"%{department}%")
            if position:
                query = query.ilike("position", f"%{position}%")
            if search:
                query = query.ilike("candidate_name", f"%{search}%")
            query = query.order("final_decision_at", desc=True)
            query = query.range((page - 1) * page_size, page * page_size - 1)
            apps = query.execute().data or []
            for app in apps:
                dec = self._get_latest_decision(app["application_id"])
                app["hold_reason"] = dec.get("reason") if dec else None
                app["hold_review_date"] = dec.get("hold_review_date") if dec else None
            return apps
        except Exception as e:
            logger.error(f"Error fetching on-hold: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch on-hold candidates")

    # Backward-compat aliases
    def get_eligible_candidates(self, page=1, page_size=20):
        return self.get_pending_review(page=page, page_size=page_size)

    def get_final_selected_candidates(self, page=1, page_size=20):
        return self.get_final_selected(page=page, page_size=page_size)

    # ------------------------------------------------------------------ #
    #  RECRUITMENT SUMMARY                                                  #
    # ------------------------------------------------------------------ #

    def get_recruitment_summary(self, application_id: str):
        app_resp = supabase.table("applications").select(
            "application_id, candidate_name, email, phone, department, position, "
            "current_status, skills, experience, projects, education, "
            "github, linkedin, portfolio, "
            "resume_url, application_date, offer_eligible, "
            "final_decision_notes, final_rejection_reason, final_decision_at"
        ).eq("application_id", application_id).single().execute()

        if not app_resp.data:
            raise ValueError("Application not found.")

        summary = {
            "candidate": app_resp.data,
            "ml": None,
            "assessment": None,
            "ai_interview": None,
            "human_interviews": [],
            "decision_history": [],
        }

        # ML Evaluation (separate table)
        try:
            ml_resp = supabase.table("ml_evaluations").select(
                "predicted_class, match_score, matching_skills, missing_skills, recommendation"
            ).eq("application_id", application_id).order("created_at", desc=True).limit(1).execute()
            if ml_resp.data:
                summary["ml"] = ml_resp.data[0]
        except Exception:
            pass  # ML table may not exist or have data

        # Assessment
        try:
            assess_resp = supabase.table("assessments").select(
                "score, result, pass_threshold, completed_at, integrity_status, "
                "tab_switches, fullscreen_exits, copy_paste_attempts, "
                "total_questions, correct_answers, incorrect_answers, timed_out_answers, "
                "raw_score, integrity_penalty, adjusted_score"
            ).eq("application_id", application_id).order("created_at", desc=True).limit(1).execute()
            if assess_resp.data:
                summary["assessment"] = assess_resp.data[0]
        except Exception:
            pass

        # AI Interview (placeholder)
        try:
            ai_resp = supabase.table("ai_interviews").select(
                "completed_at, hr_review_status, hr_notes, status"
            ).eq("application_id", application_id).order("created_at", desc=True).limit(1).execute()
            if ai_resp.data:
                summary["ai_interview"] = ai_resp.data[0]
        except Exception:
            pass

        # Human Interviews — all rounds with full evaluations
        try:
            hi_resp = supabase.table("interviews").select(
                "interview_id, round_number, type, attendance, status, date, time, interviewer_id"
            ).eq("application_id", application_id).order("round_number", desc=False).execute()

            for hi in (hi_resp.data or []):
                # Resolve interviewer from users table
                try:
                    iid = hi.get("interviewer_id")
                    if iid:
                        u = supabase.table("users").select("email").eq("user_id", iid).single().execute()
                        hi["interviewer_email"] = u.data["email"] if u.data else None
                        hi["interviewer_name"] = u.data["email"].split("@")[0].capitalize() if u.data else "N/A"
                    else:
                        hi["interviewer_email"] = None
                        hi["interviewer_name"] = "N/A"
                except Exception:
                    hi["interviewer_email"] = None
                    hi["interviewer_name"] = "N/A"
                try:
                    eval_resp = supabase.table("interview_evaluations").select(
                        "overall_score, decision, notes, "
                        "technical_knowledge_score, problem_solving_score, "
                        "communication_score, relevant_skills_score"
                    ).eq("interview_id", hi["interview_id"]).execute()
                    hi["evaluation"] = eval_resp.data[0] if eval_resp.data else None
                except Exception:
                    hi["evaluation"] = None
                summary["human_interviews"].append(hi)
        except Exception:
            pass

        # Decision history from dedicated table
        try:
            dec_resp = supabase.table("final_selection_decisions").select("*").eq(
                "application_id", application_id
            ).order("decided_at", desc=False).execute()
            summary["decision_history"] = dec_resp.data or []
        except Exception:
            pass

        return summary

    # ------------------------------------------------------------------ #
    #  DECISION ACTIONS                                                     #
    # ------------------------------------------------------------------ #

    def select_candidate(self, application_id: str, req: FinalSelectionRequest, hr_id: str):
        app = self._get_app(application_id)
        current = app["current_status"]

        allowed = ELIGIBLE_STATUSES + [FINAL_HOLD_STATUS]
        if current not in allowed:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot select: current status is '{current}'. Must be in pending review or on-hold."
            )

        now = datetime.now(timezone.utc).isoformat()

        # Write decision record
        try:
            supabase.table("final_selection_decisions").insert({
                "application_id": application_id,
                "decision": "selected",
                "hr_notes": req.notes or "",
                "decided_by": hr_id,
                "decided_at": now,
            }).execute()
        except Exception as e:
            logger.warning(f"Could not write decision record: {e}")

        # Update application status
        supabase.table("applications").update({
            "current_status": FINAL_SELECTED_STATUS,
            "offer_eligible": True,
            "final_decision_at": now,
            "final_decision_by": hr_id,
            "final_decision_notes": req.notes or "",
        }).eq("application_id", application_id).execute()

        self._audit(application_id, "FINAL_CANDIDATE_SELECTED", hr_id, {
            "previous_status": current, "notes": req.notes
        })
        return {"success": True, "message": "Candidate confirmed as Final Selected"}

    def reject_candidate(self, application_id: str, req: FinalRejectRequest, hr_id: str):
        app = self._get_app(application_id)
        current = app["current_status"]

        allowed = ELIGIBLE_STATUSES + [FINAL_HOLD_STATUS, FINAL_SELECTED_STATUS]
        if current not in allowed:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot reject: current status is '{current}'."
            )

        now = datetime.now(timezone.utc).isoformat()

        try:
            supabase.table("final_selection_decisions").insert({
                "application_id": application_id,
                "decision": "rejected",
                "reason": req.reason,
                "decided_by": hr_id,
                "decided_at": now,
            }).execute()
        except Exception as e:
            logger.warning(f"Could not write decision record: {e}")

        supabase.table("applications").update({
            "current_status": FINAL_REJECTED_STATUS,
            "offer_eligible": False,
            "final_decision_at": now,
            "final_decision_by": hr_id,
            "final_rejection_reason": req.reason,
        }).eq("application_id", application_id).execute()

        self._audit(application_id, "FINAL_CANDIDATE_REJECTED", hr_id, {
            "previous_status": current, "reason": req.reason
        })
        return {"success": True, "message": "Candidate rejected"}

    def hold_candidate(self, application_id: str, req: FinalHoldRequest, hr_id: str):
        app = self._get_app(application_id)
        current = app["current_status"]

        allowed = ELIGIBLE_STATUSES + [FINAL_SELECTED_STATUS]
        if current not in allowed:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot hold: current status is '{current}'."
            )

        now = datetime.now(timezone.utc).isoformat()

        try:
            supabase.table("final_selection_decisions").insert({
                "application_id": application_id,
                "decision": "hold",
                "reason": req.reason,
                "hold_review_date": req.review_date,
                "decided_by": hr_id,
                "decided_at": now,
            }).execute()
        except Exception as e:
            logger.warning(f"Could not write decision record: {e}")

        supabase.table("applications").update({
            "current_status": FINAL_HOLD_STATUS,
            "offer_eligible": False,
            "final_decision_at": now,
            "final_decision_by": hr_id,
            "final_decision_notes": req.reason,
        }).eq("application_id", application_id).execute()

        self._audit(application_id, "FINAL_CANDIDATE_HELD", hr_id, {
            "previous_status": current, "reason": req.reason, "review_date": req.review_date
        })
        return {"success": True, "message": "Candidate placed on hold"}

    # Backward-compat alias
    def confirm_final_selection(self, application_id: str, req, hr_id: str):
        return self.select_candidate(application_id, FinalSelectionRequest(notes=getattr(req, "notes", "")), hr_id)

    # ------------------------------------------------------------------ #
    #  PRIVATE HELPERS                                                      #
    # ------------------------------------------------------------------ #

    def _get_app(self, application_id: str) -> dict:
        resp = supabase.table("applications").select(
            "application_id, current_status"
        ).eq("application_id", application_id).single().execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Application not found")
        return resp.data

    def _get_latest_decision(self, application_id: str) -> Optional[dict]:
        try:
            resp = supabase.table("final_selection_decisions").select("*").eq(
                "application_id", application_id
            ).order("decided_at", desc=True).limit(1).execute()
            return resp.data[0] if resp.data else None
        except Exception:
            return None

    def _enrich_with_latest_interview(self, app: dict, application_id: str):
        """Attach latest interview + evaluation data to app dict."""
        try:
            hi_resp = supabase.table("interviews").select(
                "interview_id, round_number, date, status, interviewer_id, "
                "users!interviews_interviewer_id_fkey(email), "
                "interview_evaluations(overall_score, decision)"
            ).eq("application_id", application_id).order("round_number", desc=True).limit(1).execute()

            if hi_resp.data:
                hi = hi_resp.data[0]
                app["latest_interview_date"] = hi.get("date")
                app["latest_interview_status"] = hi.get("status")
                
                # Extract interviewer name
                users_data = hi.get("users")
                if users_data and users_data.get("email"):
                    app["interviewer_name"] = users_data["email"].split("@")[0].capitalize()
                else:
                    app["interviewer_name"] = "N/A"
                
                # Extract evaluation
                eval_data = hi.get("interview_evaluations")
                if eval_data:
                    # Supabase might return a list or a dict for 1-to-1/1-to-many depending on schema config
                    if isinstance(eval_data, list) and len(eval_data) > 0:
                        ev = eval_data[0]
                    elif isinstance(eval_data, dict):
                        ev = eval_data
                    else:
                        ev = {}
                        
                    app["overall_rating"] = ev.get("overall_score")
                    app["interviewer_recommendation"] = ev.get("decision")
                else:
                    app["overall_rating"] = None
                    app["interviewer_recommendation"] = None
            else:
                app["latest_interview_date"] = None
                app["interviewer_name"] = "N/A"
                app["overall_rating"] = None
                app["interviewer_recommendation"] = None
        except Exception as e:
            logger.warning(f"Could not enrich interview data for {application_id}: {e}")
            app["overall_rating"] = None
            app["interviewer_recommendation"] = None

    def _audit(self, application_id: str, action: str, hr_id: str, metadata: dict):
        try:
            supabase.table("audit_logs").insert({
                "action": action,
                "hr_user": str(hr_id),
                "application_id": application_id,
                "metadata": metadata,
            }).execute()
        except Exception as e:
            logger.warning(f"Audit log failed (non-critical): {e}")
