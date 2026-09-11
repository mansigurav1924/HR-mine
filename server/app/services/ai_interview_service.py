from datetime import datetime
from app.services.supabase_client import supabase
from app.schemas.ai_interview import GenerateInterviewRequest, AnswerRequest, HRReviewRequest
from app.services.interview_question_service import InterviewQuestionService
from app.services.candidate_token_service import CandidateTokenService
from app.services.email.email_service import EmailService
import os
import logging

logger = logging.getLogger(__name__)

class AIInterviewService:
    def __init__(self):
        self.question_service = InterviewQuestionService()
        self.token_service = CandidateTokenService()

    def generate_interview(self, application_id: str, request: GenerateInterviewRequest):
        if request.question_count < 4 or request.question_count > 5:
            raise ValueError("Question count must be between 4 and 5.")
            
        app_resp = supabase.table("applications").select("*").eq("application_id", application_id).single().execute()
        if not app_resp.data:
            raise ValueError("Application not found.")
            
        app_data = app_resp.data
        if app_data["current_status"] != "assessment_passed":
            raise ValueError(f"Application is in status '{app_data['current_status']}', cannot generate interview.")
            
        exist_resp = supabase.table("ai_interviews").select("ai_interview_id").eq("application_id", application_id).is_("completed_at", "null").execute()
        if exist_resp.data:
            raise ValueError("An active interview already exists for this application.")

        pos_id = app_data["position_id"]
        pos_resp = supabase.table("job_requirements").select("*").eq("position_id", pos_id).single().execute()
        req_skills = pos_resp.data.get("required_skills", []) if pos_resp.data else []
        pref_skills = pos_resp.data.get("preferred_skills", []) if pos_resp.data else []
        
        parsed_skills = []
        if app_data.get("parsed_data") and "skills" in app_data["parsed_data"]:
            parsed_skills = app_data["parsed_data"]["skills"]
            
        questions = self.question_service.select_questions(
            req_skills, pref_skills, parsed_skills, request.question_count
        )
        
        if len(questions) < request.question_count:
            raise ValueError("Insufficient questions in bank.")
            
        int_resp = supabase.table("ai_interviews").insert({
            "application_id": application_id,
            "position_id": pos_id,
            "questions_json": questions,
            "answers_json": []
        }).execute()
        
        interview_id = int_resp.data[0]["ai_interview_id"]
        
        supabase.table("audit_logs").insert({
            "action": "AI_INTERVIEW_CREATED",
            "application_id": application_id,
            "metadata": {"ai_interview_id": interview_id, "question_count": request.question_count}
        }).execute()
        
        return int_resp.data[0]

    def generate_token(self, ai_interview_id: str):
        int_resp = supabase.table("ai_interviews").select("*").eq("ai_interview_id", ai_interview_id).single().execute()
        if not int_resp.data:
            raise ValueError("Interview not found.")
            
        if int_resp.data["completed_at"]:
            raise ValueError("Interview already completed.")
            
        app_id = int_resp.data["application_id"]
        # Generate token with 72h TTL and 'ai_interview' stage
        plaintext, token_id, expires_at = self.token_service.generate_token_for_stage(app_id, stage="ai_interview", ttl_hours=72)
        
        supabase.table("ai_interviews").update({
            "access_token_id": token_id
        }).eq("ai_interview_id", ai_interview_id).execute()
        
        supabase.table("applications").update({
            "current_status": "ai_interview_invited"
        }).eq("application_id", app_id).execute()
        
        supabase.table("audit_logs").insert({
            "action": "AI_INTERVIEW_TOKEN_ISSUED",
            "application_id": app_id,
            "metadata": {"ai_interview_id": ai_interview_id, "expires_at": expires_at.isoformat()}
        }).execute()
        
        return {
            "ai_interview_id": ai_interview_id,
            "candidate_url": f"http://localhost:5173/interview/{plaintext}",
            "expires_at": expires_at.isoformat()
        }

    def _get_active_interview_for_token(self, plaintext_token: str):
        token = self.token_service.resolve_token(plaintext_token, expected_stage="ai_interview")
        app_id = token["application_id"]
        
        app_resp = supabase.table("applications").select("current_status").eq("application_id", app_id).single().execute()
        if app_resp.data and app_resp.data["current_status"] == "withdrawn":
            raise ValueError("This interview link is no longer valid.")
        
        int_resp = supabase.table("ai_interviews").select("*").eq("application_id", app_id).is_("completed_at", "null").single().execute()
        if not int_resp.data:
            raise ValueError("This interview link is no longer valid.")
            
        return int_resp.data, token

    def record_opened(self, plaintext_token: str):
        token = self.token_service.resolve_token(plaintext_token, expected_stage="ai_interview")
        app_id = token["application_id"]
        
        app_resp = supabase.table("applications").select("current_status").eq("application_id", app_id).single().execute()
        if not app_resp.data or app_resp.data["current_status"] == "withdrawn":
            raise ValueError("This interview link is no longer valid.")

        int_resp = supabase.table("ai_interviews").select("*").eq("application_id", app_id).order("created_at", desc=True).limit(1).execute()
        if not int_resp.data:
            raise ValueError("No interview record found.")
            
        interview = int_resp.data[0]
        
        # Idempotent: Only update if it's currently "invited" or similar
        if not interview.get("started_at") and interview.get("status") != "opened":
            now_iso = datetime.utcnow().isoformat()
            supabase.table("ai_interviews").update({
                "status": "opened",
                "started_at": now_iso
            }).eq("ai_interview_id", interview["ai_interview_id"]).execute()
            
            supabase.table("audit_logs").insert({
                "action": "AI_INTERVIEW_OPENED",
                "application_id": app_id,
                "metadata": {"ai_interview_id": interview["ai_interview_id"], "opened_at": now_iso}
            }).execute()
            
            supabase.table("applications").update({
                "current_status": "ai_interview_opened"
            }).eq("application_id", app_id).execute()

        return {"status": "opened"}

    def complete_placeholder(self, plaintext_token: str):
        token = self.token_service.resolve_token(plaintext_token, expected_stage="ai_interview")
        app_id = token["application_id"]

        # Fetch application to get position_id
        app_resp = supabase.table("applications").select("*").eq("application_id", app_id).single().execute()
        if not app_resp.data:
            raise ValueError("Application not found.")
        app_data = app_resp.data

        # Check if application is already completed (idempotency via application status)
        if app_data.get("current_status") == "human_interview_ready":
            return {"completed": True, "already_completed": True}

        now_iso = datetime.utcnow().isoformat()

        # Look for existing ai_interviews row
        int_resp = supabase.table("ai_interviews").select("*").eq("application_id", app_id).order("created_at", desc=True).limit(1).execute()

        if int_resp.data:
            interview = int_resp.data[0]
            # Idempotency check via completed_at
            if interview.get("completed_at"):
                return {"completed": True, "already_completed": True}
            # Update only valid columns (no "status" — not in schema)
            supabase.table("ai_interviews").update({
                "completed_at": now_iso
            }).eq("ai_interview_id", interview["ai_interview_id"]).execute()
            interview_id = interview["ai_interview_id"]
        else:
            # No ai_interviews row exists (invitation was sent but record creation failed)
            # Create a placeholder record now using only columns that exist in schema
            position_id = app_data.get("position_id")
            insert_data = {
                "application_id": app_id,
                "questions_json": [],
                "answers_json": [],
                "completed_at": now_iso,
                "access_token_id": token["token_id"]
            }
            if position_id:
                insert_data["position_id"] = position_id
            try:
                new_int = supabase.table("ai_interviews").insert(insert_data).execute()
                interview_id = new_int.data[0]["ai_interview_id"] if new_int.data else "placeholder"
            except Exception as e:
                logger.warning(f"Could not create ai_interviews placeholder row: {e}")
                interview_id = "placeholder"

        # Update application status
        supabase.table("applications").update({
            "current_status": "human_interview_ready"
        }).eq("application_id", app_id).execute()

        # Audit Log
        supabase.table("audit_logs").insert({
            "action": "AI_INTERVIEW_PLACEHOLDER_COMPLETED",
            "application_id": app_id,
            "metadata": {"ai_interview_id": interview_id, "completed_at": now_iso}
        }).execute()

        # Mark token as consumed (idempotent)
        try:
            self.token_service.invalidate_token(token["token_id"])
        except Exception as e:
            logger.warning(f"Token invalidation failed (may already be consumed): {e}")

        # Send HR Notification (do not fail the request if this fails)
        try:
            self._notify_hr_completed(app_id, {"ai_interview_id": interview_id}, now_iso)
        except Exception as e:
            logger.error(f"Failed to send HR notification for AI Interview completion: {str(e)}")

        return {"completed": True, "already_completed": False}

    def _notify_hr_completed(self, app_id: str, interview: dict, completed_at: str):
        app_resp = supabase.table("applications").select("*").eq("application_id", app_id).single().execute()
        if not app_resp.data:
            return
            
        app = app_resp.data
        candidate_name = app.get("candidate_name") or "Candidate"
        position = app.get("position") or "Internship"
        app_reference = app.get("application_id")
        
        # Determine HR email. Either from env or default
        hr_email = os.getenv("HR_NOTIFICATION_EMAIL", "hr@example.com") # Replace with valid HR email logic if needed
        
        # Alternatively, find an HR user
        hr_resp = supabase.table("users").select("email").eq("role", "hr_admin").limit(1).execute()
        if hr_resp.data and hr_resp.data[0].get("email"):
            hr_email = hr_resp.data[0]["email"]

        subject = f"AI Interview Done — {position}"
        
        # Format date for email
        try:
            dt = datetime.fromisoformat(completed_at.replace('Z', '+00:00'))
            formatted_date = dt.strftime("%d %b %Y %I:%M %p UTC")
        except:
            formatted_date = completed_at

        body_text = (
            f"Dear HR Team,\n\n"
            f"The candidate has completed the AI Interview stage.\n\n"
            f"Candidate: {candidate_name}\n"
            f"Position: {position}\n"
            f"Application ID: {app_reference}\n"
            f"Completed At: {formatted_date}\n\n"
            f"The AI Interview module is currently deferred, so no AI score has been\n"
            f"generated for this stage.\n\n"
            f"The candidate is now ready for the Human Interview stage.\n\n"
            f"Please review the application and continue with Human Interview\n"
            f"scheduling.\n\n"
            f"Regards,\n"
            f"HR Recruitment System"
        )
        
        body_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
            <h2 style="color: #4F46E5;">AI Interview Completed</h2>
            <p>Dear HR Team,</p>
            <p>The candidate has completed the AI Interview stage.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f9fafb; border-radius: 8px;">
                <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Candidate:</strong></td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{candidate_name}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Position:</strong></td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{position}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Application ID:</strong></td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{app_reference}</td></tr>
                <tr><td style="padding: 10px;"><strong>Completed At:</strong></td><td style="padding: 10px;">{formatted_date}</td></tr>
            </table>
            <div style="background-color: #FEF3C7; color: #92400E; padding: 12px; border-radius: 6px; border-left: 4px solid #F59E0B; margin: 20px 0;">
                The AI Interview module is currently deferred, so no AI score has been generated for this stage.
            </div>
            <p>The candidate is now ready for the <strong>Human Interview</strong> stage.</p>
            <p>Please review the application and continue with Human Interview scheduling.</p>
            <br>
            <p>Regards,<br><strong>HR Recruitment System</strong></p>
        </div>
        """
        
        provider = EmailService.get_provider()
        try:
            email_res = provider.send_email(
                to_email=hr_email,
                subject=subject,
                text_body=body_text,
                html_body=body_html
            )
            sent_status = "sent" if email_res.get("success") else "failed"
        except Exception as e:
            logger.warning(f"HR notification email send failed (network/API error): {e}")
            sent_status = "failed"
            email_res = {}

        # Log email attempt — only use columns that exist in schema
        try:
            supabase.table("email_logs").insert({
                "application_id": app_id,
                "recipient": hr_email,
                "email_type": "AI_INTERVIEW_COMPLETED_HR_NOTIFICATION",
                "subject": subject,
                "status": sent_status
            }).execute()
        except Exception as log_err:
            logger.warning(f"Could not write email log: {log_err}")

    def get_candidate_state(self, plaintext_token: str):
        try:
            token = self.token_service.resolve_token(plaintext_token, expected_stage="ai_interview", allow_used=True)
        except ValueError as e:
            raise ValueError(str(e))
            
        app_id = token["application_id"]
        app_resp = supabase.table("applications").select("first_name, parsed_data, job_requirements(title, department)").eq("application_id", app_id).single().execute()
        app_data = app_resp.data

        # Get the most recent interview without checking completed_at
        int_resp = supabase.table("ai_interviews").select("*").eq("application_id", app_id).order("created_at", desc=True).limit(1).execute()
        if not int_resp.data:
            raise ValueError("This interview link is no longer valid.")
        
        interview = int_resp.data[0]
        
        return {
            "first_name": app_data.get("first_name"),
            "position": app_data["job_requirements"]["title"],
            "department": app_data["job_requirements"]["department"],
            "status": interview.get("status"),
            "completed": interview.get("completed_at") is not None,
            "profile_confirmed": interview.get("candidate_profile_confirmed"),
            "question_count": len(interview.get("questions_json") or [])
        }

    def get_current_question(self, plaintext_token: str):
        interview, token = self._get_active_interview_for_token(plaintext_token)
        
        if not interview.get("candidate_profile_confirmed"):
            raise ValueError("Profile not confirmed.")
            
        questions = interview["questions_json"]
        answers = interview.get("answers_json") or []
        
        total = len(questions)
        answered_indices = {ans["question_index"] for ans in answers}
        
        current_index = -1
        for i in range(total):
            if i not in answered_indices:
                current_index = i
                break
                
        if current_index == -1:
            return {"ready_to_submit": True}
            
        q = questions[current_index]
        return {
            "question_number": current_index + 1,
            "total_questions": total,
            "question": q["question"]
        }

    def manual_complete(self, ai_interview_id: str, hr_user_id: str):
        int_resp = supabase.table("ai_interviews").select("*").eq("ai_interview_id", ai_interview_id).single().execute()
        if not int_resp.data:
            raise ValueError("Interview not found.")
            
        interview = int_resp.data
        if interview.get("status") == "manually_completed" or interview.get("completed_at"):
            return {"success": True, "message": "Already completed"}
            
        now_iso = datetime.utcnow().isoformat()
        
        supabase.table("ai_interviews").update({
            "status": "manually_completed",
            "completed_at": now_iso
        }).eq("ai_interview_id", ai_interview_id).execute()
        
        app_id = interview["application_id"]
        supabase.table("applications").update({
            "current_status": "ai_interview_completed"
        }).eq("application_id", app_id).execute()
        
        supabase.table("audit_logs").insert({
            "action": "AI_INTERVIEW_MANUALLY_COMPLETED",
            "application_id": app_id,
            "hr_user": hr_user_id,
            "metadata": {
                "ai_interview_id": ai_interview_id,
                "completed_by": hr_user_id,
                "completion_mode": "manual_placeholder"
            }
        }).execute()
        
        return {"success": True, "message": "AI Interview manually completed."}

    def proceed_to_human_interview(self, ai_interview_id: str, hr_user_id: str):
        int_resp = supabase.table("ai_interviews").select("*").eq("ai_interview_id", ai_interview_id).single().execute()
        if not int_resp.data:
            raise ValueError("Interview not found.")
            
        app_id = int_resp.data["application_id"]
        
        supabase.table("applications").update({
            "current_status": "human_interview_ready"
        }).eq("application_id", app_id).execute()
        
        supabase.table("audit_logs").insert({
            "action": "PROCEEDED_TO_HUMAN_INTERVIEW",
            "application_id": app_id,
            "hr_user": hr_user_id,
            "metadata": {"ai_interview_id": ai_interview_id}
        }).execute()
        
        return {"success": True}

    def get_dashboard_data(self):
        resp = supabase.table("ai_interviews").select(
            "ai_interview_id, application_id, position_id, started_at, completed_at, created_at, "
            "applications(candidate_name, email, current_status), "
            "job_requirements(position_title)"
        ).order("created_at", desc=True).execute()
        
        rows = []
        for r in (resp.data or []):
            # Derive status from completed_at since there is no status column
            completed_at = r.get("completed_at")
            started_at = r.get("started_at")
            app_status = (r.get("applications") or {}).get("current_status", "")
            
            if completed_at or app_status == "human_interview_ready":
                derived_status = "completed"
            elif started_at:
                derived_status = "opened"
            else:
                derived_status = "invited"
            
            rows.append({
                **r,
                "status": derived_status,
            })
        return rows
        
    def get_detail(self, ai_interview_id: str):
        int_resp = supabase.table("ai_interviews").select("*, applications(first_name, last_name, current_status), job_requirements(title)").eq("ai_interview_id", ai_interview_id).single().execute()
        if not int_resp.data:
            raise ValueError("Interview not found.")
            
        interview = int_resp.data
        
        transcript = []
        questions = interview.get("questions_json", [])
        answers = {a["question_index"]: a for a in (interview.get("answers_json") or [])}
        
        for i, q in enumerate(questions):
            ans = answers.get(i)
            transcript.append({
                "question_number": i + 1,
                "question": q["question"],
                "candidate_answer": ans["answer"] if ans else None,
                "answered_at": ans["answered_at"] if ans else None
            })
            
        return {
            "ai_interview_id": interview["ai_interview_id"],
            "candidate_name": f"{interview['applications']['first_name']} {interview['applications'].get('last_name', '')}",
            "position": interview["job_requirements"]["title"],
            "status": interview["applications"]["current_status"],
            "started_at": interview.get("started_at"),
            "completed_at": interview.get("completed_at"),
            "hr_review_status": interview.get("hr_review_status"),
            "scores": {
                "technical": interview.get("hr_technical_score"),
                "problem_solving": interview.get("hr_problem_solving_score"),
                "communication": interview.get("hr_communication_score"),
                "project_knowledge": interview.get("hr_project_knowledge_score")
            },
            "hr_notes": interview.get("hr_notes"),
            "reviewed_at": interview.get("reviewed_at"),
            "transcript": transcript
        }

    def review_interview(self, ai_interview_id: str, request: HRReviewRequest, admin_id: str):
        int_resp = supabase.table("ai_interviews").select("*").eq("ai_interview_id", ai_interview_id).single().execute()
        if not int_resp.data:
            raise ValueError("Interview not found.")
            
        interview = int_resp.data
        if not interview.get("completed_at"):
            raise ValueError("Cannot review an incomplete interview.")
            
        # Validate scores 1-5
        for score in [request.technical_score, request.problem_solving_score, request.communication_score, request.project_knowledge_score]:
            if score is not None and (score < 1 or score > 5):
                raise ValueError("Scores must be between 1 and 5.")
                
        supabase.table("ai_interviews").update({
            "hr_review_status": "reviewed",
            "hr_technical_score": request.technical_score,
            "hr_problem_solving_score": request.problem_solving_score,
            "hr_communication_score": request.communication_score,
            "hr_project_knowledge_score": request.project_knowledge_score,
            "hr_notes": request.notes,
            "reviewed_by": admin_id,
            "reviewed_at": datetime.utcnow().isoformat()
        }).eq("ai_interview_id", ai_interview_id).execute()
        
        # Does NOT change application status yet.
        
        supabase.table("audit_logs").insert({
            "action": "AI_INTERVIEW_HR_REVIEWED",
            "application_id": interview["application_id"],
            "metadata": {
                "ai_interview_id": ai_interview_id,
                "reviewed_by": admin_id
            }
        }).execute()
        
        return {"success": True}
