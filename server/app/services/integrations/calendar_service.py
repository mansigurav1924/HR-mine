from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class CalendarEventResult(BaseModel):
    event_id: str
    calendar_provider: str
    meeting_link: Optional[str] = None
    organizer_email: Optional[str] = None
    status: str = "synced"
    raw_response: Optional[Dict[str, Any]] = None

class CalendarProvider(ABC):
    @abstractmethod
    def create_interview_event(
        self,
        title: str,
        description: str,
        start_datetime_iso: str,
        end_datetime_iso: str,
        timezone_str: str,
        attendees: List[Dict[str, str]], # [{"email": "...", "name": "..."}]
        location: Optional[str] = None,
        create_online_meeting: bool = True,
        connected_by: Optional[str] = None
    ) -> CalendarEventResult:
        """Creates a calendar event and provisions an online conference meeting link if online."""
        pass

    @abstractmethod
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
        """Updates / reschedules an existing calendar event without duplicating it."""
        pass

    @abstractmethod
    def cancel_interview_event(
        self,
        event_id: str,
        reason: Optional[str] = None,
        connected_by: Optional[str] = None
    ) -> bool:
        """Cancels / removes an event from the external calendar."""
        pass

    @abstractmethod
    def get_event(
        self,
        event_id: str,
        connected_by: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Retrieves external calendar event details."""
        pass

def get_calendar_provider(provider_name: Optional[str] = "google") -> CalendarProvider:
    """Factory helper to obtain the selected calendar provider."""
    name = (provider_name or "google").lower()
    if name == "outlook":
        from .outlook_calendar_service import outlook_calendar_provider
        return outlook_calendar_provider
    from .google_calendar_service import google_calendar_provider
    return google_calendar_provider
