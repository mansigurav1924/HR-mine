import os
import uuid
import requests
import logging
from typing import Optional, Dict, Any, List
from .calendar_service import CalendarProvider, CalendarEventResult
from .microsoft_auth_service import microsoft_auth_service

logger = logging.getLogger(__name__)

GRAPH_API_EVENTS_URL = "https://graph.microsoft.com/v1.0/me/events"

class OutlookCalendarProvider(CalendarProvider):
    def __init__(self):
        self.auth_service = microsoft_auth_service

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
        """Creates an Outlook calendar event via Microsoft Graph and generates Microsoft Teams online meeting if online."""
        try:
            access_token = self.auth_service.get_valid_access_token(connected_by)
        except Exception as e:
            if os.getenv("APP_ENV") == "test" or not self.auth_service.client_secret:
                evt_id = f"ms_evt_{uuid.uuid4().hex[:10]}"
                teams_link = f"https://teams.microsoft.com/l/meetup-join/{uuid.uuid4().hex[:16]}" if create_online_meeting else None
                return CalendarEventResult(
                    event_id=evt_id,
                    calendar_provider="outlook",
                    meeting_link=teams_link,
                    organizer_email="hr.admin@outlook.com",
                    status="synced"
                )
            raise Exception(f"Outlook Calendar access failed: {str(e)}")

        if access_token.startswith("mock_"):
            evt_id = f"ms_evt_{uuid.uuid4().hex[:10]}"
            teams_link = f"https://teams.microsoft.com/l/meetup-join/{uuid.uuid4().hex[:16]}" if create_online_meeting else None
            return CalendarEventResult(
                event_id=evt_id,
                calendar_provider="outlook",
                meeting_link=teams_link,
                organizer_email="hr.admin@outlook.com",
                status="synced"
            )

        event_payload: Dict[str, Any] = {
            "subject": title,
            "body": {
                "contentType": "HTML",
                "content": f"<p>{description.replace(chr(10), '<br>')}</p>"
            },
            "start": {
                "dateTime": start_datetime_iso,
                "timeZone": timezone_str
            },
            "end": {
                "dateTime": end_datetime_iso,
                "timeZone": timezone_str
            },
            "attendees": [
                {
                    "emailAddress": {"address": a["email"], "name": a.get("name", "")},
                    "type": "required"
                }
                for a in attendees if a.get("email")
            ],
            "location": {
                "displayName": location or ("Microsoft Teams Meeting" if create_online_meeting else "")
            },
            "isOnlineMeeting": create_online_meeting,
            "onlineMeetingProvider": "teamsForBusiness" if create_online_meeting else "unknown"
        }

        try:
            res = requests.post(
                GRAPH_API_EVENTS_URL,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json=event_payload,
                timeout=20
            )

            if res.status_code not in (200, 201):
                logger.error(f"Microsoft Graph create event failed ({res.status_code}): {res.text}")
                raise Exception(f"Microsoft Graph API error: {res.status_code}")

            data = res.json()
            event_id = data.get("id", str(uuid.uuid4()))

            # Parse Teams link
            teams_link = None
            if data.get("onlineMeeting"):
                teams_link = data["onlineMeeting"].get("joinUrl")
            elif data.get("onlineMeetingUrl"):
                teams_link = data.get("onlineMeetingUrl")

            return CalendarEventResult(
                event_id=event_id,
                calendar_provider="outlook",
                meeting_link=teams_link,
                organizer_email=data.get("organizer", {}).get("emailAddress", {}).get("address"),
                status="synced",
                raw_response=data
            )
        except Exception as e:
            logger.error(f"Failed to create Microsoft Outlook event: {e}")
            raise Exception(f"Failed to create Microsoft Outlook event: {str(e)[:150]}")

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
        """Updates an existing Microsoft Graph Outlook calendar event."""
        if not event_id:
            return False

        if event_id.startswith("ms_evt_") or os.getenv("APP_ENV") == "test":
            logger.info(f"[Mock Outlook Calendar] Updated event {event_id}")
            return True

        try:
            access_token = self.auth_service.get_valid_access_token(connected_by)
        except Exception as e:
            raise Exception(f"Outlook Calendar update failed: {str(e)}")

        patch_payload: Dict[str, Any] = {
            "start": {"dateTime": start_datetime_iso, "timeZone": timezone_str},
            "end": {"dateTime": end_datetime_iso, "timeZone": timezone_str}
        }
        if title:
            patch_payload["subject"] = title
        if description:
            patch_payload["body"] = {"contentType": "HTML", "content": f"<p>{description.replace(chr(10), '<br>')}</p>"}
        if attendees:
            patch_payload["attendees"] = [
                {"emailAddress": {"address": a["email"], "name": a.get("name", "")}, "type": "required"}
                for a in attendees if a.get("email")
            ]
        if location:
            patch_payload["location"] = {"displayName": location}

        url = f"{GRAPH_API_EVENTS_URL}/{event_id}"
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
                logger.error(f"Microsoft Graph patch failed ({res.status_code}): {res.text}")
                raise Exception(f"Microsoft Graph update returned {res.status_code}")
            return True
        except Exception as e:
            logger.error(f"Failed to update Outlook event: {e}")
            raise Exception(f"Failed to update Outlook event: {str(e)[:150]}")

    def cancel_interview_event(
        self,
        event_id: str,
        reason: Optional[str] = None,
        connected_by: Optional[str] = None
    ) -> bool:
        """Deletes / cancels an Outlook event."""
        if not event_id:
            return False

        if event_id.startswith("ms_evt_") or os.getenv("APP_ENV") == "test":
            logger.info(f"[Mock Outlook Calendar] Cancelled event {event_id}")
            return True

        try:
            access_token = self.auth_service.get_valid_access_token(connected_by)
        except Exception as e:
            raise Exception(f"Outlook Calendar cancel failed: {str(e)}")

        url = f"{GRAPH_API_EVENTS_URL}/{event_id}"
        try:
            res = requests.delete(
                url,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=15
            )
            return res.status_code in (200, 204, 404, 410)
        except Exception as e:
            logger.error(f"Failed to delete Outlook event: {e}")
            raise Exception(f"Failed to cancel Outlook event: {str(e)[:150]}")

    def get_event(
        self,
        event_id: str,
        connected_by: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Retrieves Outlook event details."""
        if not event_id:
            return None
        if event_id.startswith("ms_evt_"):
            return {"id": event_id, "status": "confirmed"}

        try:
            access_token = self.auth_service.get_valid_access_token(connected_by)
            url = f"{GRAPH_API_EVENTS_URL}/{event_id}"
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

outlook_calendar_provider = OutlookCalendarProvider()
