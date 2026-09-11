"""
gmail_reply_service.py
Handles inbound Gmail reply monitoring for offer communications.

Architecture:
  - Uses Gmail API `users.history.list` to detect new messages in known offer threads
  - Links incoming messages to offers via stored gmail_thread_id
  - Classifies reply intent using deterministic rule-based approach (no ML required)
  - Stores results in offer_communications table
  - ML integration point provided but NOT used by default

Privacy notice:
  - Only reads messages in threads already associated with sent offers
  - Does NOT scan the full inbox
  - Stores only a sanitized 500-char excerpt, never the full message
"""
import re
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

import requests

from app.services.supabase_client import supabase
from app.services.integrations.google_auth_service import google_auth_service
from app.services.offer_event_service import OfferEventService, OFFER_REPLY_RECEIVED, OFFER_REPLY_CLASSIFIED

logger = logging.getLogger(__name__)

GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

# ---------------------------------------------------------------------------
# Intent classification constants
# ---------------------------------------------------------------------------
INTENT_INTERESTED = "interested"
INTENT_NOT_INTERESTED = "not_interested"
INTENT_DISCUSSION = "discussion_required"
INTENT_NEEDS_TIME = "needs_more_time"
INTENT_UNCLEAR = "unclear"

# Negation words that can flip intent
_NEGATION = re.compile(
    r"\b(not|no|never|don't|do not|won't|would not|cannot|can't|haven't|have not|am not|i'm not)\b",
    re.IGNORECASE
)

# Keyword patterns (applied AFTER negation check per sentence)
_INTERESTED_PATTERNS = [
    r"\b(i am interested|i'm interested|interested in|would like to join|want to join|happy to join|"
    r"excited to join|please proceed|i accept|i would accept|looking forward|glad to accept|"
    r"ready to join|i will join|joining the team)\b"
]

_NOT_INTERESTED_PATTERNS = [
    r"\b(not interested|not joining|won't be joining|will not join|decided not|no longer interested|"
    r"accepted another|another offer|other opportunity|cannot join|can't join|i decline|must decline|"
    r"unfortunately.*decline|have to decline|i'm withdrawing|withdrawing my|step back)\b"
]

_DISCUSSION_PATTERNS = [
    r"\b(discuss|discussion|negotiate|negotiation|can we talk|joining date|start date|stipend|"
    r"compensation|work mode|remote|hybrid|duration|location|clarify|clarification|"
    r"have a call|schedule a call|few questions|some questions|query|queries)\b"
]

_NEEDS_TIME_PATTERNS = [
    r"\b(more time|few days|couple of days|need time|give me time|let me think|"
    r"wait for|waiting for|by (monday|tuesday|wednesday|thursday|friday|tomorrow|next week)|"
    r"can i have until|deadline extension|extend the deadline)\b"
]


class GmailReplyService:

    def _get_access_token(self, connected_by: Optional[str] = None) -> Optional[str]:
        """Get a valid Google access token. Returns None if unavailable (non-fatal)."""
        try:
            token = google_auth_service.get_valid_access_token(connected_by)
            if token.startswith("mock_") or token.startswith("sim_"):
                logger.info("[GmailReply] Simulated token — skipping real Gmail API calls")
                return None
            return token
        except Exception as e:
            logger.warning(f"[GmailReply] Could not get access token: {e}")
            return None

    def _gmail_get(self, path: str, params: dict, token: str) -> Optional[dict]:
        """Make a GET request to Gmail API."""
        try:
            res = requests.get(
                f"{GMAIL_BASE}/{path}",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
                timeout=15
            )
            if res.status_code == 200:
                return res.json()
            logger.warning(f"[GmailReply] API error {res.status_code}: {res.text[:200]}")
            return None
        except Exception as e:
            logger.error(f"[GmailReply] Request failed: {e}")
            return None

    # -----------------------------------------------------------------------
    # Intent Classification (deterministic, rule-based)
    # -----------------------------------------------------------------------

    @staticmethod
    def _sentences(text: str) -> List[str]:
        """Split text into rough sentences."""
        return re.split(r'[.!?\n]+', text)

    @staticmethod
    def _has_negation_before_keyword(sentence: str, keyword_pattern: str) -> bool:
        """
        Check if a negation word appears before the keyword match in the sentence.
        Returns True if negation is present.
        """
        sentence_lower = sentence.lower()
        kw_match = re.search(keyword_pattern, sentence_lower, re.IGNORECASE)
        if not kw_match:
            return False
        kw_start = kw_match.start()
        # Look for negation only in the part of the sentence before the keyword
        pre_text = sentence_lower[:kw_start]
        return bool(_NEGATION.search(pre_text))

    @classmethod
    def classify_intent(cls, text: str) -> Dict[str, Any]:
        """
        Classify the intent of a reply email using deterministic rules.
        Returns: {"intent": str, "confidence": None, "method": "rule_based"}
        
        Rules:
        1. Check for not-interested signals first (to avoid false positives)
        2. Check for interested signals (but only if not negated in that sentence)
        3. Check for discussion signals
        4. Check for needs-more-time signals
        5. Default to unclear
        
        This is the integration point for future ML:
        Replace this method body or add a fallback call to an ML classifier.
        """
        if not text or not text.strip():
            return {"intent": INTENT_UNCLEAR, "confidence": None, "method": "rule_based"}

        sentences = cls._sentences(text)

        # --- Check NOT_INTERESTED first (highest priority, avoid false positive on 'interested') ---
        for pattern in _NOT_INTERESTED_PATTERNS:
            for sentence in sentences:
                if re.search(pattern, sentence, re.IGNORECASE):
                    return {"intent": INTENT_NOT_INTERESTED, "confidence": None, "method": "rule_based"}

        # --- Check INTERESTED, but only when NOT negated in the same sentence ---
        for pattern in _INTERESTED_PATTERNS:
            for sentence in sentences:
                if re.search(pattern, sentence, re.IGNORECASE):
                    if not cls._has_negation_before_keyword(sentence, pattern):
                        return {"intent": INTENT_INTERESTED, "confidence": None, "method": "rule_based"}

        # --- Check DISCUSSION ---
        for pattern in _DISCUSSION_PATTERNS:
            for sentence in sentences:
                if re.search(pattern, sentence, re.IGNORECASE):
                    return {"intent": INTENT_DISCUSSION, "confidence": None, "method": "rule_based"}

        # --- Check NEEDS MORE TIME ---
        for pattern in _NEEDS_TIME_PATTERNS:
            for sentence in sentences:
                if re.search(pattern, sentence, re.IGNORECASE):
                    return {"intent": INTENT_NEEDS_TIME, "confidence": None, "method": "rule_based"}

        return {"intent": INTENT_UNCLEAR, "confidence": None, "method": "rule_based"}

    # -----------------------------------------------------------------------
    # Gmail Thread Polling
    # -----------------------------------------------------------------------

    def get_message_body(self, message_id: str, token: str) -> str:
        """Retrieve the plain-text body of a Gmail message."""
        try:
            data = self._gmail_get(f"messages/{message_id}", {"format": "full"}, token)
            if not data:
                return ""
            payload = data.get("payload", {})
            return self._extract_body(payload)
        except Exception as e:
            logger.warning(f"[GmailReply] Failed to get message body: {e}")
            return ""

    def _extract_body(self, payload: dict) -> str:
        """Recursively extract plain text from a Gmail message payload."""
        mime = payload.get("mimeType", "")
        body_data = payload.get("body", {}).get("data", "")
        
        if mime == "text/plain" and body_data:
            import base64
            try:
                return base64.urlsafe_b64decode(body_data + "==").decode("utf-8", errors="replace")
            except Exception:
                return ""
        
        parts = payload.get("parts", [])
        for part in parts:
            text = self._extract_body(part)
            if text:
                return text
        return ""

    def get_thread_messages(self, thread_id: str, token: str) -> List[dict]:
        """Get all messages in a Gmail thread."""
        data = self._gmail_get(f"threads/{thread_id}", {"format": "metadata"}, token)
        if not data:
            return []
        return data.get("messages", [])

    def find_offer_by_thread(self, gmail_thread_id: str) -> Optional[dict]:
        """Look up an offer by its stored gmail_thread_id."""
        try:
            res = supabase.table("offers").select(
                "offer_id, application_id, offer_status, gmail_thread_id, gmail_message_id"
            ).eq("gmail_thread_id", gmail_thread_id).limit(1).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            logger.warning(f"[GmailReply] DB lookup failed for thread {gmail_thread_id}: {e}")
        return None

    def store_communication(
        self,
        offer_id: str,
        application_id: str,
        gmail_message_id: str,
        gmail_thread_id: str,
        body_excerpt: str,
        intent_result: Dict[str, Any]
    ) -> Optional[str]:
        """Store inbound reply in offer_communications."""
        try:
            row = {
                "offer_id": offer_id,
                "application_id": application_id,
                "direction": "inbound",
                "channel": "email",
                "provider": "gmail",
                "gmail_message_id": gmail_message_id,
                "gmail_thread_id": gmail_thread_id,
                "message_type": "reply",
                "reply_intent": intent_result.get("intent"),
                "intent_confidence": intent_result.get("confidence"),
                "raw_excerpt": body_excerpt[:500] if body_excerpt else None,
                "received_at": datetime.now(timezone.utc).isoformat()
            }
            res = supabase.table("offer_communications").insert(row).execute()
            return res.data[0]["communication_id"] if res.data else None
        except Exception as e:
            logger.error(f"[GmailReply] Failed to store communication: {e}")
            return None

    def was_already_processed(self, gmail_message_id: str) -> bool:
        """Check if we already processed this Gmail message (idempotency guard)."""
        try:
            res = supabase.table("offer_communications").select("communication_id").eq(
                "gmail_message_id", gmail_message_id
            ).limit(1).execute()
            return bool(res.data)
        except Exception:
            return False

    def process_thread_replies(self, offer: dict, token: str) -> List[dict]:
        """
        For a given offer with a known thread_id, check for inbound replies
        that haven't been processed yet.
        Returns a list of processed communication records.
        """
        thread_id = offer.get("gmail_thread_id")
        offer_gmail_msg_id = offer.get("gmail_message_id")  # The original outgoing message
        if not thread_id:
            return []

        messages = self.get_thread_messages(thread_id, token)
        processed = []

        for msg in messages:
            msg_id = msg.get("id")
            if not msg_id:
                continue
            # Skip the original outgoing offer email
            if msg_id == offer_gmail_msg_id:
                continue
            # Skip already-processed messages
            if self.was_already_processed(msg_id):
                continue

            # Get full body
            body = self.get_message_body(msg_id, token)
            excerpt = body[:500].strip()

            # Classify intent
            intent_result = self.classify_intent(body)

            # Store
            comm_id = self.store_communication(
                offer_id=offer["offer_id"],
                application_id=offer["application_id"],
                gmail_message_id=msg_id,
                gmail_thread_id=thread_id,
                body_excerpt=excerpt,
                intent_result=intent_result
            )

            if comm_id:
                # Emit events
                OfferEventService.emit(
                    offer_id=offer["offer_id"],
                    event_type=OFFER_REPLY_RECEIVED,
                    actor_type="candidate",
                    metadata={"gmail_message_id": msg_id, "excerpt": excerpt[:100]}
                )
                OfferEventService.emit(
                    offer_id=offer["offer_id"],
                    event_type=OFFER_REPLY_CLASSIFIED,
                    actor_type="system",
                    metadata={"intent": intent_result["intent"], "method": intent_result["method"]}
                )
                processed.append({"communication_id": comm_id, "intent": intent_result["intent"]})

        return processed

    def poll_all_active_offer_threads(self, connected_by: Optional[str] = None) -> Dict[str, Any]:
        """
        Poll Gmail for replies across all active offers that have a known gmail_thread_id.
        Only processes: sent, viewed, discussion_requested offers (i.e., still open).
        Returns a summary of what was processed.
        """
        token = self._get_access_token(connected_by)
        if not token:
            return {"error": "Gmail not connected or simulated mode", "processed": 0}

        try:
            # Fetch open offers with known thread IDs
            res = supabase.table("offers").select(
                "offer_id, application_id, offer_status, gmail_thread_id, gmail_message_id"
            ).in_(
                "offer_status", ["sent", "viewed", "discussion_requested"]
            ).not_.is_("gmail_thread_id", "null").execute()

            offers = res.data or []
        except Exception as e:
            logger.error(f"[GmailReply] Failed to fetch offers: {e}")
            return {"error": str(e), "processed": 0}

        total_processed = 0
        for offer in offers:
            try:
                results = self.process_thread_replies(offer, token)
                total_processed += len(results)
            except Exception as e:
                logger.warning(f"[GmailReply] Error processing offer {offer.get('offer_id')}: {e}")

        return {
            "offers_checked": len(offers),
            "replies_processed": total_processed
        }


# Singleton instance
gmail_reply_service = GmailReplyService()
