import os
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import logging

from app.services.supabase_client import supabase
from app.services.pdf_service import PDFService
from app.services.integrations.gmail_service import gmail_service
from app.schemas.offer import OfferGenerateRequest, OfferPreviewRequest, OfferResponseRequest

from app.services.offer_event_service import (
    OfferEventService,
    OFFER_GENERATED,
    OFFER_SENT,
    OFFER_VIEWED,
    OFFER_PDF_ACCESSED,
    OFFER_DISCUSSION_REQUESTED,
    OFFER_ACCEPTED,
    OFFER_DECLINED,
    OFFER_EXPIRED,
    OFFER_REMINDER_SENT,
    OFFER_EXPIRY_EXTENDED,
    OFFER_CANCELLED
)

logger = logging.getLogger(__name__)

class OfferService:

    @staticmethod
    def _verify_final_selected(application_id: str):
        app_res = supabase.table("applications").select("current_status").eq("application_id", application_id).single().execute()
        if not app_res.data:
            raise ValueError("Application not found")
        if app_res.data["current_status"] != "final_selected":
            raise ValueError(f"Candidate is not eligible for offer. Current status is {app_res.data['current_status']}")

    @staticmethod
    def _get_template(template_id: Optional[str] = None):
        res_data = None
        try:
            if template_id:
                res = supabase.table("offer_templates").select("*").eq("template_id", template_id).single().execute()
                res_data = res.data
            else:
                res = supabase.table("offer_templates").select("*").eq("is_active", True).limit(1).execute()
                if res.data:
                    res_data = res.data[0]
        except Exception as e:
            logger.warning(f"Could not retrieve offer template from Supabase ({e}). Using local fallback template.")
        
        if not res_data:
            local_path = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "templates", "offer_template.html"))
            if os.path.exists(local_path):
                with open(local_path, "r", encoding="utf-8") as f:
                    content = f.read()
                return {
                    "template_id": "default-fallback",
                    "name": "RGT Vertex Internship Offer Letter",
                    "html_body": content,
                    "version": 1
                }
            raise ValueError("No active offer template found")
        return res_data

    @staticmethod
    def _build_template_vars(req) -> dict:
        joining_raw = req.joining_date
        joining_str = joining_raw.strftime("%Y-%m-%d") if hasattr(joining_raw, "strftime") else str(joining_raw or "")
        
        end_raw = req.end_date
        end_str = end_raw.strftime("%Y-%m-%d") if (end_raw and hasattr(end_raw, "strftime")) else str(end_raw or "")
        
        expiry_val = getattr(req, "expiry_at", None) or getattr(req, "offer_expiry_date", None)
        expiry_str = expiry_val.strftime("%Y-%m-%d") if (expiry_val and hasattr(expiry_val, "strftime")) else str(expiry_val or "")
        
        stipend_raw = str(getattr(req, "stipend", "") or "").strip()
        is_unpaid = not stipend_raw or stipend_raw.lower() in ["unpaid", "0", "none", "na", "n/a"]
        compensation_type = "unpaid" if is_unpaid else "paid"
        compensation_val = "Unpaid Internship" if is_unpaid else stipend_raw
        
        work_mode = getattr(req, "work_mode", None) or "Remote"
        cand_name = getattr(req, "candidate_name", None) or "Candidate"
        designation = getattr(req, "designation", None) or "Software Engineer"
        department = getattr(req, "department", None) or "Engineering"
        
        return {
            "candidate_name": cand_name,
            "candidateName": cand_name,
            "designation": designation,
            "department": department,
            "joining_date": joining_str,
            "startDate": joining_str,
            "end_date": end_str,
            "endDate": end_str,
            "duration": getattr(req, "duration", "") or "",
            "stipend": stipend_raw or "Unpaid",
            "compensation": compensation_val,
            "compensationType": compensation_type,
            "compensation_type": compensation_type,
            "work_mode": work_mode,
            "mode": work_mode,
            "location": getattr(req, "location", "") or "",
            "offer_expiry_date": expiry_str,
            "validUntil": expiry_str
        }

    @staticmethod
    async def preview_offer(req: OfferPreviewRequest) -> bytes:
        template_data = OfferService._get_template(req.template_id)
        template_vars = OfferService._build_template_vars(req)
        
        template_html = template_data.get("html_body") or template_data.get("html_template")
        if not template_html:
            raise ValueError("Offer template has no HTML content")
            
        html = PDFService.render_html(template_html, template_vars)
        pdf_bytes = await PDFService.generate_pdf(html)
        return pdf_bytes

    @staticmethod
    async def generate_offer(req: OfferGenerateRequest, admin_user_id: str) -> dict:
        OfferService._verify_final_selected(req.application_id)
        template_data = OfferService._get_template(req.template_id)
        template_vars = OfferService._build_template_vars(req)
        
        template_html = template_data.get("html_body") or template_data.get("html_template")
        if not template_html:
            raise ValueError("Offer template has no HTML content")
            
        html = PDFService.render_html(template_html, template_vars)
        pdf_bytes = await PDFService.generate_pdf(html)
        
        storage_path = await PDFService.upload_pdf_to_storage(pdf_bytes, req.candidate_name or "Candidate", req.application_id)
        
        joining_iso = req.joining_date.isoformat() if hasattr(req.joining_date, "isoformat") else str(req.joining_date or "")
        end_iso = req.end_date.isoformat() if (req.end_date and hasattr(req.end_date, "isoformat")) else (str(req.end_date) if req.end_date else None)
        expiry_val = getattr(req, "expiry_at", None) or getattr(req, "offer_expiry_date", None)
        expiry_iso = expiry_val.isoformat() if (expiry_val and hasattr(expiry_val, "isoformat")) else (str(expiry_val) if expiry_val else None)
        
        offer_data = {
            "application_id": req.application_id,
            "template_id": template_data["template_id"],
            "template_version": template_data.get("version") or template_data.get("template_version", 1),
            "email": req.candidate_email,
            "designation": req.designation,
            "department": req.department or "",
            "joining_date": joining_iso,
            "end_date": end_iso,
            "duration": req.duration or "",
            "stipend": str(req.stipend or ""),
            "offer_issue_date": datetime.now(timezone.utc).date().isoformat(),
            "offer_expiry_date": expiry_iso,
            "pdf_url": storage_path,
            "offer_status": "generated",
            "email_status": "pending",
            "generated_by": admin_user_id
        }
        
        res = supabase.table("offers").insert(offer_data).execute()
        offer = res.data[0]
        offer_id = offer["offer_id"]
        
        try:
            supabase.table("audit_logs").insert({
                "action": "OFFER_GENERATED",
                "entity_type": "offer",
                "entity_id": offer_id,
                "user_id": admin_user_id,
                "details": {"application_id": req.application_id, "designation": req.designation}
            }).execute()
        except Exception as ae:
            logger.warning(f"Audit log failed: {ae}")

        OfferEventService.emit(offer_id, OFFER_GENERATED, actor_type="hr_admin", actor_id=admin_user_id)
        
        return offer

    @staticmethod
    async def send_offer_email(offer_id: str, admin_user_id: str):
        offer_res = supabase.table("offers").select("*, applications(candidate_name, email)").eq("offer_id", offer_id).single().execute()
        if not offer_res.data:
            raise ValueError("Offer not found")
            
        offer = offer_res.data
        status = offer.get("offer_status") or offer.get("status")
        if status not in ["generated", "failed", "pending"]:
            raise ValueError(f"Cannot send offer with status {status}")
            
        pdf_path = offer.get("pdf_url") or offer.get("pdf_storage_path")
        pdf_bytes = await PDFService.download_pdf_from_storage(pdf_path)
        
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        try:
            expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
            supabase.table("candidate_access_tokens").insert({
                "application_id": offer["application_id"],
                "stage": "offer",
                "token_hash": token_hash,
                "expires_at": expires_at
            }).execute()
        except Exception as te:
            logger.warning(f"Candidate access token insert warning: {te}")
        
        cand_name = (offer.get("applications") or {}).get("candidate_name") or "Candidate"
        cand_email = offer.get("email") or (offer.get("applications") or {}).get("email")
        position = offer.get("designation") or "Intern"
        expiry = str(offer.get("offer_expiry_date") or offer.get("expiry_at") or "within 3 days")
        
        client_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        response_link = f"{client_url}/offer-response/{token}"
        
        subject = f"Internship Offer — {position}"
        body_text = f"""Dear {cand_name},

Congratulations!
We are pleased to offer you the position of {position} with our organization.

Please find your official offer letter attached.
Kindly review the offer carefully and respond using the secure link below:

{response_link}

Offer Expiry Date:
{expiry}

Regards,
HR Department"""

        body_html = f"""<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <p>Dear <strong>{cand_name}</strong>,</p>
            <p>Congratulations!</p>
            <p>We are pleased to offer you the position of <strong>{position}</strong> with our organization.</p>
            <p>Please find your official offer letter attached.</p>
            <p>Kindly review the offer carefully and respond using the secure link below:</p>
            <p style="margin: 30px 0;">
                <a href="{response_link}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Respond to Offer</a>
            </p>
            <p>Or copy this link to your browser:<br><a href="{response_link}">{response_link}</a></p>
            <p><strong>Offer Expiry Date:</strong> {expiry}</p>
            <p>Regards,<br>HR Department</p>
        </div>"""

        try:
            attachment_filename = f"Offer_Letter_{cand_name.replace(' ', '_')}.pdf"
            email_res = gmail_service.send_email(
                to_email=cand_email,
                subject=subject,
                body_text=body_text,
                body_html=body_html,
                attachment_bytes=pdf_bytes,
                attachment_name=attachment_filename
            )
            
            message_id = email_res.get("message_id")
            thread_id = email_res.get("thread_id")
            
            supabase.table("offers").update({
                "offer_status": "sent",
                "email_status": "sent",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "gmail_message_id": message_id,
                "gmail_thread_id": thread_id
            }).eq("offer_id", offer_id).execute()
            
            try:
                supabase.table("email_logs").insert({
                    "application_id": offer["application_id"],
                    "recipient": cand_email,
                    "email_type": "OFFER_EMAIL",
                    "provider": "gmail",
                    "subject": subject,
                    "status": "sent",
                    "sent_at": datetime.now(timezone.utc).isoformat()
                }).execute()
            except Exception:
                pass
            
            try:
                supabase.table("audit_logs").insert({
                    "action": "OFFER_EMAIL_SENT",
                    "entity_type": "offer",
                    "entity_id": offer_id,
                    "user_id": admin_user_id,
                    "details": {"recipient": cand_email}
                }).execute()
            except Exception:
                pass

            OfferEventService.emit(offer_id, OFFER_SENT, actor_type="hr_admin", actor_id=admin_user_id)
            
        except Exception as e:
            supabase.table("offers").update({
                "email_status": "failed",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("offer_id", offer_id).execute()
            
            try:
                supabase.table("email_logs").insert({
                    "application_id": offer["application_id"],
                    "recipient": cand_email,
                    "email_type": "OFFER_EMAIL",
                    "provider": "gmail",
                    "subject": subject,
                    "status": "failed",
                    "safe_error": str(e)
                }).execute()
            except Exception:
                pass
            
            raise Exception(f"Failed to send email: {str(e)}")

    @staticmethod
    def _check_and_expire_offer(offer: dict) -> dict:
        """Helper to expire an offer if past deadline."""
        status = offer.get("offer_status") or offer.get("status")
        if status in ["accepted", "declined", "cancelled", "withdrawn", "expired"]:
            return offer
            
        expiry_str = offer.get("expiry_at") or offer.get("offer_expiry_date")
        if not expiry_str:
            return offer
            
        try:
            # Handle standard ISO formats, sometimes with or without Z
            if "T" not in str(expiry_str):
                expiry_str = f"{expiry_str}T23:59:59Z"
                
            expiry_dt = datetime.fromisoformat(str(expiry_str).replace("Z", "+00:00"))
            if expiry_dt.tzinfo is None:
                expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
                
            now = datetime.now(timezone.utc)
            if now > expiry_dt:
                supabase.table("offers").update({
                    "offer_status": "expired",
                    "updated_at": now.isoformat()
                }).eq("offer_id", offer["offer_id"]).execute()
                
                OfferEventService.emit(offer["offer_id"], OFFER_EXPIRED)
                offer["offer_status"] = "expired"
        except Exception as e:
            logger.warning(f"Error checking offer expiry for {offer.get('offer_id')}: {e}")
            
        return offer

    @staticmethod
    def get_offer_by_token(token: str) -> dict:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        token_res = supabase.table("candidate_access_tokens").select("*").eq("token_hash", token_hash).execute()
        if not token_res.data:
            raise ValueError("Invalid offer token")
        
        token_row = token_res.data[0]
        app_id = token_row["application_id"]
        
        offer_res = supabase.table("offers").select("*, applications(candidate_name, email)").eq("application_id", app_id).order("created_at", desc=True).limit(1).execute()
        if not offer_res.data:
            raise ValueError("Offer not found")
        
        offer = offer_res.data[0]
        return OfferService._check_and_expire_offer(offer)

    @staticmethod
    def track_offer_view(offer_id: str):
        now = datetime.now(timezone.utc).isoformat()
        try:
            # We get the current view_count and first_viewed_at atomically?
            # Easiest way in postgrest without RPC is just fetch then update if needed
            res = supabase.table("offers").select("first_viewed_at, view_count").eq("offer_id", offer_id).single().execute()
            if not res.data:
                return
                
            current_views = res.data.get("view_count") or 0
            first_view = res.data.get("first_viewed_at")
            
            update_data = {
                "last_viewed_at": now,
                "view_count": current_views + 1
            }
            
            if not first_view:
                update_data["first_viewed_at"] = now
                
            supabase.table("offers").update(update_data).eq("offer_id", offer_id).execute()
            
            if not first_view:
                OfferEventService.emit(offer_id, OFFER_VIEWED, actor_type="candidate")
                
            # If status is just sent, promote to viewed (but don't overwrite discussion_requested)
            offer = supabase.table("offers").select("offer_status").eq("offer_id", offer_id).single().execute()
            if offer.data and offer.data.get("offer_status") == "sent":
                supabase.table("offers").update({"offer_status": "viewed"}).eq("offer_id", offer_id).execute()
                
        except Exception as e:
            logger.warning(f"Error tracking offer view: {e}")

    @staticmethod
    def track_pdf_access(offer_id: str):
        now = datetime.now(timezone.utc).isoformat()
        try:
            res = supabase.table("offers").select("pdf_first_accessed_at, pdf_access_count").eq("offer_id", offer_id).single().execute()
            if not res.data:
                return
                
            current_access = res.data.get("pdf_access_count") or 0
            first_access = res.data.get("pdf_first_accessed_at")
            
            update_data = {
                "pdf_last_accessed_at": now,
                "pdf_access_count": current_access + 1
            }
            
            if not first_access:
                update_data["pdf_first_accessed_at"] = now
                
            supabase.table("offers").update(update_data).eq("offer_id", offer_id).execute()
            
            if not first_access:
                OfferEventService.emit(offer_id, OFFER_PDF_ACCESSED, actor_type="candidate")
                
        except Exception as e:
            logger.warning(f"Error tracking pdf access: {e}")

    @staticmethod
    def respond_to_offer(token: str, req: OfferResponseRequest) -> dict:
        offer = OfferService.get_offer_by_token(token)
        offer_id = offer["offer_id"]
        current_status = offer.get("offer_status") or offer.get("status")
        
        if current_status in ["accepted", "declined", "cancelled", "withdrawn"]:
            raise ValueError(f"Offer has already been {current_status}")
            
        if current_status == "expired":
            raise ValueError("This offer has expired")
            
        timestamp = datetime.now(timezone.utc).isoformat()
        update_data = {"updated_at": timestamp}
        
        decision = req.decision.lower()
        
        if decision == "discussion":
            update_data["offer_status"] = "discussion_requested"
            update_data["discussion_requested_at"] = timestamp
            if req.discussion_message:
                update_data["discussion_message"] = req.discussion_message
                
            res = supabase.table("offers").update(update_data).eq("offer_id", offer_id).execute()
            OfferEventService.emit(offer_id, OFFER_DISCUSSION_REQUESTED, actor_type="candidate", metadata={"message": req.discussion_message})
            return res.data[0]
            
        elif decision in ["accept", "decline"]:
            new_status = "accepted" if decision == "accept" else "declined"
            update_data["offer_status"] = new_status
            update_data["response_date"] = timestamp
            
            if new_status == "accepted":
                update_data["accepted_at"] = timestamp
            else:
                update_data["declined_at"] = timestamp
                
            app_status = "offer_accepted" if new_status == "accepted" else "offer_declined"
            
            # Update offer
            res = supabase.table("offers").update(update_data).eq("offer_id", offer_id).execute()
            
            # Update application status
            supabase.table("applications").update({"current_status": app_status}).eq("application_id", offer["application_id"]).execute()
            
            action = "OFFER_ACCEPTED" if new_status == "accepted" else "OFFER_DECLINED"
            try:
                supabase.table("audit_logs").insert({
                    "action": action,
                    "entity_type": "offer",
                    "entity_id": offer_id,
                    "details": {"reason": req.reason} if req.reason else {}
                }).execute()
            except Exception:
                pass
                
            event_type = OFFER_ACCEPTED if new_status == "accepted" else OFFER_DECLINED
            OfferEventService.emit(offer_id, event_type, actor_type="candidate", metadata={"reason": req.reason})
            
            return res.data[0]
            
        else:
            raise ValueError("Invalid decision")

    @staticmethod
    def extend_deadline(offer_id: str, new_expiry: datetime, admin_user_id: str) -> dict:
        offer_res = supabase.table("offers").select("*").eq("offer_id", offer_id).single().execute()
        if not offer_res.data:
            raise ValueError("Offer not found")
            
        offer = offer_res.data
        old_expiry = offer.get("expiry_at") or offer.get("offer_expiry_date")
        now_iso = datetime.now(timezone.utc).isoformat()
        
        update_data = {
            "offer_expiry_date": new_expiry.date().isoformat(),
            "old_expiry_at": old_expiry,
            "expiry_extended_by": admin_user_id,
            "expiry_extended_at": now_iso,
            "updated_at": now_iso
        }
        
        # If it was expired, we probably want to flip it back to sent/viewed depending on its state.
        # But for safety, let's keep it simple: if it's expired, flip it to viewed.
        if offer.get("offer_status") == "expired":
            update_data["offer_status"] = "viewed" if offer.get("first_viewed_at") else "sent"
            
        res = supabase.table("offers").update(update_data).eq("offer_id", offer_id).execute()
        
        OfferEventService.emit(
            offer_id, 
            OFFER_EXPIRY_EXTENDED, 
            actor_type="hr_admin", 
            actor_id=admin_user_id, 
            metadata={"old_expiry": old_expiry, "new_expiry": new_expiry.isoformat()}
        )
        
        return res.data[0]

    @staticmethod
    def send_reminder(offer_id: str, admin_user_id: str) -> dict:
        offer_res = supabase.table("offers").select("*, applications(candidate_name, email)").eq("offer_id", offer_id).single().execute()
        if not offer_res.data:
            raise ValueError("Offer not found")
            
        offer = offer_res.data
        status = offer.get("offer_status")
        if status in ["accepted", "declined", "expired", "cancelled", "withdrawn"]:
            raise ValueError(f"Cannot send reminder for an offer in {status} state")
            
        # Duplicate guard (1 per 24h)
        last_rem = offer.get("last_reminder_at")
        if last_rem:
            try:
                last_dt = datetime.fromisoformat(last_rem.replace("Z", "+00:00"))
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                if (datetime.now(timezone.utc) - last_dt).total_seconds() < 86400:
                    raise ValueError("A reminder was already sent in the last 24 hours.")
            except ValueError as ve:
                if "24 hours" in str(ve):
                    raise
            except Exception:
                pass
                
        # To send a secure link, we reuse their access token or generate a new one
        # Let's generate a new one for simplicity to ensure it's fresh
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        try:
            expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
            supabase.table("candidate_access_tokens").insert({
                "application_id": offer["application_id"],
                "stage": "offer",
                "token_hash": token_hash,
                "expires_at": expires_at
            }).execute()
        except Exception as te:
            logger.warning(f"Token insert warning: {te}")
            
        cand_name = (offer.get("applications") or {}).get("candidate_name") or "Candidate"
        cand_email = offer.get("email") or (offer.get("applications") or {}).get("email")
        position = offer.get("designation") or "Intern"
        
        client_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        response_link = f"{client_url}/offer-response/{token}"
        
        subject = f"Reminder: Internship Offer Response Required — {position}"
        body_text = f"Dear {cand_name},\n\nThis is a friendly reminder to review and respond to your offer for {position}.\n\nPlease respond using the secure link: {response_link}\n\nRegards,\nHR Department"
        body_html = f"<p>Dear <strong>{cand_name}</strong>,</p><p>This is a friendly reminder to review and respond to your offer for <strong>{position}</strong>.</p><p><a href='{response_link}'>Respond to Offer</a></p>"

        gmail_service.send_email(
            to_email=cand_email,
            subject=subject,
            body_text=body_text,
            body_html=body_html
        )
        
        now = datetime.now(timezone.utc).isoformat()
        update_data = {
            "last_reminder_at": now,
            "reminder_count": (offer.get("reminder_count") or 0) + 1,
            "updated_at": now
        }
        res = supabase.table("offers").update(update_data).eq("offer_id", offer_id).execute()
        
        OfferEventService.emit(offer_id, OFFER_REMINDER_SENT, actor_type="hr_admin", actor_id=admin_user_id)
        return res.data[0]

    @staticmethod
    def cancel_offer(offer_id: str, admin_user_id: str) -> dict:
        offer_res = supabase.table("offers").select("*").eq("offer_id", offer_id).single().execute()
        if not offer_res.data:
            raise ValueError("Offer not found")
            
        res = supabase.table("offers").update({
            "offer_status": "cancelled",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("offer_id", offer_id).execute()
        
        OfferEventService.emit(offer_id, OFFER_CANCELLED, actor_type="hr_admin", actor_id=admin_user_id)
        return res.data[0]

    @staticmethod
    def get_offer_timeline(offer_id: str) -> list:
        return OfferEventService.get_timeline(offer_id)

    @staticmethod
    def get_hr_dashboard_offers() -> list:
        # We fetch all offers, ordered by created_at. We'll join applications
        res = supabase.table("offers").select(
            "*, applications(candidate_name, position, current_status)"
        ).order("created_at", desc=True).execute()
        
        offers = res.data or []
        for o in offers:
            OfferService._check_and_expire_offer(o)
            
        return offers
