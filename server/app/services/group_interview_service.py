import os
import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from pydantic import BaseModel

from app.services.supabase_client import supabase
from app.services.integrations.calendar_service import get_calendar_provider
from app.services.email.email_service import EmailService

logger = logging.getLogger(__name__)

class CreateBatchRequest(BaseModel):
    department: str
    position: str
    candidate_application_ids: List[str]
    interviewer_id: str
    interview_date: str  # YYYY-MM-DD
    start_time: str      # HH:MM
    duration_minutes: int
    round_number: int = 1
    mode: str = "online"
    calendar_provider: str = "google"
    timezone: str = "UTC"

class GroupInterviewService:
    def __init__(self):
        self.email_service = EmailService.get_provider()

    def get_eligible_candidates(self, department: Optional[str] = None, position: Optional[str] = None) -> List[Dict[str, Any]]:
        query = supabase.table("applications").select("*").eq("current_status", "human_interview_ready")
        if department:
            query = query.eq("department", department)
        if position:
            query = query.eq("position", position)
        
        res = query.execute()
        return res.data

    def create_batch(self, req: CreateBatchRequest, created_by: str) -> Dict[str, Any]:
        if not req.candidate_application_ids:
            raise Exception("No candidates selected for the batch.")

        # Calculate datetimes
        from datetime import datetime, timedelta
        start_dt = datetime.strptime(f"{req.interview_date} {req.start_time}", "%Y-%m-%d %H:%M")
        end_dt = start_dt + timedelta(minutes=req.duration_minutes)
        start_iso = start_dt.isoformat() + "Z"
        end_iso = end_dt.isoformat() + "Z"

        # Create Calendar Event
        # We only add the interviewer and HR as attendees, candidates will receive email later
        interviewer_email = None
        if req.interviewer_id:
            user_res = supabase.table("users").select("email").eq("user_id", req.interviewer_id).execute()
            if user_res.data:
                interviewer_email = user_res.data[0]["email"]

        attendees = []
        if interviewer_email:
            attendees.append({"email": interviewer_email})

        calendar_provider = get_calendar_provider(req.calendar_provider)
        cal_result = calendar_provider.create_interview_event(
            title=f"Group Interview - {req.position} ({req.department})",
            description="Group Human Interview Session",
            start_datetime_iso=start_iso,
            end_datetime_iso=end_iso,
            timezone_str=req.timezone,
            attendees=attendees,
            create_online_meeting=True if req.mode == 'online' else False,
            connected_by=created_by
        )

        batch_id = str(uuid.uuid4())
        
        # Insert Batch
        supabase.table("interview_batches").insert({
            "batch_id": batch_id,
            "department": req.department,
            "position": req.position,
            "interviewer_id": req.interviewer_id,
            "round_number": req.round_number,
            "scheduled_start": start_iso,
            "scheduled_end": end_iso,
            "timezone": req.timezone,
            "mode": req.mode,
            "calendar_provider": req.calendar_provider,
            "calendar_event_id": cal_result.event_id,
            "meeting_link": cal_result.meeting_link,
            "calendar_sync_status": cal_result.status,
            "status": "scheduled",
            "created_by": created_by
        }).execute()

        # Insert Candidates and update application status
        for app_id in req.candidate_application_ids:
            supabase.table("interview_batch_candidates").insert({
                "batch_id": batch_id,
                "application_id": app_id,
                "invitation_status": "pending",
                "attendance_status": "pending",
                "evaluation_status": "pending"
            }).execute()
            supabase.table("applications").update({"current_status": "interview_scheduled"}).eq("application_id", app_id).execute()

        # Log Audit
        supabase.table("audit_logs").insert({
            "user_id": created_by,
            "action": "GROUP_INTERVIEW_BATCH_CREATED",
            "entity_type": "interview_batch",
            "entity_id": batch_id,
            "details": f"Created batch for {len(req.candidate_application_ids)} candidates."
        }).execute()

        return {"batch_id": batch_id, "meeting_link": cal_result.meeting_link, "calendar_event_id": cal_result.event_id}

    def send_invitations(self, batch_id: str, admin_user_id: str) -> Dict[str, Any]:
        batch_res = supabase.table("interview_batches").select("*").eq("batch_id", batch_id).execute()
        if not batch_res.data:
            raise Exception("Batch not found")
        batch = batch_res.data[0]

        candidates_res = supabase.table("interview_batch_candidates").select("*, applications(*)").eq("batch_id", batch_id).execute()
        candidates = candidates_res.data

        requested = len(candidates)
        sent = 0
        failed = 0

        # Create basic datetime representation
        dt_start = batch['scheduled_start']

        for c in candidates:
            if c["invitation_status"] == "sent":
                # Idempotency
                continue
                
            app = c["applications"]
            candidate_name = f"{app.get('first_name','')} {app.get('last_name','')}".strip()
            if not candidate_name:
                candidate_name = "Candidate"
            
            subject = f"Group Human Interview Invitation — {batch['position']}"
            html_body = f"""
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <p>Dear {candidate_name},</p>
                <p>Congratulations! You have been selected to proceed to the Human Interview stage for the {batch['position']} position.</p>
                <p>This interview will be conducted as a group interview.</p>
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #4f46e5;">Interview Details</h3>
                    <ul style="list-style: none; padding-left: 0;">
                        <li><strong>Department:</strong> {batch['department']}</li>
                        <li><strong>Position:</strong> {batch['position']}</li>
                        <li><strong>Scheduled Time:</strong> {dt_start} ({batch['timezone']})</li>
                        <li><strong>Mode:</strong> Online — Group Interview</li>
                    </ul>
                </div>
                <p>Please join the meeting a few minutes before the scheduled time.</p>
                <div style="margin: 30px 0;">
                    <a href="{batch['meeting_link']}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Join Google Meet</a>
                </div>
                <p style="font-size: 12px; color: #6b7280;">Meeting URL: {batch['meeting_link']}</p>
                <p>Regards,<br>HR Department</p>
            </div>
            """

            try:
                success = self.email_service.send_email(
                    to_email=app["email"],
                    subject=subject,
                    html_body=html_body
                )
                if success:
                    supabase.table("interview_batch_candidates").update({"invitation_status": "sent"}).eq("id", c["id"]).execute()
                    sent += 1
                else:
                    supabase.table("interview_batch_candidates").update({"invitation_status": "email_failed"}).eq("id", c["id"]).execute()
                    failed += 1
            except Exception as e:
                logger.error(f"Failed to send email to {app['email']}: {e}")
                supabase.table("interview_batch_candidates").update({"invitation_status": "email_failed"}).eq("id", c["id"]).execute()
                failed += 1

        # Audit
        supabase.table("audit_logs").insert({
            "user_id": admin_user_id,
            "action": "GROUP_INTERVIEW_INVITATIONS_SENT",
            "entity_type": "interview_batch",
            "entity_id": batch_id,
            "details": f"Requested: {requested}, Sent: {sent}, Failed: {failed}"
        }).execute()

        # Update batch status if needed
        supabase.table("interview_batches").update({"status": "invited"}).eq("batch_id", batch_id).execute()

        return {"requested": requested, "sent": sent, "failed": failed}

    def get_batches(self) -> List[Dict[str, Any]]:
        res = supabase.table("interview_batches").select("*, users(first_name, last_name, email)").order("created_at", desc=True).execute()
        batches = res.data
        # get candidate counts
        for b in batches:
            c_res = supabase.table("interview_batch_candidates").select("id", count="exact").eq("batch_id", b["batch_id"]).execute()
            b["candidate_count"] = c_res.count
        return batches
        
    def get_batch(self, batch_id: str) -> Dict[str, Any]:
        b_res = supabase.table("interview_batches").select("*, users(first_name, last_name, email)").eq("batch_id", batch_id).execute()
        if not b_res.data:
            return None
        batch = b_res.data[0]
        
        c_res = supabase.table("interview_batch_candidates").select("*, applications(*)").eq("batch_id", batch_id).execute()
        batch["candidates"] = c_res.data
        return batch

    def update_attendance(self, batch_id: str, application_id: str, status: str) -> bool:
        supabase.table("interview_batch_candidates").update({
            "attendance_status": status
        }).eq("batch_id", batch_id).eq("application_id", application_id).execute()
        return True

    def evaluate_candidate(self, batch_id: str, application_id: str, eval_data: Dict[str, Any], evaluator_id: str) -> bool:
        # Save evaluation to interview_evaluations
        # First we need a dummy "interview_id" since the evaluation table expects it. 
        # Alternatively we can adapt interview_evaluations to support batch_id or create a new table.
        # But we can just create an individual interview record to satisfy existing final_selection logic.
        
        # Check if an individual interview record exists for this batch+app
        # We will create one behind the scenes to bridge the gap with the legacy individual flow
        intv_res = supabase.table("interviews").select("interview_id").eq("application_id", application_id).eq("round_number", eval_data.get("round_number", 1)).execute()
        
        if intv_res.data:
            interview_id = intv_res.data[0]["interview_id"]
        else:
            # Create a shell interview record
            batch_res = supabase.table("interview_batches").select("*").eq("batch_id", batch_id).execute()
            b = batch_res.data[0]
            new_intv = supabase.table("interviews").insert({
                "application_id": application_id,
                "round_number": b["round_number"],
                "status": "completed",
                "attendance": "attended",
                "interviewer_id": evaluator_id,
                "type": "Group",
                "mode": b["mode"],
                "meeting_link": b["meeting_link"]
            }).execute()
            interview_id = new_intv.data[0]["interview_id"]
            
        supabase.table("interviews").update({"status": "completed"}).eq("interview_id", interview_id).execute()
        
        # Insert evaluation
        supabase.table("interview_evaluations").insert({
            "interview_id": interview_id,
            "technical_score": eval_data.get("technical_score", 0),
            "cultural_score": eval_data.get("problem_solving_score", 0),
            "overall_score": eval_data.get("overall_rating", 0),
            "feedback": eval_data.get("feedback", ""),
            "decision": eval_data.get("decision", "pending"),
            "decided_by": evaluator_id
        }).execute()
        
        supabase.table("interview_batch_candidates").update({
            "evaluation_status": "evaluated"
        }).eq("batch_id", batch_id).eq("application_id", application_id).execute()

        # Update application status
        decision = eval_data.get("decision", "")
        if decision.lower() == "select":
            supabase.table("applications").update({"current_status": "interview_selected"}).eq("application_id", application_id).execute()
        elif decision.lower() == "reject":
            supabase.table("applications").update({"current_status": "interview_rejected"}).eq("application_id", application_id).execute()
        
        return True
