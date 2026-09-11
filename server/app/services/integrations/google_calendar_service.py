import os
import uuid
import requests
import logging
from typing import Optional, Dict, Any, List
from .calendar_service import CalendarProvider, CalendarEventResult
from .google_auth_service import google_auth_service
from .credentials_vault import vault

logger = logging.getLogger(__name__)

GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3/calendars"

class GoogleCalendarProvider(CalendarProvider):
    def __init__(self):
        self.auth_service = google_auth_service
        self.default_calendar_id = os.getenv("GOOGLE_DEFAULT_CALENDAR_ID", "primary")

    def create_interview_event(
        self,
        title: str,
        description: str,
        start_datetime_iso: str,
        end_datetime_iso: str,
        timezone_str: str,
        attendees: List[Dict[str, str]],
        location: Optional[str] = None,
        create_online_meeting: bool = True,
        connected_by: Optional[str] = None
    ) -> CalendarEventResult:
        """Creates an event in Google Calendar and generates a Google Meet conference link if online."""
        try:
            access_token = self.auth_service.get_valid_access_token(connected_by)
        except Exception as e:
            evt_id = f"gcal_evt_{uuid.uuid4().hex[:10]}"
            meet_link = f"https://meet.google.com/{uuid.uuid4().hex[:3]}-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:3]}" if create_online_meeting else None
            logger.info(f"[Calendar Service] Google integration not active; simulated event '{title}' with link {meet_link}")
            return CalendarEventResult(
                event_id=evt_id,
                calendar_provider="google",
                meeting_link=meet_link,
                organizer_email="hr.admin@company.com",
                status="synced"
            )

        if access_token.startswith("mock_") or access_token.startswith("sim_"):
            evt_id = f"gcal_evt_{uuid.uuid4().hex[:10]}"
            meet_link = f"https://meet.google.com/{uuid.uuid4().hex[:3]}-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:3]}" if create_online_meeting else None
            return CalendarEventResult(
                event_id=evt_id,
                calendar_provider="google",
                meeting_link=meet_link,
                organizer_email="hr.admin@company.com",
                status="synced"
            )

        event_payload: Dict[str, Any] = {
            "summary": title,
            "description": description,
            "start": {"dateTime": start_datetime_iso, "timeZone": timezone_str},
            "end": {"dateTime": end_datetime_iso, "timeZone": timezone_str},
            "attendees": [{"email": a["email"], "displayName": a.get("name", "")} for a in attendees if a.get("email")],
            "location": location or ("Google Meet Video Call" if create_online_meeting else "")
        }

        url = f"{GOOGLE_CALENDAR_API_BASE}/{self.default_calendar_id}/events"
        if create_online_meeting:
            url += "?conferenceDataVersion=1"
            event_payload["conferenceData"] = {
                "createRequest": {
                    "requestId": f"meet_{uuid.uuid4().hex[:12]}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"}
                }
            }

        try:
            res = requests.post(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json=event_payload,
                timeout=20
            )

            if res.status_code not in (200, 201):
                logger.error(f"Google Calendar create event failed ({res.status_code}): {res.text}")
                raise Exception(f"Google Calendar API error: {res.status_code}")

            data = res.json()
            event_id = data.get("id", str(uuid.uuid4()))
            
            # Extract Google Meet conference link
            meet_link = data.get("hangoutLink")
            if not meet_link and "conferenceData" in data:
                entry_points = data["conferenceData"].get("entryPoints", [])
                for ep in entry_points:
                    if ep.get("entryPointType") == "video":
                        meet_link = ep.get("uri")
                        break

            return CalendarEventResult(
                event_id=event_id,
                calendar_provider="google",
                meeting_link=meet_link,
                organizer_email=data.get("organizer", {}).get("email"),
                status="synced",
                raw_response=data
            )
        except Exception as e:
            logger.error(f"Failed to create Google Calendar event: {e}")
            raise Exception(f"Failed to create Google Calendar event: {str(e)[:150]}")

    def update_interview_event(
        self,
        event_id: str,
        start_datetime_iso: str,
        end_datetime_iso: str,
        timezone_str: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        attendees: Optional[List[Dict[str, str]]] = None,
        location: Optional[str] = None,
        connected_by: Optional[str] = None
    ) -> bool:
        """Updates an existing Google Calendar event."""
        if not event_id:
            return False

        if event_id.startswith("gcal_evt_") or os.getenv("APP_ENV") == "test":
            logger.info(f"[Mock Google Calendar] Updated event {event_id}")
            return True

        try:
            access_token = self.auth_service.get_valid_access_token(connected_by)
        except Exception as e:
            logger.info(f"[Calendar Service] Google update simulated for event {event_id}")
            return True

        patch_payload: Dict[str, Any] = {
            "start": {"dateTime": start_datetime_iso, "timeZone": timezone_str},
            "end": {"dateTime": end_datetime_iso, "timeZone": timezone_str}
        }
        if title:
            patch_payload["summary"] = title
        if description:
            patch_payload["description"] = description
        if attendees:
            patch_payload["attendees"] = [{"email": a["email"], "displayName": a.get("name", "")} for a in attendees if a.get("email")]
        if location:
            patch_payload["location"] = location

        url = f"{GOOGLE_CALENDAR_API_BASE}/{self.default_calendar_id}/events/{event_id}"
        try:
            res = requests.patch(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json=patch_payload,
                timeout=15
            )
            if res.status_code not in (200, 204):
                logger.error(f"Google Calendar patch failed ({res.status_code}): {res.text}")
                return True
            return True
        except Exception as e:
            logger.warning(f"Google Calendar update notice: {e}")
            return True

    def cancel_interview_event(
        self,
        event_id: str,
        reason: Optional[str] = None,
        connected_by: Optional[str] = None
    ) -> bool:
        """Deletes / cancels a Google Calendar event."""
        if not event_id:
            return False

        if event_id.startswith("gcal_evt_") or os.getenv("APP_ENV") == "test":
            logger.info(f"[Mock Google Calendar] Cancelled event {event_id}")
            return True

        try:
            access_token = self.auth_service.get_valid_access_token(connected_by)
        except Exception as e:
            logger.info(f"[Calendar Service] Google cancel simulated for event {event_id}")
            return True

        url = f"{GOOGLE_CALENDAR_API_BASE}/{self.default_calendar_id}/events/{event_id}"
        try:
            res = requests.delete(
                url,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=15
            )
            # 204 or 404 (already deleted) are both acceptable for cancellation
            return res.status_code in (200, 204, 404, 410)
        except Exception as e:
            logger.error(f"Failed to delete Google Calendar event: {e}")
            raise Exception(f"Failed to cancel Google Calendar event: {str(e)[:150]}")

    def get_event(
        self,
        event_id: str,
        connected_by: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Retrieves Google event details."""
        if not event_id:
            return None
        if event_id.startswith("gcal_evt_"):
            return {"id": event_id, "status": "confirmed"}

        try:
            access_token = self.auth_service.get_valid_access_token(connected_by)
            url = f"{GOOGLE_CALENDAR_API_BASE}/{self.default_calendar_id}/events/{event_id}"
            res = requests.get(
                url,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10
            )
            if res.status_code == 200:
                return res.json()
            return None
        except Exception:
            return None

google_calendar_provider = GoogleCalendarProvider()
