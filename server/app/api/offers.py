from fastapi import APIRouter, Depends, HTTPException, Response, BackgroundTasks
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime

from app.schemas.offer import OfferGenerateRequest, OfferPreviewRequest, OfferResponseRequest, ExtendDeadlineRequest
from app.services.offer_service import OfferService
from app.services.gmail_reply_service import gmail_reply_service
from app.services.supabase_client import supabase
from app.dependencies.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

def get_user_info(current_user):
    if isinstance(current_user, dict):
        return current_user.get("id") or current_user.get("user_id"), current_user.get("role")
    return getattr(current_user, "id", None), getattr(current_user, "role", None)

@router.post("/preview")
async def preview_offer(req: OfferPreviewRequest):
    try:
        pdf_bytes = await OfferService.preview_offer(req)
        return Response(content=pdf_bytes, media_type="application/pdf")
    except ValueError as e:
        logger.warning(f"ValueError in preview_offer: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in preview_offer: {e}", exc_info=True)
        err_str = str(e) or repr(e)
        if "getaddrinfo failed" in err_str:
            err_str = "Network connection issue: Failed to resolve database host. Please check your internet connection and try again."
        raise HTTPException(status_code=500, detail=err_str)

@router.post("/generate")
async def generate_offer(req: OfferGenerateRequest, current_user = Depends(get_current_user)):
    try:
        user_id, role = get_user_info(current_user)
        if role not in ["hr_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Not authorized to generate offers")
            
        res = await OfferService.generate_offer(req, user_id)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        err_str = str(e) or repr(e)
        if "getaddrinfo failed" in err_str:
            err_str = "Network connection issue: Failed to connect to database. Please check your internet connection and try again."
        raise HTTPException(status_code=500, detail=err_str)

@router.post("/{offer_id}/send")
async def send_offer(offer_id: str, current_user = Depends(get_current_user)):
    try:
        user_id, role = get_user_info(current_user)
        if role not in ["hr_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Not authorized to send offers")
            
        await OfferService.send_offer_email(offer_id, user_id)
        return {"message": "Email sent successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{offer_id}/remind")
async def send_reminder(offer_id: str, current_user = Depends(get_current_user)):
    try:
        user_id, role = get_user_info(current_user)
        if role not in ["hr_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        res = OfferService.send_reminder(offer_id, user_id)
        return {"message": "Reminder sent successfully", "offer": res}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{offer_id}/extend")
async def extend_deadline(offer_id: str, req: ExtendDeadlineRequest, current_user = Depends(get_current_user)):
    try:
        user_id, role = get_user_info(current_user)
        if role not in ["hr_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        res = OfferService.extend_deadline(offer_id, req.new_expiry, user_id)
        return {"message": "Deadline extended", "offer": res}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{offer_id}/cancel")
async def cancel_offer(offer_id: str, current_user = Depends(get_current_user)):
    try:
        user_id, role = get_user_info(current_user)
        if role not in ["hr_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        res = OfferService.cancel_offer(offer_id, user_id)
        return {"message": "Offer cancelled", "offer": res}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{offer_id}/timeline")
async def get_offer_timeline(offer_id: str, current_user = Depends(get_current_user)):
    try:
        user_id, role = get_user_info(current_user)
        if role not in ["hr_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        res = OfferService.get_offer_timeline(offer_id)
        
        # Also include communications as events for the timeline
        comms_res = supabase.table("offer_communications").select("*").eq("offer_id", offer_id).execute()
        comms = comms_res.data or []
        
        events = list(res)
        for c in comms:
            if c.get("direction") == "inbound":
                events.append({
                    "event_type": "OFFER_REPLY_RECEIVED",
                    "occurred_at": c.get("received_at"),
                    "metadata": {
                        "intent": c.get("reply_intent"),
                        "excerpt": c.get("raw_excerpt")
                    }
                })
                
        # Sort combined timeline
        events.sort(key=lambda x: x.get("occurred_at", ""))
        return events
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reply/poll")
async def poll_replies(background_tasks: BackgroundTasks, current_user = Depends(get_current_user)):
    """Manually trigger polling for Gmail replies. Can be run in background."""
    try:
        user_id, role = get_user_info(current_user)
        if role not in ["hr_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        # We can run it directly, it should be fast enough for active offers
        res = gmail_reply_service.poll_all_active_offer_threads(connected_by=user_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def get_offers(current_user = Depends(get_current_user)):
    _, role = get_user_info(current_user)
    if role not in ["hr_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    try:
        return OfferService.get_hr_dashboard_offers()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------
# Candidate Public Endpoints
# -------------------------------------------------------------

@router.get("/response/validate/{token}")
async def validate_offer_token(token: str):
    try:
        offer = OfferService.get_offer_by_token(token)
        app_data = offer.get("applications") or {}
        
        # Track view
        OfferService.track_offer_view(offer["offer_id"])
        
        return {
            "offer_id": offer.get("offer_id"),
            "candidate_name": app_data.get("candidate_name") or "Candidate",
            "position": offer.get("designation") or "",
            "department": offer.get("department") or "",
            "stipend": offer.get("stipend") or "",
            "joining_date": offer.get("joining_date"),
            "status": offer.get("offer_status") or offer.get("status"),
            "expiry": offer.get("expiry_at") or offer.get("offer_expiry_date")
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/response/submit/{token}")
async def submit_offer_response(token: str, req: OfferResponseRequest):
    try:
        res = OfferService.respond_to_offer(token, req)
        return {"message": "Response recorded successfully", "status": res.get("offer_status") or res.get("status")}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/response/download/{token}")
async def download_offer_pdf(token: str):
    try:
        offer = OfferService.get_offer_by_token(token)
        from app.services.pdf_service import PDFService
        pdf_path = offer.get("pdf_url") or offer.get("pdf_storage_path")
        pdf_bytes = await PDFService.download_pdf_from_storage(pdf_path)
        
        # Track PDF access
        OfferService.track_pdf_access(offer["offer_id"])
        
        cand_name = (offer.get("applications") or {}).get("candidate_name") or "Candidate"
        return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=Offer_Letter_{cand_name.replace(' ', '_')}.pdf"})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
