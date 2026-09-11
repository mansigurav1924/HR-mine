import logging
from datetime import datetime, timedelta, date, time
from typing import Optional, Dict, Any, List
from app.services.supabase_client import supabase
from app.schemas.interview import ScheduleInterviewRequest, AttendanceRequest, EvaluationRequest, RescheduleRequest, FlagRescheduleRequest
from app.services.integrations.calendar_service import get_calendar_provider
from app.services.integrations.gmail_service import gmail_service

logger = logging.getLogger(__name__)

def _parse_interview_row(intv: Dict[str, Any]) -> Dict[str, Any]:
    notes = intv.get("notes") or ""
    provider = intv.get("calendar_provider")
    sync_status = intv.get("calendar_sync_status")
    duration = intv.get("duration_minutes") or 45
    
    if "provider:" in notes:
        for part in notes.split("|"):
            if part.startswith("provider:"):
                provider = part.split(":", 1)[1]
            elif part.startswith("sync:"):
                sync_status = part.split(":", 1)[1]
            elif part.startswith("duration:"):
                try:
                    duration = int(part.split(":", 1)[1])
                except Exception:
                    pass

    intv["calendar_provider"] = provider or ("outlook" if "teams" in (intv.get("meeting_link") or "") else "google")
    intv["calendar_sync_status"] = sync_status or ("synced" if intv.get("calendar_event_id") else "pending")
    intv["duration_minutes"] = duration
    return intv

class InterviewService:
    
    def get_interviewers(self):
        resp = supabase.table("users").select("user_id, email, role").in_("role", ["interviewer", "hr_admin"]).execute()
        return [
            {
                "user_id": u["user_id"],
                "email": u["email"],
                "first_name": u.get("email", "").split("@")[0].capitalize(),
                "last_name": "",
                "role": u.get("role", "interviewer")
            }
            for u in (resp.data or [])
        ]
        
    def schedule_interview(self, req: ScheduleInterviewRequest, hr_id: str):
        # 1. Validate Application Status
        app_resp = supabase.table("applications").select("candidate_name, email, position, current_status").eq("application_id", req.application_id).single().execute()
        if not app_resp.data:
            raise ValueError("Application not found.")
        
        status = app_resp.data["current_status"]
        valid_statuses = ["ai_interview_completed", "human_interview_ready", "interview_selected", "interview_scheduled"]
        if status not in valid_statuses:
            raise Exception(f"Application is in status '{status}'. Must be one of {valid_statuses} to schedule a human interview.")
            
        # 2. Validate Interviewer
        intv_resp = supabase.table("users").select("user_id, email, role").eq("user_id", req.interviewer_id).single().execute()
        if not intv_resp.data:
            raise ValueError("Invalid interviewer.")
        interviewer = intv_resp.data
        interviewer_email = interviewer.get("email")
        interviewer_name = interviewer.get("email", "").split("@")[0].capitalize() or "Interviewer"

        candidate_name = app_resp.data.get("candidate_name") or "Candidate"
        candidate_email = app_resp.data.get("email")
        pos_title = app_resp.data.get("position") or "Internship Position"
            
        if req.round_number is None:
            max_round_resp = supabase.table("interviews").select("round_number, interview_id").eq("application_id", req.application_id).neq("status", "cancelled").order("round_number", desc=True).limit(1).execute()
            if max_round_resp.data:
                req.round_number = max_round_resp.data[0]["round_number"] + 1
                if not req.depends_on_round:
                    req.depends_on_round = max_round_resp.data[0]["interview_id"]
            else:
                req.round_number = 1

        if req.round_number < 1:
            raise ValueError("Round number must be >= 1.")
            
        if req.mode == "offline" and not req.location:
            raise ValueError("Offline interview requires a location.")
            
        # 3. Round Dependency Check
        if req.round_number > 1:
            if not req.depends_on_round:
                # If depends_on_round was somehow not set, we can just skip or assign it to None. 
                pass
            else:
                dep_resp = supabase.table("interviews").select("status").eq("interview_id", req.depends_on_round).single().execute()
                if not dep_resp.data:
                    raise ValueError("Dependent round not found.")

        # 4. Duplicate Check
        dup = supabase.table("interviews").select("interview_id").eq("application_id", req.application_id).eq("round_number", req.round_number).neq("status", "cancelled").execute()
        if dup.data:
            raise ValueError(f"Active interview for round {req.round_number} already exists.")
            
        # 5. External Calendar Synchronization
        duration = req.duration_minutes or 45
        tz = req.timezone_str or "UTC"
        start_dt = datetime.combine(req.date, req.time)
        end_dt = start_dt + timedelta(minutes=duration)
        start_iso = start_dt.isoformat()
        end_iso = end_dt.isoformat()

        cal_provider_name = req.calendar_provider or "google"
        provider = get_calendar_provider(cal_provider_name)
        
        attendees = []
        if candidate_email:
            attendees.append({"email": candidate_email, "name": candidate_name})
        if interviewer_email:
            attendees.append({"email": interviewer_email, "name": interviewer_name})

        event_title = f"Interview — {pos_title}"
        event_desc = (
            f"Candidate: {candidate_name}\n"
            f"Position: {pos_title}\n"
            f"Round: Round {req.round_number} ({req.type})\n"
            f"Mode: {req.mode.capitalize()}\n"
            f"Interviewer: {interviewer_name}\n"
            f"HR Contact: HR Recruitment Team"
        )

        calendar_event_id = None
        calendar_sync_status = "synced"
        calendar_last_error = None
        meeting_link = req.meeting_link

        try:
            cal_res = provider.create_interview_event(
                title=event_title,
                description=event_desc,
                start_datetime_iso=start_iso,
                end_datetime_iso=end_iso,
                timezone_str=tz,
                attendees=attendees,
                location=req.location,
                create_online_meeting=(req.mode == "online"),
                connected_by=hr_id
            )
            calendar_event_id = cal_res.event_id
            if req.mode == "online" and cal_res.meeting_link:
                meeting_link = cal_res.meeting_link
        except Exception as e:
            logger.error(f"Calendar event creation failed: {e}")
            calendar_sync_status = "failed"
            calendar_last_error = str(e)[:255]

        # For online interviews, if external meeting link generation is pending or failed and no link was entered, generate a fallback meeting link
        if req.mode == "online" and not meeting_link:
            meeting_link = f"https://meet.google.com/int-{req.application_id[:4]}-{req.round_number}"

        insert_data = {
            "application_id": req.application_id,
            "round_number": req.round_number,
            "depends_on_round": req.depends_on_round,
            "date": str(req.date),
            "time": str(req.time),
            "interviewer_id": req.interviewer_id,
            "type": req.type,
            "mode": req.mode,
            "location": req.location,
            "meeting_link": meeting_link,
            "calendar_event_id": calendar_event_id,
            "status": "scheduled",
            "attendance": "pending",
            "scheduled_by": hr_id,
            "notes": f"provider:{cal_provider_name}|sync:{calendar_sync_status}|duration:{duration}"
        }
        
        resp = supabase.table("interviews").insert(insert_data).execute()
        saved_row = _parse_interview_row(resp.data[0])
        interview_id = saved_row["interview_id"]
        
        # Advance application status
        if status in ("ai_interview_completed", "human_interview_ready", "interview_selected"):
            supabase.table("applications").update({"current_status": "interview_scheduled"}).eq("application_id", req.application_id).execute()
             
        # 6. Dispatch Candidate & Interviewer Notification via Gmail API
        self._send_interview_notification(
            interview_id=interview_id,
            candidate_name=candidate_name,
            candidate_email=candidate_email,
            interviewer_name=interviewer_name,
            interviewer_email=interviewer_email,
            pos_title=pos_title,
            round_num=req.round_number,
            date_str=str(req.date),
            time_str=str(req.time),
            mode=req.mode,
            meeting_link=meeting_link,
            location=req.location,
            action_type="scheduled",
            hr_user_id=hr_id
        )

        # Audit Logs
        supabase.table("audit_logs").insert({
            "action": "INTERVIEW_SCHEDULED",
            "application_id": req.application_id,
            "hr_user": hr_id,
            "metadata": {"interview_id": interview_id, "round_number": req.round_number, "calendar_provider": cal_provider_name}
        }).execute()

        cal_audit_action = "INTERVIEW_CALENDAR_CREATED" if calendar_sync_status == "synced" else "INTERVIEW_CALENDAR_SYNC_FAILED"
        try:
            supabase.table("audit_logs").insert({
                "action": cal_audit_action,
                "application_id": req.application_id,
                "hr_user": hr_id,
                "metadata": {
                    "interview_id": interview_id,
                    "calendar_provider": cal_provider_name,
                    "calendar_event_id": calendar_event_id,
                    "sync_status": calendar_sync_status,
                    "error": calendar_last_error
                }
            }).execute()
        except Exception:
            pass
        
        return saved_row

    def get_interviews(self, current_user, status=None, page=1, page_size=20):
        query = supabase.table("interviews").select("*, applications(candidate_name, email, current_status), users!interviews_interviewer_id_fkey(user_id, email, role)")
        
        if current_user.role == "interviewer":
            query = query.eq("interviewer_id", current_user.id)
            
        if status:
            query = query.eq("status", status)
            
        query = query.order("date", desc=True).order("time", desc=True)
        query = query.range((page - 1) * page_size, page * page_size - 1)
        
        resp = query.execute()
        return [_parse_interview_row(r) for r in (resp.data or [])]
        
    def get_interview(self, interview_id: str, current_user):
        resp = supabase.table("interviews").select("*, applications(*), users!interviews_interviewer_id_fkey(user_id, email, role)").eq("interview_id", interview_id).single().execute()
        if not resp.data:
            raise ValueError("Interview not found.")
            
        intv = _parse_interview_row(resp.data)
        if current_user.role == "interviewer" and str(intv["interviewer_id"]) != str(current_user.id):
            raise ValueError("Forbidden.")
            
        pos_id = intv["applications"].get("position_id")
        if pos_id:
            job_resp = supabase.table("job_requirements").select("share_prior_round_feedback, position_title, department").eq("position_id", pos_id).single().execute()
            intv["position_title"] = job_resp.data.get("position_title", "Unknown") if job_resp.data else "Unknown"
            intv["department"] = job_resp.data.get("department", "Unknown") if job_resp.data else "Unknown"
            share_feedback = job_resp.data.get("share_prior_round_feedback", False) if job_resp.data else False
        else:
            intv["position_title"] = intv["applications"].get("position", "Internship")
            intv["department"] = intv["applications"].get("department", "General")
            share_feedback = False
        
        # Get historical rounds
        hist_resp = supabase.table("interviews").select("*, users!interviews_interviewer_id_fkey(user_id, email, role)").eq("application_id", intv["application_id"]).order("round_number", desc=False).execute()
        
        history = []
        for h in hist_resp.data or []:
            eval_resp = supabase.table("interview_evaluations").select("*").eq("interview_id", h["interview_id"]).execute()
            h_eval = eval_resp.data[0] if eval_resp.data else None
            
            if current_user.role == "interviewer" and not share_feedback and h["interview_id"] != interview_id:
                if h_eval:
                    h_eval = {"decision": "Hidden", "overall_score": "Hidden", "notes": "Hidden"}
                    
            h["evaluation"] = h_eval
            history.append(_parse_interview_row(h))
            
        intv["history"] = history
        return intv
        
    def mark_attendance(self, interview_id: str, req: AttendanceRequest, current_user):
        resp = supabase.table("interviews").select("*").eq("interview_id", interview_id).single().execute()
        if not resp.data:
            raise ValueError("Not found.")
            
        intv = resp.data
        if current_user.role == "interviewer" and str(intv["interviewer_id"]) != str(current_user.id):
            raise ValueError("Forbidden.")
            
        supabase.table("interviews").update({"attendance": req.attendance}).eq("interview_id", interview_id).execute()
        
        supabase.table("audit_logs").insert({
            "action": "INTERVIEW_ATTENDANCE_UPDATED",
            "application_id": intv["application_id"],
            "metadata": {"interview_id": interview_id, "attendance": req.attendance}
        }).execute()
        return {"success": True}

    def evaluate_interview(self, interview_id: str, req: EvaluationRequest, current_user):
        resp = supabase.table("interviews").select("*").eq("interview_id", interview_id).single().execute()
        if not resp.data:
            raise ValueError("Not found.")
            
        intv = resp.data
        if current_user.role == "interviewer" and str(intv["interviewer_id"]) != str(current_user.id):
            raise ValueError("Forbidden.")
            
        eval_check = supabase.table("interview_evaluations").select("evaluation_id").eq("interview_id", interview_id).execute()
        if eval_check.data:
            raise ValueError("Evaluation already submitted.")
            
        overall = (req.technical + req.communication + req.problem_solving + req.project_knowledge + req.confidence) / 5.0
        
        supabase.table("interview_evaluations").insert({
            "interview_id": interview_id,
            "technical": req.technical,
            "communication": req.communication,
            "problem_solving": req.problem_solving,
            "project_knowledge": req.project_knowledge,
            "confidence": req.confidence,
            "overall_score": overall,
            "notes": req.notes,
            "decision": req.decision,
            "decided_by": str(current_user.id),
            "decided_at": datetime.utcnow().isoformat()
        }).execute()
        
        supabase.table("interviews").update({"status": "completed"}).eq("interview_id", interview_id).execute()
        
        if req.decision == "rejected":
            supabase.table("applications").update({"current_status": "interview_rejected"}).eq("application_id", intv["application_id"]).execute()
        elif req.decision == "selected":
            supabase.table("applications").update({"current_status": "interview_selected"}).eq("application_id", intv["application_id"]).execute()
            
        supabase.table("audit_logs").insert({
            "action": "INTERVIEW_EVALUATION_SUBMITTED",
            "application_id": intv["application_id"],
            "metadata": {"interview_id": interview_id, "decision": req.decision, "overall": overall}
        }).execute()
        return {"success": True}
        
    def reschedule(self, interview_id: str, req: RescheduleRequest, current_user):
        resp = supabase.table("interviews").select("*, applications(candidate_name, email, position)").eq("interview_id", interview_id).single().execute()
        if not resp.data:
            raise ValueError("Not found.")
            
        intv = _parse_interview_row(resp.data)
        if req.mode == "offline" and not req.location:
            raise ValueError("Offline requires location")

        duration = req.duration_minutes or intv.get("duration_minutes") or 45
        tz = req.timezone_str or "UTC"
        start_dt = datetime.combine(req.date, req.time)
        end_dt = start_dt + timedelta(minutes=duration)
        start_iso = start_dt.isoformat()
        end_iso = end_dt.isoformat()

        cal_provider_name = req.calendar_provider or intv.get("calendar_provider") or "google"
        provider = get_calendar_provider(cal_provider_name)
        event_id = intv.get("calendar_event_id")

        cal_synced = True
        cal_error = None

        if event_id:
            try:
                provider.update_interview_event(
                    event_id=event_id,
                    start_datetime_iso=start_iso,
                    end_datetime_iso=end_iso,
                    timezone_str=tz,
                    location=req.location,
                    connected_by=str(current_user.id)
                )
            except Exception as e:
                logger.error(f"Failed to update external calendar event on reschedule: {e}")
                cal_synced = False
                cal_error = str(e)[:255]
            
        update_data = {
            "date": str(req.date),
            "time": str(req.time),
            "interviewer_id": req.interviewer_id,
            "mode": req.mode,
            "location": req.location,
            "meeting_link": req.meeting_link or intv.get("meeting_link"),
            "notes": f"provider:{cal_provider_name}|sync:{'synced' if cal_synced else 'failed'}|duration:{duration}",
            "reschedule_requested": False,
            "reschedule_request_reason": None,
            "reschedule_requested_at": None,
            "reschedule_requested_by": None
        }

        supabase.table("interviews").update(update_data).eq("interview_id", interview_id).execute()
        
        # Dispatch notification via Gmail API
        app_data = intv.get("applications") or {}
        self._send_interview_notification(
            interview_id=interview_id,
            candidate_name=app_data.get("candidate_name", "Candidate"),
            candidate_email=app_data.get("email"),
            interviewer_name="Assigned Interviewer",
            interviewer_email=None,
            pos_title=app_data.get("position", "Internship Position"),
            round_num=intv.get("round_number", 1),
            date_str=str(req.date),
            time_str=str(req.time),
            mode=req.mode,
            meeting_link=update_data["meeting_link"],
            location=req.location,
            action_type="rescheduled",
            hr_user_id=str(current_user.id)
        )

        sync_status_val = "synced" if cal_synced else "failed"

        supabase.table("audit_logs").insert({
            "action": "INTERVIEW_RESCHEDULED",
            "application_id": intv["application_id"],
            "hr_user": str(current_user.id),
            "metadata": {"interview_id": interview_id, "reason": req.reason, "calendar_sync_status": sync_status_val}
        }).execute()

        try:
            supabase.table("audit_logs").insert({
                "action": "INTERVIEW_CALENDAR_UPDATED" if cal_synced else "INTERVIEW_CALENDAR_SYNC_FAILED",
                "application_id": intv["application_id"],
                "hr_user": str(current_user.id),
                "metadata": {"interview_id": interview_id, "calendar_event_id": event_id, "error": cal_error}
            }).execute()
        except Exception:
            pass

        return {"success": True, "calendar_sync_status": sync_status_val}

    def flag_reschedule(self, interview_id: str, req: FlagRescheduleRequest, current_user):
        resp = supabase.table("interviews").select("*").eq("interview_id", interview_id).single().execute()
        if not resp.data:
            raise ValueError("Not found.")
            
        if current_user.role == "interviewer" and str(resp.data["interviewer_id"]) != str(current_user.id):
            raise ValueError("Forbidden.")
            
        supabase.table("interviews").update({
            "reschedule_requested": True,
            "reschedule_request_reason": req.reason,
            "reschedule_requested_at": datetime.utcnow().isoformat(),
            "reschedule_requested_by": str(current_user.id)
        }).eq("interview_id", interview_id).execute()
        
        supabase.table("audit_logs").insert({
            "action": "INTERVIEW_RESCHEDULE_REQUESTED",
            "application_id": resp.data["application_id"],
            "metadata": {"interview_id": interview_id, "reason": req.reason}
        }).execute()
        return {"success": True}
        
    def cancel(self, interview_id: str, reason: str, hr_id: str):
        resp = supabase.table("interviews").select("*, applications(candidate_name, email, position)").eq("interview_id", interview_id).single().execute()
        if not resp.data:
            raise ValueError("Not found.")
            
        intv = _parse_interview_row(resp.data)
        event_id = intv.get("calendar_event_id")
        cal_provider_name = intv.get("calendar_provider") or "google"

        # Cancel external calendar event
        if event_id:
            try:
                provider = get_calendar_provider(cal_provider_name)
                provider.cancel_interview_event(event_id=event_id, reason=reason, connected_by=hr_id)
            except Exception as e:
                logger.warning(f"External calendar cancellation deferred: {e}")

        supabase.table("interviews").update({
            "status": "cancelled",
            "notes": f"provider:{cal_provider_name}|sync:cancelled|duration:{intv.get('duration_minutes', 45)}"
        }).eq("interview_id", interview_id).execute()
        
        # Dispatch cancellation email via Gmail API
        app_data = intv.get("applications") or {}
        self._send_interview_notification(
            interview_id=interview_id,
            candidate_name=app_data.get("candidate_name", "Candidate"),
            candidate_email=app_data.get("email"),
            interviewer_name="Assigned Interviewer",
            interviewer_email=None,
            pos_title=app_data.get("position", "Internship Position"),
            round_num=intv.get("round_number", 1),
            date_str=str(intv.get("date")),
            time_str=str(intv.get("time")),
            mode=intv.get("mode", "online"),
            meeting_link=None,
            location=None,
            action_type="cancelled",
            hr_user_id=hr_id
        )

        supabase.table("audit_logs").insert({
            "action": "INTERVIEW_CANCELLED",
            "application_id": intv["application_id"],
            "hr_user": hr_id,
            "metadata": {"interview_id": interview_id, "reason": reason}
        }).execute()

        try:
            supabase.table("audit_logs").insert({
                "action": "INTERVIEW_CALENDAR_CANCELLED",
                "application_id": intv["application_id"],
                "hr_user": hr_id,
                "metadata": {"interview_id": interview_id, "calendar_event_id": event_id}
            }).execute()
        except Exception:
            pass

        return {"success": True}

    def retry_calendar_sync(self, interview_id: str, hr_id: str):
        """Retries synchronizing an interview with its selected calendar provider."""
        resp = supabase.table("interviews").select("*, applications(candidate_name, email, position), users!interviews_interviewer_id_fkey(user_id, email, role)").eq("interview_id", interview_id).single().execute()
        if not resp.data:
            raise ValueError("Interview not found.")

        intv = _parse_interview_row(resp.data)
        cal_provider_name = intv.get("calendar_provider") or "google"
        provider = get_calendar_provider(cal_provider_name)

        app_data = intv.get("applications") or {}
        candidate_name = app_data.get("candidate_name", "Candidate")
        candidate_email = app_data.get("email")
        pos_title = app_data.get("position", "Position")

        interviewer = intv.get("users") or {}
        interviewer_name = interviewer.get("email", "").split("@")[0].capitalize() or "Interviewer"
        interviewer_email = interviewer.get("email")

        duration = intv.get("duration_minutes") or 45
        time_clean = str(intv['time'])[:8]
        start_dt = datetime.strptime(f"{intv['date']}T{time_clean}", "%Y-%m-%dT%H:%M:%S")
        end_dt = start_dt + timedelta(minutes=duration)

        attendees = []
        if candidate_email:
            attendees.append({"email": candidate_email, "name": candidate_name})
        if interviewer_email:
            attendees.append({"email": interviewer_email, "name": interviewer_name})

        event_title = f"Interview — {pos_title}"
        event_desc = (
            f"Candidate: {candidate_name}\n"
            f"Position: {pos_title}\n"
            f"Round: Round {intv.get('round_number')} ({intv.get('type')})\n"
            f"Mode: {intv.get('mode', '').capitalize()}\n"
            f"Interviewer: {interviewer_name}\n"
            f"HR Contact: HR Recruitment Team"
        )

        cal_res = provider.create_interview_event(
            title=event_title,
            description=event_desc,
            start_datetime_iso=start_dt.isoformat(),
            end_datetime_iso=end_dt.isoformat(),
            timezone_str="UTC",
            attendees=attendees,
            location=intv.get("location"),
            create_online_meeting=(intv.get("mode") == "online"),
            connected_by=hr_id
        )

        update_data = {
            "calendar_event_id": cal_res.event_id,
            "notes": f"provider:{cal_provider_name}|sync:synced|duration:{duration}"
        }
        if intv.get("mode") == "online" and cal_res.meeting_link:
            update_data["meeting_link"] = cal_res.meeting_link

        supabase.table("interviews").update(update_data).eq("interview_id", interview_id).execute()

        try:
            supabase.table("audit_logs").insert({
                "action": "INTERVIEW_CALENDAR_CREATED",
                "application_id": intv["application_id"],
                "hr_user": hr_id,
                "metadata": {"interview_id": interview_id, "calendar_event_id": cal_res.event_id, "retried": True}
            }).execute()
        except Exception:
            pass

        return {"success": True, "calendar_sync_status": "synced", "meeting_link": update_data.get("meeting_link")}

    def _send_interview_notification(
        self,
        interview_id: str,
        candidate_name: str,
        candidate_email: Optional[str],
        interviewer_name: str,
        interviewer_email: Optional[str],
        pos_title: str,
        round_num: int,
        date_str: str,
        time_str: str,
        mode: str,
        meeting_link: Optional[str],
        location: Optional[str],
        action_type: str,
        hr_user_id: str
    ):
        """Sends clean recruitment notification emails using Gmail API."""
        if not candidate_email:
            return

        subject_prefix = {
            "scheduled": f"Interview Scheduled: Round {round_num} – {pos_title}",
            "rescheduled": f"Interview Rescheduled: Round {round_num} – {pos_title}",
            "cancelled": f"Interview Cancelled: Round {round_num} – {pos_title}"
        }.get(action_type, f"Interview Update – {pos_title}")

        details_text = f"Date: {date_str}\nTime: {time_str}\nMode: {mode.capitalize()}"
        if mode == "online" and meeting_link:
            details_text += f"\nMeeting Link: {meeting_link}"
        elif mode == "offline" and location:
            details_text += f"\nLocation: {location}"

        if action_type == "cancelled":
            body_text = (
                f"Dear {candidate_name},\n\n"
                f"Please be advised that your Round {round_num} interview for the {pos_title} position has been cancelled.\n\n"
                f"Our HR team will reach out regarding next steps.\n\n"
                f"Regards,\nHR Recruitment Team"
            )
        else:
            body_text = (
                f"Dear {candidate_name},\n\n"
                f"Your Round {round_num} interview for the {pos_title} position has been {action_type}.\n\n"
                f"{details_text}\n\n"
                f"Please be ready 5 minutes prior to the scheduled start time.\n\n"
                f"Regards,\nHR Recruitment Team"
            )

        body_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6;">
            <h2 style="color: #4F46E5;">{subject_prefix}</h2>
            <p>Dear <strong>{candidate_name}</strong>,</p>
            <p>Your Round {round_num} interview for <strong>{pos_title}</strong> has been {action_type}.</p>
            <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 4px 0;"><strong>Date:</strong> {date_str}</p>
                <p style="margin: 4px 0;"><strong>Time:</strong> {time_str}</p>
                <p style="margin: 4px 0;"><strong>Mode:</strong> {mode.capitalize()}</p>
                {"<p style='margin: 4px 0;'><strong>Meeting Link:</strong> <a href='" + meeting_link + "'>" + meeting_link + "</a></p>" if mode == "online" and meeting_link else ""}
                {"<p style='margin: 4px 0;'><strong>Location:</strong> " + location + "</p>" if mode == "offline" and location else ""}
            </div>
            <p>Regards,<br><strong>HR Recruitment Team</strong></p>
        </div>
        """

        try:
            res = gmail_service.send_email(
                to_email=candidate_email,
                subject=subject_prefix,
                text_body=body_text,
                html_body=body_html,
                connected_by=hr_user_id
            )
            # Log in email_logs
            supabase.table("email_logs").insert({
                "recipient": candidate_email,
                "subject": subject_prefix,
                "status": "sent",
                "sent_at": datetime.utcnow().isoformat(),
                "provider": res.get("provider"),
                "provider_message_id": res.get("message_id")
            }).execute()

            supabase.table("audit_logs").insert({
                "action": "GMAIL_EMAIL_SENT",
                "hr_user": hr_user_id,
                "metadata": {"recipient": candidate_email, "interview_id": interview_id, "type": action_type}
            }).execute()
        except Exception as e:
            logger.error(f"Failed to send interview notification to {candidate_email}: {e}")
            try:
                supabase.table("email_logs").insert({
                    "recipient": candidate_email,
                    "subject": subject_prefix,
                    "status": "failed",
                    "error": str(e)[:255],
                    "sent_at": datetime.utcnow().isoformat()
                }).execute()

                supabase.table("audit_logs").insert({
                    "action": "GMAIL_EMAIL_FAILED",
                    "hr_user": hr_user_id,
                    "metadata": {"recipient": candidate_email, "error": str(e)}
                }).execute()
            except Exception:
                pass
