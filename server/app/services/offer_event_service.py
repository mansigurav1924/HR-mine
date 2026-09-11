"""
offer_event_service.py
Central event emitter for the offer lifecycle.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from app.services.supabase_client import supabase

logger = logging.getLogger(__name__)

# Valid event types
OFFER_GENERATED = "OFFER_GENERATED"
OFFER_SENT = "OFFER_SENT"
OFFER_VIEWED = "OFFER_VIEWED"
OFFER_PDF_ACCESSED = "OFFER_PDF_ACCESSED"
OFFER_REPLY_RECEIVED = "OFFER_REPLY_RECEIVED"
OFFER_REPLY_CLASSIFIED = "OFFER_REPLY_CLASSIFIED"
OFFER_DISCUSSION_REQUESTED = "OFFER_DISCUSSION_REQUESTED"
OFFER_ACCEPTED = "OFFER_ACCEPTED"
OFFER_DECLINED = "OFFER_DECLINED"
OFFER_EXPIRED = "OFFER_EXPIRED"
OFFER_REMINDER_SENT = "OFFER_REMINDER_SENT"
OFFER_EXPIRY_EXTENDED = "OFFER_EXPIRY_EXTENDED"
OFFER_CANCELLED = "OFFER_CANCELLED"
OFFER_WITHDRAWN = "OFFER_WITHDRAWN"


class OfferEventService:

    @staticmethod
    def emit(
        offer_id: str,
        event_type: str,
        actor_type: str = "system",
        actor_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Emit an offer lifecycle event to the offer_events table.
        Failures are logged but do not raise — events must not break the main flow.
        """
        try:
            row = {
                "offer_id": offer_id,
                "event_type": event_type,
                "occurred_at": datetime.now(timezone.utc).isoformat(),
                "actor_type": actor_type,
                "actor_id": actor_id or "system",
                "metadata": metadata or {}
            }
            res = supabase.table("offer_events").insert(row).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.warning(f"[OfferEvent] Failed to emit {event_type} for offer {offer_id}: {e}")
            return None

    @staticmethod
    def get_timeline(offer_id: str) -> list:
        """Return chronological event log for an offer."""
        try:
            res = supabase.table("offer_events").select("*").eq("offer_id", offer_id).order("occurred_at", desc=False).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"[OfferEvent] Failed to fetch timeline for offer {offer_id}: {e}")
            return []
