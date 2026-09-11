import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from app.services.supabase_client import supabase
from app.schemas.assessment import AssessmentGenerateRequest, AnswerRequest, HROverrideRequest, IntegrityEventRequest
from app.services.question_bank_service import QuestionBankService
from app.services.candidate_token_service import CandidateTokenService
from app.services.email.email_service import EmailService
from app.core.config import settings

logger = logging.getLogger(__name__)

class AssessmentService:
    def __init__(self):
        self.question_service = QuestionBankService()
        self.token_service = CandidateTokenService()

    def generate_assessment(self, application_id: str, request: AssessmentGenerateRequest) -> Dict[str, Any]:
        """
        HR Admin only. Creates a curated technical assessment with 20-30 questions
        based on candidate verified skills, job required/preferred skills, and position.
        Requires applications.current_status == 'shortlisted'.
        """
        # 1. Verify application exists and is shortlisted
        app_resp = supabase.table("applications").select("*, job_requirements(*)").eq("application_id", application_id).single().execute()
        if not app_resp.data:
            raise ValueError("Application not found.")
            
        app_data = app_resp.data
        if app_data.get("current_status") != "shortlisted":
            raise ValueError(f"Application is in status '{app_data.get('current_status')}', only shortlisted candidates can receive assessments.")
            
        # 2. Check if incomplete assessment already exists
        exist_resp = supabase.table("assessments").select("assessment_id").eq("application_id", application_id).is_("completed_at", "null").execute()
        if exist_resp.data:
            return exist_resp.data[0]

        # 3. Retrieve verified skills & job requirements
        pos_id = app_data.get("position_id")
        job_req = app_data.get("job_requirements") or {}
        req_skills = job_req.get("required_skills") or []
        pref_skills = job_req.get("preferred_skills") or []
        
        # Candidate verified skills stored on the application
        verified_skills = []
        if isinstance(app_data.get("skills"), list):
            verified_skills = app_data["skills"]
        elif isinstance(app_data.get("parsed_data"), dict) and "skills" in app_data["parsed_data"]:
            verified_skills = app_data["parsed_data"]["skills"]

        # 4. Select curated questions from bank (no LLM generation)
        question_count = max(20, min(30, request.question_count))
        questions = self.question_service.select_questions(
            req_skills, pref_skills, verified_skills, question_count
        )
        
        if len(questions) < question_count:
            # Fallback to general bank to guarantee required count
            general_questions = self.question_service.banks_cache.get("general", [])
            for gq in general_questions:
                if len(questions) >= question_count:
                    break
                if not any(q["id"] == gq["id"] for q in questions):
                    questions.append(gq)
                    
        # 5. Create assessment record
        assess_resp = supabase.table("assessments").insert({
            "application_id": application_id,
            "position_id": pos_id,
            "questions_json": questions,
            "pass_threshold": float(request.pass_threshold)
        }).execute()
        
        if not assess_resp.data:
            raise ValueError("Failed to create assessment record.")
            
        assessment_id = assess_resp.data[0]["assessment_id"]
        
        # 6. Audit Log
        try:
            supabase.table("audit_logs").insert({
                "action": "ASSESSMENT_CREATED",
                "application_id": application_id,
                "metadata": {
                    "assessment_id": assessment_id,
                    "question_count": len(questions),
                    "pass_threshold": request.pass_threshold
                }
            }).execute()
        except Exception:
            pass
            
        return assess_resp.data[0]

    def generate_token_and_invite(self, assessment_id: str, hr_user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Generates 72-hour assessment token, updates status to assessment_invited,
        and sends a Gmail invitation to the candidate.
        """
        ass_resp = supabase.table("assessments").select("*, applications(*)").eq("assessment_id", assessment_id).single().execute()
        if not ass_resp.data:
            raise ValueError("Assessment not found.")
            
        ass = ass_resp.data
        if ass.get("completed_at"):
            raise ValueError("Assessment already completed.")
            
        app = ass.get("applications") or {}
        app_id = ass["application_id"]
        recipient = app.get("email")
        candidate_name = app.get("candidate_name") or "Candidate"
        position = app.get("position") or "Internship"

        if not recipient:
            raise ValueError("Candidate does not have a valid email address.")

        # 1. Generate 72h assessment token
        plaintext_token, token_id, expires_at = self.token_service.generate_assessment_token(app_id)
        
        # Link token to assessment
        supabase.table("assessments").update({
            "access_token_id": token_id
        }).eq("assessment_id", assessment_id).execute()
        
        # Update application status to assessment_invited
        supabase.table("applications").update({
            "current_status": "assessment_invited"
        }).eq("application_id", app_id).execute()
        
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip('/')
        candidate_url = f"{frontend_url}/assessment/{plaintext_token}"
        expires_str = expires_at.strftime("%B %d, %Y at %I:%M %p UTC")

        # 2. Send Gmail invitation
        subject = f"Assessment Invitation: {position}"
        body_text = (
            f"Dear {candidate_name},\n\n"
            f"Congratulations.\n\n"
            f"You have been shortlisted for the {position} position.\n\n"
            f"Please complete your technical assessment using the secure link below:\n\n"
            f"{candidate_url}\n\n"
            f"This link expires on {expires_str}.\n\n"
            f"Regards,\n"
            f"HR Team"
        )
        body_html = f"""
        <p>Dear {candidate_name},</p>
        <p>Congratulations.</p>
        <p>You have been shortlisted for the <strong>{position}</strong> position.</p>
        <p>Please complete your technical assessment using the secure link below:</p>
        <p><a href="{candidate_url}" style="display:inline-block;padding:10px 20px;background-color:#4F46E5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Start Assessment</a></p>
        <p>Or visit: <a href="{candidate_url}">{candidate_url}</a></p>
        <p><small>This link expires on {expires_str}.</small></p>
        <br>
        <p>Regards,<br>HR Team</p>
        """

        provider = EmailService.get_provider()
        try:
            is_sent = provider.send_email(
                to_email=recipient,
                subject=subject,
                text_body=body_text,
                html_body=body_html,
                body_text=body_text,
                body_html=body_html,
                connected_by=hr_user_id
            )
            # Log email
            supabase.table("email_logs").insert({
                "application_id": app_id,
                "recipient": recipient,
                "subject": subject,
                "status": "sent" if is_sent.get("success") else "failed",
                "provider": is_sent.get("provider"),
                "provider_message_id": is_sent.get("message_id")
            }).execute()
        except Exception as e:
            logger.error(f"Failed to send assessment invitation email to {recipient}: {e}")

        # Audit log
        try:
            supabase.table("audit_logs").insert({
                "action": "ASSESSMENT_TOKEN_ISSUED",
                "application_id": app_id,
                "hr_user": hr_user_id,
                "metadata": {"assessment_id": assessment_id, "expires_at": expires_at.isoformat()}
            }).execute()
        except Exception:
            pass

        return {
            "assessment_id": assessment_id,
            "candidate_url": candidate_url,
            "expires_at": expires_at.isoformat(),
            "email_sent": True
        }

    def generate_token(self, assessment_id: str) -> Dict[str, Any]:
        """Backward compatible helper returning token and URL."""
        return self.generate_token_and_invite(assessment_id)

    def get_candidate_state(self, plaintext_token: str) -> Dict[str, Any]:
        """
        Candidate portal: resolves token and returns current assessment welcome info.
        NO duplicate skill verification is requested.
        """
        token = self.token_service.resolve_token(plaintext_token, expected_stage="assessment", allow_used=True)
        app_id = token["application_id"]
        
        app_resp = supabase.table("applications").select("candidate_name, position, department").eq("application_id", app_id).single().execute()
        app_data = app_resp.data or {}
        
        # Fetch the most recent assessment for this application, regardless of completion status
        ass_resp = supabase.table("assessments").select("*").eq("application_id", app_id).order("created_at", desc=True).limit(1).execute()
        if not ass_resp.data:
            raise ValueError("Assessment not found.")
            
        ass = ass_resp.data[0]
        questions = ass.get("questions_json") or []
        
        resp_query = supabase.table("assessment_responses").select("question_index").eq("assessment_id", ass["assessment_id"]).execute()
        answered_count = len(resp_query.data or [])
        
        return {
            "candidate_name": app_data.get("candidate_name") or "Candidate",
            "first_name": (app_data.get("candidate_name") or "Candidate").split()[0],
            "position": app_data.get("position") or "Internship",
            "department": app_data.get("department") or "Engineering",
            "total_questions": len(questions),
            "answered_count": answered_count,
            "completed": ass.get("completed_at") is not None,
            "result": ass.get("result"),
            "status": "ready"
        }

    def get_current_question(self, plaintext_token: str) -> Dict[str, Any]:
        """
        Candidate portal: returns the current active unanswered question.
        Server-authoritative timer: sets question_started_at and question_deadline_at
        on first serve; resumes existing deadline on page refresh.
        Auto-times-out expired questions and advances to the next one.
        Never returns correct_option, is_correct, or answers.
        """
        from datetime import timezone
        from dateutil import parser as dtparser

        token = self.token_service.resolve_token(plaintext_token, expected_stage="assessment")
        ass_resp = supabase.table("assessments").select("*").eq(
            "application_id", token["application_id"]
        ).is_("completed_at", "null").single().execute()
        if not ass_resp.data:
            raise ValueError("Assessment not found or already completed.")

        ass = ass_resp.data
        questions = ass.get("questions_json") or []
        total = len(questions)
        assessment_id = ass["assessment_id"]

        # ── Find first unanswered question iteratively (handles multiple timeouts) ──
        while True:
            resp_query = supabase.table("assessment_responses").select(
                "question_index"
            ).eq("assessment_id", assessment_id).execute()
            answered_indices = {r["question_index"] for r in (resp_query.data or [])}

            current_index = -1
            for i in range(total):
                if i not in answered_indices:
                    current_index = i
                    break

            if current_index == -1:
                return {"ready_to_submit": True, "total_questions": total, "answered_count": total}

            # ── Timer management ──────────────────────────────────────────────────
            now_utc = datetime.now(timezone.utc)
            stored_index = ass.get("current_question_index")
            stored_deadline_str = ass.get("question_deadline_at")

            if stored_index == current_index and stored_deadline_str:
                # Resume: parse existing deadline
                try:
                    deadline = dtparser.parse(stored_deadline_str)
                    if deadline.tzinfo is None:
                        deadline = deadline.replace(tzinfo=timezone.utc)
                except Exception:
                    deadline = None

                if deadline and now_utc >= deadline:
                    # Deadline passed while candidate was away — auto-timeout
                    self._apply_timeout(assessment_id, current_index)
                    # Reload assessment for updated state (clear stored deadline)
                    ass_reload = supabase.table("assessments").select("*").eq(
                        "assessment_id", assessment_id
                    ).single().execute()
                    ass = ass_reload.data or ass
                    continue  # Loop: find next unanswered question

                deadline_at_str = deadline.isoformat() if deadline else None
            else:
                # New question — start fresh timer (idempotent: only set when index changes)
                question_started = now_utc
                question_deadline = now_utc + timedelta(
                    seconds=settings.ASSESSMENT_QUESTION_TIME_SECONDS
                )
                update_payload = {
                    "question_started_at":   question_started.isoformat(),
                    "question_deadline_at":  question_deadline.isoformat(),
                    "current_question_index": current_index
                }
                if not ass.get("started_at"):
                    update_payload["started_at"] = question_started.isoformat()
                supabase.table("assessments").update(update_payload).eq(
                    "assessment_id", assessment_id
                ).execute()
                deadline_at_str = question_deadline.isoformat()

            # ── Return question (strips sensitive fields) ─────────────────────
            q = questions[current_index]
            return {
                "question_number": current_index + 1,
                "total_questions":  total,
                "question":         q["question"],
                "options":          q["options"],
                "answered_count":   len(answered_indices),
                "ready_to_submit":  False,
                "deadline_at":      deadline_at_str
            }

    def _apply_timeout(self, assessment_id: str, question_index: int) -> None:
        """
        Internal: records a timed_out response for question_index.
        Idempotent — does nothing if response already exists.
        Clears timer columns so next question gets a fresh timer.
        """
        existing = supabase.table("assessment_responses").select(
            "response_id"
        ).eq("assessment_id", assessment_id).eq("question_index", question_index).execute()

        if not existing.data:
            now_str = datetime.utcnow().isoformat()
            supabase.table("assessment_responses").insert({
                "assessment_id":   assessment_id,
                "question_index":  question_index,
                "selected_option": None,
                "is_correct":      False,
                "response_status": "timed_out",
                "marks_awarded":   0,
                "timed_out_at":    now_str,
                "locked_at":       now_str
            }).execute()
            logger.info(f"Timeout applied: assessment={assessment_id} question={question_index}")

        # Clear active timer so next question starts fresh
        supabase.table("assessments").update({
            "question_started_at": None,
            "question_deadline_at": None
        }).eq("assessment_id", assessment_id).execute()

    def submit_answer(self, plaintext_token: str, request: AnswerRequest) -> Dict[str, Any]:
        """
        Candidate portal: saves answer to assessment_responses.
        Enforces server-side deadline — rejects answers after question_deadline_at.
        Prevents modifying already answered questions (idempotent on duplicate).
        """
        from datetime import timezone
        from dateutil import parser as dtparser

        token = self.token_service.resolve_token(plaintext_token, expected_stage="assessment")
        ass_resp = supabase.table("assessments").select("*").eq(
            "application_id", token["application_id"]
        ).is_("completed_at", "null").single().execute()
        if not ass_resp.data:
            raise ValueError("Assessment not found or already completed.")

        ass = ass_resp.data
        questions = ass.get("questions_json") or []
        total = len(questions)

        # Support 1-based or 0-based index
        q_idx = request.question_index - 1 if (1 <= request.question_index <= total) else request.question_index
        if q_idx < 0 or q_idx >= total:
            raise ValueError("Invalid question index.")

        # ── Idempotency: if already answered, return safe conflict ──────────────
        check = supabase.table("assessment_responses").select("*").eq(
            "assessment_id", ass["assessment_id"]
        ).eq("question_index", q_idx).execute()
        if check.data:
            status = check.data[0].get("response_status", "answered")
            if status == "timed_out":
                raise ValueError("Question timer expired. Your answer was not accepted.")
            raise ValueError("This question has already been answered and cannot be modified.")

        # ── Server-side deadline validation ────────────────────────────────────
        deadline_str = ass.get("question_deadline_at")
        if deadline_str:
            try:
                deadline = dtparser.parse(deadline_str)
                if deadline.tzinfo is None:
                    from datetime import timezone
                    deadline = deadline.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) > deadline:
                    # Record as timeout and reject the answer
                    self._apply_timeout(ass["assessment_id"], q_idx)
                    raise ValueError(
                        "Question timer has expired. Your answer was not accepted. "
                        "The question has been recorded as timed out."
                    )
            except ValueError:
                raise
            except Exception:
                pass  # If deadline parsing fails, allow the answer through

        q = questions[q_idx]
        if request.selected_option < 0 or request.selected_option >= len(q["options"]):
            raise ValueError("Invalid option selected.")

        is_correct = (request.selected_option == q.get("correct_option"))
        selected_text = q["options"][request.selected_option]
        response_status = "answered_correct" if is_correct else "answered_incorrect"

        supabase.table("assessment_responses").insert({
            "assessment_id":   ass["assessment_id"],
            "question_index":  q_idx,
            "selected_option": selected_text,
            "is_correct":      is_correct,
            "response_status": response_status,
            "marks_awarded":   1.0 if is_correct else 0.0,
            "locked_at":       datetime.utcnow().isoformat()
        }).execute()

        # Reset timer columns — next question will get a fresh deadline
        supabase.table("assessments").update({
            "question_started_at":  None,
            "question_deadline_at": None
        }).eq("assessment_id", ass["assessment_id"]).execute()

        return {"success": True}

    def _calculate_integrity_penalty(self, assessment_id: str) -> tuple:
        """
        Internal: compute integrity penalty from logged events using violation deduplication.
        Returns (penalty_float, episode_list).
        Episodes within INTEGRITY_DEDUP_WINDOW_SECONDS of each other count as ONE violation.
        First INTEGRITY_WARNING_LIMIT episodes get grace (warning only, 0 penalty).
        All amounts capped at INTEGRITY_MAX_PENALTY.
        """
        from dateutil import parser as dtparser

        PENALTY_TYPES = {"TAB_SWITCH", "FULLSCREEN_EXIT", "COPY_ATTEMPT", "PASTE_ATTEMPT", "CUT_ATTEMPT"}
        SEVERITY_ORDER = ["TAB_SWITCH", "FULLSCREEN_EXIT", "COPY_ATTEMPT", "PASTE_ATTEMPT", "CUT_ATTEMPT"]

        PENALTY_MAP = {
            "TAB_SWITCH":      settings.INTEGRITY_TAB_SWITCH_PENALTY,
            "FULLSCREEN_EXIT": settings.INTEGRITY_FULLSCREEN_EXIT_PENALTY,
            "COPY_ATTEMPT":    settings.INTEGRITY_COPY_ATTEMPT_PENALTY,
            "PASTE_ATTEMPT":   settings.INTEGRITY_PASTE_ATTEMPT_PENALTY,
            "CUT_ATTEMPT":     settings.INTEGRITY_CUT_ATTEMPT_PENALTY,
        }

        events_resp = supabase.table("assessment_integrity_events").select(
            "event_id, event_type, question_index, occurred_at"
        ).eq("assessment_id", assessment_id).order("occurred_at", desc=False).execute()
        all_events = events_resp.data or []

        # Filter to penalty-eligible events only
        eligible = [e for e in all_events if e["event_type"] in PENALTY_TYPES]
        if not eligible:
            return 0.0, []

        # Group into violation episodes (events within DEDUP_WINDOW of each other)
        dedup_window = timedelta(seconds=settings.INTEGRITY_DEDUP_WINDOW_SECONDS)
        episodes: List[List[Dict]] = []
        current_group = [eligible[0]]
        episode_start = dtparser.parse(eligible[0]["occurred_at"])
        if episode_start.tzinfo is None:
            from datetime import timezone
            episode_start = episode_start.replace(tzinfo=timezone.utc)

        for ev in eligible[1:]:
            ev_time = dtparser.parse(ev["occurred_at"])
            if ev_time.tzinfo is None:
                from datetime import timezone
                ev_time = ev_time.replace(tzinfo=timezone.utc)
            if (ev_time - episode_start) <= dedup_window:
                current_group.append(ev)
            else:
                episodes.append(current_group)
                current_group = [ev]
                episode_start = ev_time
        episodes.append(current_group)

        warning_limit = settings.INTEGRITY_WARNING_LIMIT
        total_penalty = 0.0
        episode_details = []

        for i, group in enumerate(episodes):
            # Determine primary event type (highest severity in group)
            group_types = {e["event_type"] for e in group}
            primary_type = next((t for t in SEVERITY_ORDER if t in group_types), group[0]["event_type"])

            is_grace = i < warning_limit
            penalty = 0.0 if is_grace else float(PENALTY_MAP.get(primary_type, 0))
            total_penalty += penalty

            episode_details.append({
                "episode_number":    i + 1,
                "primary_event_type": primary_type,
                "event_count":       len(group),
                "occurred_at":       group[0]["occurred_at"],
                "question_index":    group[0].get("question_index"),
                "is_warning":        is_grace,
                "warning_number":    (i + 1) if is_grace else None,
                "penalty_applied":   penalty,
            })

        capped_penalty = min(total_penalty, float(settings.INTEGRITY_MAX_PENALTY))
        return capped_penalty, episode_details

    def submit_assessment(self, plaintext_token: str) -> Dict[str, Any]:
        """
        Candidate portal: final assessment submission.
        Calculates raw_score from correct responses, applies integrity penalty,
        derives adjusted_score, and stores a policy snapshot so results are
        reproducible even if config changes later.
        Does NOT expose scores to the candidate.
        """
        token = self.token_service.resolve_token(plaintext_token, expected_stage="assessment")
        app_id = token["application_id"]

        ass_resp = supabase.table("assessments").select("*").eq(
            "application_id", app_id
        ).is_("completed_at", "null").single().execute()
        if not ass_resp.data:
            raise ValueError("Assessment not found or already completed.")

        ass = ass_resp.data
        questions = ass.get("questions_json") or []
        total = len(questions)

        resp_query = supabase.table("assessment_responses").select("*").eq(
            "assessment_id", ass["assessment_id"]
        ).execute()
        responses = resp_query.data or []

        if len(responses) < total:
            raise ValueError(f"Cannot submit. Only {len(responses)}/{total} questions answered.")

        # ── Count outcomes (handles both old rows without response_status and new) ──
        correct_count   = 0
        incorrect_count = 0
        timed_out_count = 0
        for r in responses:
            status = r.get("response_status") or ""
            if status == "timed_out":
                timed_out_count += 1
            elif status == "answered_correct" or (not status and r.get("is_correct")):
                correct_count += 1
            else:
                incorrect_count += 1

        raw_score = round((correct_count / total) * 100.0, 2)

        # ── Integrity penalty ──────────────────────────────────────────────────
        integrity_penalty, episodes = self._calculate_integrity_penalty(ass["assessment_id"])
        adjusted_score = round(max(0.0, raw_score - integrity_penalty), 2)

        threshold = float(ass.get("pass_threshold", 60.0))
        result = "pass" if adjusted_score >= threshold else "fail"

        # ── Policy snapshot: freeze current config so history is reproducible ──
        policy_snapshot = {
            "warning_limit":             settings.INTEGRITY_WARNING_LIMIT,
            "tab_switch_penalty":        settings.INTEGRITY_TAB_SWITCH_PENALTY,
            "fullscreen_exit_penalty":   settings.INTEGRITY_FULLSCREEN_EXIT_PENALTY,
            "copy_attempt_penalty":      settings.INTEGRITY_COPY_ATTEMPT_PENALTY,
            "paste_attempt_penalty":     settings.INTEGRITY_PASTE_ATTEMPT_PENALTY,
            "cut_attempt_penalty":       settings.INTEGRITY_CUT_ATTEMPT_PENALTY,
            "max_penalty":               settings.INTEGRITY_MAX_PENALTY,
            "dedup_window_seconds":      settings.INTEGRITY_DEDUP_WINDOW_SECONDS,
            "question_time_seconds":     settings.ASSESSMENT_QUESTION_TIME_SECONDS,
        }

        supabase.table("assessments").update({
            "score":                    adjusted_score,   # backward compat
            "raw_score":                raw_score,
            "integrity_penalty":        integrity_penalty,
            "adjusted_score":           adjusted_score,
            "timed_out_count":          timed_out_count,
            "result":                   result,
            "completed_at":             datetime.utcnow().isoformat(),
            "question_started_at":      None,
            "question_deadline_at":     None,
            "integrity_policy_snapshot": policy_snapshot
        }).eq("assessment_id", ass["assessment_id"]).execute()

        # Invalidate assessment token
        self.token_service.invalidate_token(token["token_id"])

        # Update application status
        new_app_status = "assessment_passed" if result == "pass" else "assessment_failed"
        supabase.table("applications").update(
            {"current_status": new_app_status}
        ).eq("application_id", app_id).execute()

        # Trigger Result Email safely
        self._send_assessment_result_email(ass, app_id, result)

        try:
            supabase.table("audit_logs").insert({
                "action": "ASSESSMENT_COMPLETED",
                "application_id": app_id,
                "metadata": {
                    "assessment_id":   ass["assessment_id"],
                    "raw_score":       raw_score,
                    "integrity_penalty": integrity_penalty,
                    "adjusted_score":  adjusted_score,
                    "result":          result,
                    "threshold":       threshold,
                    "correct":         correct_count,
                    "incorrect":       incorrect_count,
                    "timed_out":       timed_out_count,
                }
            }).execute()
        except Exception:
            pass

        if result == "pass":
            return {
                "completed": True,
                "result": "pass",
                "message": "Assessment Completed. Please check your registered email for further updates."
            }
        return {
            "completed": True,
            "result": "fail",
            "message": "Assessment Completed. Please check your registered email for further updates."
        }

    def _send_assessment_result_email(self, ass: Dict[str, Any], application_id: str, result: str) -> None:
        """
        Internal: Sends the ASSESSMENT_PASSED or ASSESSMENT_FAILED email.
        Idempotent based on assessment_id and email_type.
        Failure does NOT raise an exception to prevent rolling back the assessment.
        """
        app_resp = supabase.table("applications").select("email, candidate_name, position").eq("application_id", application_id).single().execute()
        if not app_resp.data:
            return
            
        app = app_resp.data
        recipient = app.get("email")
        if not recipient:
            return

        candidate_name = app.get("candidate_name", "Candidate")
        position = app.get("position") or ass.get("job_requirements", {}).get("title") or "Internship"
        email_type = "ASSESSMENT_PASSED" if result == "pass" else "ASSESSMENT_FAILED"
        
        # Idempotency check: see if a 'sent' email already exists for this type & assessment
        existing = supabase.table("email_logs").select("email_id").eq(
            "assessment_id", ass["assessment_id"]
        ).eq("email_type", email_type).eq("status", "sent").execute()
        
        if existing.data:
            logger.info(f"Result email already sent for assessment {ass['assessment_id']}. Skipping.")
            return

        subject = f"Assessment Result — {position}"
        
        if result == "pass":
            body_text = (
                f"Dear {candidate_name},\n\n"
                f"Congratulations!\n\n"
                f"You have successfully completed and passed the assessment for the {position} position.\n\n"
                f"Your application is now under review for the next stage of our recruitment process.\n\n"
                f"Please monitor your registered email for further instructions.\n\n"
                f"Regards,\n"
                f"HR Department"
            )
            body_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
                <h2 style="color: #4F46E5;">HR Department</h2>
                <p>Dear {candidate_name},</p>
                <p><strong>Congratulations!</strong></p>
                <p>You have successfully completed and passed the assessment for the <strong>{position}</strong> position.</p>
                <p>Your application is now under review for the next stage of our recruitment process.</p>
                <p>Please monitor your registered email for further instructions.</p>
                <br>
                <p>Regards,<br><strong>HR Department</strong></p>
            </div>
            """
        else:
            body_text = (
                f"Dear {candidate_name},\n\n"
                f"Thank you for completing the assessment for the {position} position.\n\n"
                f"Your assessment has been completed and your application has been updated.\n\n"
                f"Thank you for your time and interest in the opportunity.\n\n"
                f"Regards,\n"
                f"HR Department"
            )
            body_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
                <h2 style="color: #4F46E5;">HR Department</h2>
                <p>Dear {candidate_name},</p>
                <p>Thank you for completing the assessment for the <strong>{position}</strong> position.</p>
                <p>Your assessment has been completed and your application has been updated.</p>
                <p>Thank you for your time and interest in the opportunity.</p>
                <br>
                <p>Regards,<br><strong>HR Department</strong></p>
            </div>
            """

        provider = EmailService.get_provider()
        status = "failed"
        error_msg = None
        
        try:
            email_res = provider.send_email(
                to_email=recipient,
                subject=subject,
                text_body=body_text,
                html_body=body_html
            )
            status = "sent" if email_res else "failed" # Gmail API returning bool
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to send {email_type} email to {recipient}: {error_msg}")

        # Log email
        try:
            supabase.table("email_logs").insert({
                "application_id": application_id,
                "assessment_id": ass["assessment_id"],
                "email_type": email_type,
                "recipient": recipient,
                "subject": subject,
                "status": status,
                "error": error_msg
            }).execute()
            
            supabase.table("audit_logs").insert({
                "action": "ASSESSMENT_RESULT_EMAIL_SENT" if status == "sent" else "ASSESSMENT_RESULT_EMAIL_FAILED",
                "application_id": application_id,
                "metadata": {
                    "assessment_id": ass["assessment_id"],
                    "email_type": email_type,
                    "recipient": recipient,
                    "error": error_msg
                }
            }).execute()
        except Exception as ex:
            logger.error(f"Failed to log {email_type} email: {ex}")

    def retry_result_email(self, assessment_id: str) -> Dict[str, Any]:
        """HR Admin: Retries sending the result email if it failed previously. Idempotent."""
        ass_resp = supabase.table("assessments").select("*").eq("assessment_id", assessment_id).single().execute()
        if not ass_resp.data:
            raise ValueError("Assessment not found.")
            
        ass = ass_resp.data
        if not ass.get("completed_at"):
            raise ValueError("Cannot send result email for an incomplete assessment.")
            
        result = ass.get("result", "fail")
        self._send_assessment_result_email(ass, ass["application_id"], result)
        
        # We check if it succeeded this time by querying the log
        email_type = "ASSESSMENT_PASSED" if result == "pass" else "ASSESSMENT_FAILED"
        log = supabase.table("email_logs").select("status").eq("assessment_id", assessment_id).eq("email_type", email_type).order("created_at", desc=True).limit(1).execute()
        
        status = log.data[0]["status"] if log.data else "failed"
        return {"success": status == "sent", "status": status}

    def get_dashboard_data(self) -> List[Dict[str, Any]]:
        """HR Dashboard: returns all assessments with application details and raw scores."""
        query = supabase.table("assessments").select(
            "*, applications(candidate_name, email, current_status, position, department), job_requirements(position_title)"
        ).order("created_at", desc=True)
        return query.execute().data or []
        
    def get_detail(self, assessment_id: str) -> Dict[str, Any]:
        """HR Admin: detailed view with candidate skills, ML recommendation, scores, and question breakdown."""
        ass_resp = supabase.table("assessments").select(
            "*, applications(application_id, candidate_name, email, position, department, skills), job_requirements(position_title)"
        ).eq("assessment_id", assessment_id).single().execute()
        if not ass_resp.data:
            raise ValueError("Assessment not found.")

        ass = ass_resp.data
        app = ass.get("applications") or {}
        app_id = ass.get("application_id")

        ml_res = supabase.table("ml_evaluations").select(
            "predicted_class, match_score"
        ).eq("application_id", app_id).order("evaluated_at", desc=True).limit(1).execute()
        ml_data = ml_res.data[0] if ml_res.data else {}

        resp_query = supabase.table("assessment_responses").select("*").eq("assessment_id", assessment_id).execute()
        responses = {r["question_index"]: r for r in (resp_query.data or [])}

        questions = ass.get("questions_json") or []
        correct_count   = 0
        incorrect_count = 0
        timed_out_count = 0
        breakdown = []

        for i, q in enumerate(questions):
            r = responses.get(i)
            status = r.get("response_status", "") if r else ""
            is_corr = r.get("is_correct", False) if r else False
            is_timeout = status == "timed_out"

            if r:
                if is_timeout:
                    timed_out_count += 1
                elif is_corr:
                    correct_count += 1
                else:
                    incorrect_count += 1

            correct_opt_idx = q.get("correct_option", 0)
            correct_text = q["options"][correct_opt_idx] if 0 <= correct_opt_idx < len(q["options"]) else "N/A"

            breakdown.append({
                "question_number":  i + 1,
                "question":         q.get("question"),
                "skill":            q.get("skill"),
                "difficulty":       q.get("difficulty"),
                "candidate_answer": r.get("selected_option") if r else None,
                "correct_answer":   correct_text,
                "is_correct":       is_corr,
                "response_status":  status or ("answered_correct" if is_corr else "answered_incorrect") if r else "not_answered"
            })

        time_taken = None
        if ass.get("started_at") and ass.get("completed_at"):
            try:
                start = datetime.fromisoformat(ass["started_at"].replace('Z', '+00:00'))
                end   = datetime.fromisoformat(ass["completed_at"].replace('Z', '+00:00'))
                time_taken = int((end - start).total_seconds())
            except Exception:
                pass

        # Get violation episodes for HR detail
        _, episodes = self._calculate_integrity_penalty(assessment_id)

        # Use stored scores if available, fall back to live calculation
        raw_score       = ass.get("raw_score")
        integrity_penalty = float(ass.get("integrity_penalty") or 0.0)
        adjusted_score  = ass.get("adjusted_score")
        stored_score    = ass.get("score")  # backward compat

        # If assessment predates new columns, fall back to stored score
        if raw_score is None and stored_score is not None:
            raw_score = stored_score
            adjusted_score = stored_score

        # Get latest email status
        email_status = "not_sent"
        if ass.get("result"):
            email_type = "ASSESSMENT_PASSED" if ass["result"] == "pass" else "ASSESSMENT_FAILED"
            log_resp = supabase.table("email_logs").select("status").eq("assessment_id", assessment_id).eq("email_type", email_type).order("created_at", desc=True).limit(1).execute()
            if log_resp.data:
                email_status = log_resp.data[0]["status"]

        return {
            "assessment_id":    ass["assessment_id"],
            "application_id":   app_id,
            "candidate_name":   app.get("candidate_name") or "Candidate",
            "email":            app.get("email"),
            "position":         app.get("position") or ass.get("job_requirements", {}).get("title") or "Internship",
            "department":       app.get("department"),
            "verified_skills":  app.get("skills") or [],
            "predicted_class":  ml_data.get("predicted_class"),
            "match_score":      ml_data.get("match_score"),
            "question_count":   len(questions),
            "correct_count":    correct_count,
            "incorrect_count":  incorrect_count,
            "timed_out_count":  timed_out_count,
            "started_at":       ass.get("started_at"),
            "completed_at":     ass.get("completed_at"),
            "score":            stored_score,
            "raw_score":        raw_score,
            "integrity_penalty": integrity_penalty,
            "adjusted_score":   adjusted_score,
            "threshold":        float(ass.get("pass_threshold", 60.0)),
            "result":           ass.get("result"),
            "email_status":     email_status,
            "time_taken_seconds": time_taken,
            "question_breakdown": breakdown,
            "violation_episodes":  episodes,
        }

    def override_result(self, assessment_id: str, request: HROverrideRequest, admin_id: str) -> Dict[str, Any]:
        """
        HR Admin: overrides pass/fail status with audit log. Original score is preserved.
        """
        ass_resp = supabase.table("assessments").select("*").eq("assessment_id", assessment_id).single().execute()
        if not ass_resp.data:
            raise ValueError("Assessment not found.")
            
        ass = ass_resp.data
        if not ass.get("completed_at"):
            raise ValueError("Cannot override an incomplete assessment.")
            
        old_result = ass.get("result")
        new_result = request.result.lower()
        if new_result not in ("pass", "fail"):
            raise ValueError("Override result must be 'pass' or 'fail'.")
            
        supabase.table("assessments").update({
            "result": new_result
        }).eq("assessment_id", assessment_id).execute()
        
        new_app_status = "assessment_passed" if new_result == "pass" else "assessment_failed"
        supabase.table("applications").update({"current_status": new_app_status}).eq("application_id", ass["application_id"]).execute()
        
        try:
            supabase.table("audit_logs").insert({
                "action": "ASSESSMENT_RESULT_OVERRIDDEN",
                "application_id": ass["application_id"],
                "metadata": {
                    "assessment_id": assessment_id,
                    "previous_result": old_result,
                    "new_result": new_result,
                    "reason": request.reason.strip(),
                    "overridden_by": admin_id
                }
            }).execute()
        except Exception:
            pass
            
        return {"success": True}

    def send_interview_invitation(self, application_id: str, hr_user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Next stage for assessment_passed candidates: sends automated text interview invitation via Gmail API.
        No Google / Outlook calendar event is created (calendar is only for scheduled human interviews).
        """
        app_resp = supabase.table("applications").select("*").eq("application_id", application_id).single().execute()
        if not app_resp.data:
            raise ValueError("Application not found.")
            
        app = app_resp.data
        if app.get("current_status") != "assessment_passed":
            raise ValueError(f"Cannot send interview invitation to candidate with status '{app.get('current_status')}'.")
            
        recipient = app.get("email")
        candidate_name = app.get("candidate_name") or "Candidate"
        position = app.get("position") or "Internship"

        if not recipient:
            raise ValueError("Missing candidate email address.")

        # Generate AI interview token
        plaintext_token, token_id, expires_at = self.token_service.generate_token_for_stage(application_id, stage="ai_interview")
        
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip('/')
        interview_url = f"{frontend_url}/ai-interview/{plaintext_token}"
        expires_str = expires_at.strftime("%B %d, %Y at %I:%M %p UTC")

        # Send Gmail AI interview invitation
        subject = f"AI Interview Invitation — {position}"
        body_text = (
            f"Dear {candidate_name},\n\n"
            f"Congratulations on successfully completing the assessment.\n\n"
            f"You have been selected to proceed to the AI Interview stage for the {position} position.\n\n"
            f"Please use the secure link below:\n\n"
            f"{interview_url}\n\n"
            f"This link is unique to your application.\n\n"
            f"Regards,\n"
            f"HR Department"
        )
        body_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
            <h2 style="color: #4F46E5;">HR Department</h2>
            <p>Dear {candidate_name},</p>
            <p>Congratulations on successfully completing the assessment.</p>
            <p>You have been selected to proceed to the AI Interview stage for the <strong>{position}</strong> position.</p>
            <p>Please use the secure link below:</p>
            <p style="margin: 25px 0;">
                <a href="{interview_url}" style="background-color: #4F46E5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                    Start AI Interview
                </a>
            </p>
            <p>Or visit: <a href="{interview_url}">{interview_url}</a></p>
            <p><small>This link is unique to your application.</small></p>
            <br>
            <p>Regards,<br><strong>HR Department</strong></p>
        </div>
        """

        provider = EmailService.get_provider()
        try:
            email_res = provider.send_email(
                to_email=recipient,
                subject=subject,
                text_body=body_text,
                html_body=body_html,
                connected_by=hr_user_id
            )
            
            # Record the AI interview in the database
            supabase.table("ai_interviews").insert({
                "application_id": application_id,
                "position_id": app.get("position_id"),
                "access_token_id": token_id,
                "questions_json": [],
                "answers_json": []
            }).execute()
            
            supabase.table("email_logs").insert({
                "application_id": application_id,
                "email_type": "AI_INTERVIEW_INVITATION",
                "recipient": recipient,
                "subject": subject,
                "status": "sent" if email_res.get("success") else "failed",
                "error": email_res.get("error"),
                "provider": email_res.get("provider"),
                "provider_message_id": email_res.get("message_id")
            }).execute()
        except Exception as e:
            logger.error(f"Failed to send interview invitation email to {recipient}: {e}")

        # Update application status
        supabase.table("applications").update({"current_status": "ai_interview_invited"}).eq("application_id", application_id).execute()
        
        try:
            supabase.table("audit_logs").insert({
                "action": "INTERVIEW_INVITATION_SENT",
                "application_id": application_id,
                "hr_user": hr_user_id,
                "metadata": {"token_id": token_id, "expires_at": expires_at.isoformat()}
            }).execute()
        except Exception:
            pass

        return {
            "success": True,
            "interview_url": interview_url,
            "expires_at": expires_at.isoformat()
        }

    # ------------------------------------------------------------------
    # Assessment Integrity Signals
    # ------------------------------------------------------------------

    def log_integrity_event(self, plaintext_token: str, request: IntegrityEventRequest) -> Dict[str, Any]:
        """
        Candidate portal: logs a single browser integrity signal.
        Token must be valid, assessment must be active (not completed, not expired).
        Rate limiting: max 10 identical event_type events per minute per assessment.
        Does NOT change score, result, or application status.
        Does NOT store clipboard content or any sensitive data.
        """
        # 1. Validate token (raises ValueError if invalid/expired/wrong-stage)
        token = self.token_service.resolve_token(plaintext_token, expected_stage="assessment")
        app_id = token["application_id"]

        # 2. Resolve assessment — must exist and NOT be completed
        ass_resp = supabase.table("assessments").select(
            "assessment_id, completed_at"
        ).eq("application_id", app_id).is_("completed_at", "null").execute()

        if not ass_resp.data:
            raise ValueError("Assessment is already completed or not found. Integrity events cannot be logged after submission.")

        assessment_id = ass_resp.data[0]["assessment_id"]

        # 3. Server-side rate limiting: max 10 same event_type events per minute per assessment
        try:
            one_minute_ago = (datetime.utcnow() - timedelta(minutes=1)).isoformat()
            recent = supabase.table("assessment_integrity_events").select(
                "event_id", count="exact"
            ).eq("assessment_id", assessment_id).eq(
                "event_type", request.event_type
            ).gte("occurred_at", one_minute_ago).execute()

            if recent.count and recent.count >= 10:
                # Silently discard — do not raise, just return ok to client
                return {"logged": False, "reason": "rate_limited"}
        except Exception:
            pass  # If rate-limit check fails, still log the event

        # 4. Insert integrity event — only safe metadata
        event_payload = {
            "assessment_id": assessment_id,
            "event_type": request.event_type,
            "question_index": request.question_index,
            "occurred_at": datetime.utcnow().isoformat()
            # metadata field reserved for future non-sensitive additions
        }

        try:
            supabase.table("assessment_integrity_events").insert(event_payload).execute()
        except Exception as e:
            logger.warning(f"Failed to log integrity event {request.event_type} for assessment {assessment_id}: {e}")
            # Do not raise — integrity logging must never crash the candidate's assessment

        return {"logged": True}

    def get_integrity_summary(self, assessment_id: str) -> Dict[str, Any]:
        """
        HR Admin only. Returns event counts, derived integrity status, event timeline,
        and violation episode breakdown for penalty calculation.
        Does NOT expose candidate token.
        """
        # Verify assessment exists
        ass_resp = supabase.table("assessments").select("assessment_id").eq("assessment_id", assessment_id).execute()
        if not ass_resp.data:
            raise ValueError("Assessment not found.")

        # Fetch all events ordered by time
        events_resp = supabase.table("assessment_integrity_events").select(
            "event_id, event_type, question_index, occurred_at"
        ).eq("assessment_id", assessment_id).order("occurred_at", desc=False).execute()

        events = events_resp.data or []

        # Compute counts
        counts = {
            "TAB_SWITCH": 0,
            "WINDOW_BLUR": 0,
            "FULLSCREEN_EXIT": 0,
            "COPY_ATTEMPT": 0,
            "PASTE_ATTEMPT": 0,
            "CUT_ATTEMPT": 0,
        }
        fullscreen_supported = True

        for ev in events:
            et = ev.get("event_type", "")
            if et in counts:
                counts[et] += 1
            if et == "FULLSCREEN_UNSUPPORTED":
                fullscreen_supported = False

        # Derive integrity status using configurable threshold
        threshold = settings.ASSESSMENT_TAB_SWITCH_REVIEW_THRESHOLD
        review = (
            counts["TAB_SWITCH"] >= threshold
            or counts["FULLSCREEN_EXIT"] >= 2
            or counts["COPY_ATTEMPT"] >= 3
        )
        integrity_status = "review_recommended" if review else "clear"

        # Build timeline
        timeline = []
        for ev in events:
            timeline.append({
                "event_id": ev["event_id"],
                "event_type": ev["event_type"],
                "question_index": ev.get("question_index"),
                "occurred_at": ev["occurred_at"]
            })

        # Calculate violation episodes and penalties
        total_penalty, episodes = self._calculate_integrity_penalty(assessment_id)
        
        warnings_issued = sum(1 for ep in episodes if ep.get("is_warning"))
        penalties_applied = sum(1 for ep in episodes if not ep.get("is_warning"))

        return {
            "assessment_id": assessment_id,
            "tab_switches": counts["TAB_SWITCH"],
            "window_blurs": counts["WINDOW_BLUR"],
            "fullscreen_exits": counts["FULLSCREEN_EXIT"],
            "copy_attempts": counts["COPY_ATTEMPT"],
            "paste_attempts": counts["PASTE_ATTEMPT"],
            "cut_attempts": counts["CUT_ATTEMPT"],
            "fullscreen_supported": fullscreen_supported,
            "integrity_status": integrity_status,
            "warnings_issued": warnings_issued,
            "penalties_applied": penalties_applied,
            "total_penalty": total_penalty,
            "event_timeline": timeline,
            "violation_episodes": episodes,
            "disclaimer": "Integrity signals are provided for HR review and are not proof of misconduct on their own.",
            "review_threshold": threshold
        }
