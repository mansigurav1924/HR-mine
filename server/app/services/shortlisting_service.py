import os
import logging
from uuid import UUID
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import HTTPException

from app.services.supabase_client import supabase
from app.services.email.email_service import EmailService
from app.services.candidate_token_service import CandidateTokenService
from app.services.assessment_service import AssessmentService
from app.schemas.assessment import AssessmentGenerateRequest
from app.schemas.shortlisting import (
    ShortlistingDecisionRequest, ShortlistingDecisionResponse,
    ShortlistedCandidateResponse, BulkShortlistEmailRequest, BulkEmailResponse, BulkEmailFailure
)

logger = logging.getLogger(__name__)

class ShortlistingService:
    def __init__(self):
        self.token_service = CandidateTokenService()
        self.assessment_service = AssessmentService()

    def create_decision(self, application_id: str, hr_user_id: str, request: ShortlistingDecisionRequest) -> ShortlistingDecisionResponse:
        if request.decision not in ["shortlisted", "non_shortlisted"]:
            raise HTTPException(status_code=400, detail="Decision must be 'shortlisted' or 'non_shortlisted'")
            
        if not request.reason or not request.reason.strip():
            raise HTTPException(status_code=400, detail="Reason is required.")
            
        # 1. Verify application exists and its status
        app_res = supabase.table("applications").select("*, job_requirements(*)").eq("application_id", application_id).single().execute()
        app_data = app_res.data
        if not app_data:
            raise HTTPException(status_code=404, detail="Application not found.")
            
        current_status = app_data.get("current_status")
        allowed_transitions = [
            "application_received", "applied", "ml_evaluated", "under_review", 
            "shortlisted", "non_shortlisted", "pending", "assessment_invited"
        ]
        
        if current_status not in allowed_transitions:
            raise HTTPException(status_code=400, detail=f"Cannot apply shortlisting decision to candidate with status '{current_status}'.")
            
        # 2. Check for latest ML Evaluation
        ml_res = supabase.table("ml_evaluations").select("evaluation_id, model_version, predicted_class").eq("application_id", application_id).order("evaluated_at", desc=True).limit(1).execute()
        latest_ml = ml_res.data[0] if ml_res.data else None
        
        # 3. Create decision record with safe foreign key
        decided_by_val = None
        if hr_user_id:
            try:
                u_check = supabase.table("users").select("user_id").eq("user_id", hr_user_id).execute()
                if u_check.data:
                    decided_by_val = hr_user_id
            except Exception:
                decided_by_val = None

        decision_record = {
            "application_id": application_id,
            "decision": request.decision,
            "reason": request.reason.strip(),
            "decided_by": decided_by_val,
            "decided_at": datetime.utcnow().isoformat()
        }
        
        # Optimistic concurrency check
        update_res = supabase.table("applications") \
            .update({"current_status": request.decision}) \
            .eq("application_id", application_id) \
            .eq("current_status", current_status) \
            .execute()
            
        if not update_res.data:
            raise HTTPException(status_code=409, detail="Application status was modified by another process. Please refresh and try again.")
            
        insert_res = supabase.table("shortlisting_decisions").insert(decision_record).execute()
        if not insert_res.data:
            # Revert status on failure
            supabase.table("applications").update({"current_status": current_status}).eq("application_id", application_id).execute()
            raise HTTPException(status_code=500, detail="Failed to save decision record.")
            
        saved_decision = insert_res.data[0]
        
        # 4. Audit Log
        is_override = (current_status in ["shortlisted", "non_shortlisted"] and current_status != request.decision)
        audit_action = "HR_SHORTLIST_DECISION_OVERRIDDEN" if is_override else (
            "HR_SHORTLISTED_APPLICATION" if request.decision == "shortlisted" else "HR_NON_SHORTLISTED_APPLICATION"
        )
        
        audit_metadata = {
            "decision_id": saved_decision["decision_id"],
            "previous_status": current_status,
            "new_status": request.decision,
            "reason": request.reason.strip()
        }
        if latest_ml:
            audit_metadata["latest_ml_evaluation_id"] = latest_ml["evaluation_id"]
            audit_metadata["model_version"] = latest_ml["model_version"]
            
        try:
            supabase.table("audit_logs").insert({
                "action": audit_action,
                "application_id": application_id,
                "hr_user": hr_user_id,
                "metadata": audit_metadata
            }).execute()
        except Exception:
            pass

        # 5. Handle Candidate Email Notification
        if request.decision == "non_shortlisted" and request.send_rejection_email:
            self._send_rejection_email(app_data, hr_user_id)
        elif request.decision == "shortlisted" and request.send_assessment_email:
            try:
                # 1. Ensure assessment exists or generate one
                exist_ass = supabase.table("assessments").select("assessment_id, access_token_id").eq("application_id", application_id).is_("completed_at", "null").execute()
                if exist_ass.data:
                    assessment_id = exist_ass.data[0]["assessment_id"]
                else:
                    try:
                        gen_req = AssessmentGenerateRequest(question_count=20, pass_threshold=70.0)
                        ass_rec = self.assessment_service.generate_assessment(application_id, gen_req)
                        assessment_id = ass_rec["assessment_id"]
                    except Exception as gen_err:
                        logger.warning(f"Default assessment generation fallback for {application_id}: {gen_err}")
                        ins_ass = supabase.table("assessments").insert({
                            "application_id": application_id,
                            "position_id": app_data.get("position_id"),
                            "questions_json": [
                                {
                                    "question_id": "1",
                                    "question_text": f"Core skills and competencies assessment for {app_data.get('position', 'Intern')}",
                                    "options": ["Strong foundational knowledge", "Practical hands-on experience", "Problem solving approach", "Team collaboration"],
                                    "correct_option": "Strong foundational knowledge"
                                }
                            ],
                            "pass_threshold": 70.0
                        }).execute()
                        assessment_id = ins_ass.data[0]["assessment_id"]

                # 2. Generate token, update status to assessment_invited, and send invitation email
                self.assessment_service.generate_token_and_invite(assessment_id, hr_user_id)
                logger.info(f"Assessment invitation email dispatched for shortlisted candidate {application_id}")
            except Exception as e:
                logger.error(f"Failed to dispatch assessment email upon shortlisting {application_id}: {e}")
        
        return ShortlistingDecisionResponse(**saved_decision)

    def _send_rejection_email(self, app_data: Dict[str, Any], hr_user_id: str):
        """Sends a polite candidate rejection email without disclosing internal HR notes or ML scores."""
        app_id = app_data["application_id"]
        recipient = app_data.get("email")
        candidate_name = app_data.get("candidate_name", "Applicant")
        position = app_data.get("position", "Internship")

        if not recipient:
            return

        subject = f"Update on Your {position} Application"
        body_text = (
            f"Dear {candidate_name},\n\n"
            f"Thank you for your interest in the {position} position.\n\n"
            f"After reviewing your application, we will not be moving forward with your application at this stage.\n\n"
            f"We appreciate your time and interest and wish you success in your future opportunities.\n\n"
            f"Regards,\n"
            f"HR Team"
        )

        body_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
            <p>Dear {candidate_name},</p>
            <p>Thank you for your interest in the <strong>{position}</strong> position.</p>
            <p>After reviewing your application, we will not be moving forward with your application at this stage.</p>
            <p>We appreciate your time and interest and wish you success in your future opportunities.</p>
            <br>
            <p>Regards,<br><strong>HR Recruitment Team</strong></p>
        </div>
        """

        provider = EmailService.get_provider()
        try:
            provider.send_email(
                to_email=recipient,
                subject=subject,
                body=body_text,
                html_body=body_html,
                connected_by=hr_user_id
            )
            # Log successful email
            supabase.table("email_logs").insert({
                "application_id": app_id,
                "recipient": recipient,
                "subject": subject,
                "status": "sent",
                "sent_at": datetime.utcnow().isoformat(),
                "provider": email_res.get("provider"),
                "provider_message_id": email_res.get("message_id")
            }).execute()

            supabase.table("audit_logs").insert({
                "action": "REJECTION_EMAIL_SENT",
                "application_id": app_id,
                "hr_user": hr_user_id,
                "metadata": {"recipient": recipient}
            }).execute()
        except Exception as e:
            logger.error(f"Failed to send rejection email to {recipient}: {e}")
            supabase.table("email_logs").insert({
                "application_id": app_id,
                "recipient": recipient,
                "subject": subject,
                "status": "failed",
                "error": str(e)[:255],
                "sent_at": datetime.utcnow().isoformat()
            }).execute()

            supabase.table("audit_logs").insert({
                "action": "REJECTION_EMAIL_FAILED",
                "application_id": app_id,
                "hr_user": hr_user_id,
                "metadata": {"recipient": recipient, "error": str(e)}
            }).execute()

    def get_history(self, application_id: str) -> List[ShortlistingDecisionResponse]:
        res = supabase.table("shortlisting_decisions").select("*").eq("application_id", application_id).order("decided_at", desc=True).execute()
        return [ShortlistingDecisionResponse(**d) for d in res.data or []]

    def get_pending(self) -> List[Dict[str, Any]]:
        """Returns applications that require HR review (ml_evaluated, under_review, application_received)."""
        apps_res = supabase.table("applications").select(
            "application_id, candidate_name, email, phone, position, department, position_id, resume_url, skills, created_at, current_status"
        ).in_("current_status", ["ml_evaluated", "under_review", "application_received"]).order("created_at", desc=False).execute()
        
        if not apps_res.data:
            return []
            
        app_ids = [a["application_id"] for a in apps_res.data]
        ml_res = supabase.table("ml_evaluations").select("*").in_("application_id", app_ids).order("evaluated_at", desc=True).execute()
        
        latest_evals = {}
        for e in ml_res.data or []:
            if e["application_id"] not in latest_evals:
                latest_evals[e["application_id"]] = e
                
        results = []
        for a in apps_res.data:
            eval_data = latest_evals.get(a["application_id"], {})
            results.append({
                **a,
                "predicted_class": eval_data.get("predicted_class"),
                "match_score": eval_data.get("match_score"),
                "matching_skills": eval_data.get("matching_skills", []),
                "missing_skills": eval_data.get("missing_skills", []),
                "relevant_experience": eval_data.get("relevant_experience"),
                "relevant_projects": eval_data.get("relevant_projects"),
                "evaluated_at": eval_data.get("evaluated_at")
            })
            
        return results

    def get_decided(self, decision: str) -> List[Dict[str, Any]]:
        """Fetch applications with status == decision ('shortlisted' or 'non_shortlisted')."""
        if decision == "shortlisted":
            apps_res = supabase.table("applications").select(
                "application_id, candidate_name, email, phone, position, department, resume_url, skills, created_at, current_status"
            ).in_("current_status", [
                "shortlisted", "assessment_invited", "assessment_passed", "assessment_failed",
                "ai_interview_invited", "ai_interview_completed", "interview_scheduled",
                "interview_completed", "interview_selected", "interview_rejected", "final_selected"
            ]).order("updated_at", desc=True).execute()
        else:
            apps_res = supabase.table("applications").select(
                "application_id, candidate_name, email, phone, position, department, resume_url, skills, created_at, current_status"
            ).eq("current_status", decision).order("updated_at", desc=True).execute()
        
        if not apps_res.data:
            return []
            
        app_ids = [a["application_id"] for a in apps_res.data]
        
        # Fetch decision reasons & who decided
        dec_res = supabase.table("shortlisting_decisions").select(
            "application_id, reason, decided_at, decided_by, users(email, role)"
        ).eq("decision", decision).in_("application_id", app_ids).order("decided_at", desc=True).execute()
        
        latest_decs = {}
        for d in dec_res.data or []:
            if d["application_id"] not in latest_decs:
                latest_decs[d["application_id"]] = d
                
        # Fetch latest ML Evaluation
        ml_res = supabase.table("ml_evaluations").select(
            "application_id, predicted_class, match_score, matching_skills, missing_skills"
        ).in_("application_id", app_ids).order("evaluated_at", desc=True).execute()
        
        latest_evals = {}
        for m in ml_res.data or []:
            if m["application_id"] not in latest_evals:
                latest_evals[m["application_id"]] = m

        # Fetch latest email logs for email status
        email_res = supabase.table("email_logs").select(
            "application_id, status, sent_at"
        ).in_("application_id", app_ids).order("sent_at", desc=True).execute()

        latest_emails = {}
        for em in email_res.data or []:
            if em["application_id"] not in latest_emails:
                latest_emails[em["application_id"]] = em
                
        results = []
        for a in apps_res.data:
            dec_data = latest_decs.get(a["application_id"], {})
            ml_data = latest_evals.get(a["application_id"], {})
            email_data = latest_emails.get(a["application_id"], {})

            hr_info = dec_data.get("users") or {}
            hr_name = hr_info.get('email') or "HR Admin"

            results.append({
                "application_id": a["application_id"],
                "candidate_name": a["candidate_name"],
                "email": a.get("email"),
                "position": a.get("position"),
                "department": a.get("department"),
                "resume_url": a.get("resume_url"),
                "decision": decision,
                "reason": dec_data.get("reason", "Shortlisted by HR"),
                "decided_at": dec_data.get("decided_at") or a.get("created_at"),
                "shortlisted_by": hr_name,
                "predicted_class": ml_data.get("predicted_class"),
                "match_score": ml_data.get("match_score"),
                "email_status": email_data.get("status") if email_data else "pending"
            })
            
        return results

    def send_bulk_shortlist_emails(self, request: BulkShortlistEmailRequest, hr_user_id: str) -> BulkEmailResponse:
        """Dispatches individual shortlist / assessment invitation emails to selected or all shortlisted candidates."""
        # 1. Resolve Target Applications
        if request.all_shortlisted:
            apps_res = supabase.table("applications").select("application_id, candidate_name, email, position, position_id, current_status").in_("current_status", ["shortlisted", "assessment_invited"]).execute()
            target_apps = apps_res.data or []
        elif request.application_ids:
            apps_res = supabase.table("applications").select("application_id, candidate_name, email, position, position_id, current_status").in_("application_id", request.application_ids).execute()
            target_apps = [a for a in apps_res.data or [] if a.get("current_status") in ("shortlisted", "assessment_invited")]
        else:
            raise HTTPException(status_code=400, detail="Please select candidate applications to email.")

        if not target_apps:
            return BulkEmailResponse(requested=0, sent=0, failed=0, failures=[])

        # Audit Log: Bulk started
        try:
            supabase.table("audit_logs").insert({
                "action": "BULK_SHORTLIST_EMAIL_STARTED",
                "hr_user": hr_user_id,
                "metadata": {"requested_count": len(target_apps)}
            }).execute()
        except Exception:
            pass

        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip('/')
        provider = EmailService.get_provider()
        
        sent_count = 0
        failed_count = 0
        failures: List[BulkEmailFailure] = []

        for app in target_apps:
            app_id = app["application_id"]
            cand_name = app.get("candidate_name", "Candidate")
            recipient = app.get("email")
            pos_title = app.get("position", "Internship")

            if not recipient:
                failed_count += 1
                failures.append(BulkEmailFailure(application_id=app_id, candidate_name=cand_name, email=None, reason="Missing email address"))
                continue

            try:
                # 2. Get or create candidate assessment token
                # Check if incomplete assessment exists
                exist_ass = supabase.table("assessments").select("assessment_id, access_token_id").eq("application_id", app_id).is_("completed_at", "null").execute()
                
                if not exist_ass.data:
                    # Generate default assessment
                    try:
                        gen_req = AssessmentGenerateRequest(question_count=5, pass_threshold=70.0)
                        ass_rec = self.assessment_service.generate_assessment(app_id, gen_req)
                        assessment_id = ass_rec["assessment_id"]
                    except Exception:
                        # Fallback simple assessment insert if question bank is unpopulated
                        ins_ass = supabase.table("assessments").insert({
                            "application_id": app_id,
                            "position_id": app.get("position_id"),
                            "questions_json": [
                                {
                                    "question_id": "1",
                                    "question_text": "Technical Assessment Question",
                                    "options": ["Option A", "Option B", "Option C", "Option D"],
                                    "correct_option": "Option A"
                                }
                            ],
                            "pass_threshold": 70.0
                        }).execute()
                        assessment_id = ins_ass.data[0]["assessment_id"]
                else:
                    assessment_id = exist_ass.data[0]["assessment_id"]

                # Generate secure candidate assessment token
                plaintext_token, token_id, expires_at = self.token_service.generate_assessment_token(app_id)
                supabase.table("assessments").update({"access_token_id": token_id}).eq("assessment_id", assessment_id).execute()

                next_stage_link = f"{frontend_url}/assessment/{plaintext_token}"

                # 3. Render candidate email (NO ML or internal details)
                subject = f"You Have Been Shortlisted – {pos_title}"
                body_text = (
                    f"Dear {cand_name},\n\n"
                    f"Congratulations.\n\n"
                    f"Your application for the {pos_title} position has been shortlisted.\n\n"
                    f"Please continue with the next stage of the recruitment process using the secure link provided below:\n\n"
                    f"{next_stage_link}\n\n"
                    f"Regards,\n"
                    f"HR Team"
                )

                body_html = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
                    <h2 style="color: #4F46E5;">Congratulations!</h2>
                    <p>Dear <strong>{cand_name}</strong>,</p>
                    <p>Your application for the <strong>{pos_title}</strong> position has been shortlisted.</p>
                    <p>Please continue with the next stage of the recruitment process using the secure link below:</p>
                    <p style="margin: 25px 0;">
                        <a href="{next_stage_link}" style="background-color: #4F46E5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                            Start Skills Assessment
                        </a>
                    </p>
                    <p style="font-size: 12px; color: #666;">If the button above does not work, copy and paste this URL into your browser:<br>{next_stage_link}</p>
                    <br>
                    <p>Regards,<br><strong>HR Recruitment Team</strong></p>
                </div>
                """

                # Send individual separate email
                email_res = provider.send_email(
                    to_email=recipient,
                    subject=subject,
                    body=body_text,
                    html_body=body_html
                )

                # Log individual email
                supabase.table("email_logs").insert({
                    "application_id": app_id,
                    "recipient": recipient,
                    "subject": subject,
                    "status": "sent",
                    "sent_at": datetime.utcnow().isoformat(),
                    "provider": email_res.get("provider"),
                    "provider_message_id": email_res.get("message_id")
                }).execute()

                supabase.table("audit_logs").insert({
                    "action": "SHORTLIST_EMAIL_SENT",
                    "application_id": app_id,
                    "hr_user": hr_user_id,
                    "metadata": {"recipient": recipient, "assessment_id": assessment_id}
                }).execute()

                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to email shortlisted candidate {app_id} ({recipient}): {e}")
                failed_count += 1
                failures.append(BulkEmailFailure(
                    application_id=app_id,
                    candidate_name=cand_name,
                    email=recipient,
                    reason=str(e)[:255]
                ))

                supabase.table("email_logs").insert({
                    "application_id": app_id,
                    "recipient": recipient,
                    "subject": f"You Have Been Shortlisted – {pos_title}",
                    "status": "failed",
                    "error": str(e)[:255],
                    "sent_at": datetime.utcnow().isoformat()
                }).execute()

                supabase.table("audit_logs").insert({
                    "action": "SHORTLIST_EMAIL_FAILED",
                    "application_id": app_id,
                    "hr_user": hr_user_id,
                    "metadata": {"recipient": recipient, "error": str(e)}
                }).execute()

        # Audit Log: Bulk completed
        try:
            supabase.table("audit_logs").insert({
                "action": "BULK_SHORTLIST_EMAIL_COMPLETED",
                "hr_user": hr_user_id,
                "metadata": {
                    "requested": len(target_apps),
                    "sent": sent_count,
                    "failed": failed_count
                }
            }).execute()
        except Exception:
            pass

        return BulkEmailResponse(
            requested=len(target_apps),
            sent=sent_count,
            failed=failed_count,
            failures=failures
        )
