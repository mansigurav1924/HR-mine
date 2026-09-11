import os
import sys
import uuid
import pytest
from unittest.mock import patch, MagicMock
from datetime import date, time, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from fastapi import HTTPException
from app.main import app
from app.services.supabase_client import supabase
from app.dependencies.auth import get_current_user, require_hr_admin
from app.services.integrations.credentials_vault import vault
from app.services.integrations.gmail_service import gmail_service
from app.services.integrations.google_calendar_service import google_calendar_provider
from app.services.integrations.outlook_calendar_service import outlook_calendar_provider
from app.services.email.email_service import EmailService
from app.services.email.gmail_provider import GmailProvider

client = TestClient(app)

class MockUser:
    def __init__(self, user_id: str, email: str, role: str):
        self.id = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
        self.email = email
        self.role = role

def get_test_hr_user():
    res = supabase.table("users").select("user_id, email, role").eq("role", "hr_admin").limit(1).execute()
    if res.data:
        return MockUser(res.data[0]["user_id"], res.data[0]["email"], "hr_admin")
    return MockUser("69803ee5-3de4-4c0e-9602-46f18c3f87f5", "hr.admin@company.com", "hr_admin")

@pytest.fixture(autouse=True)
def override_auth():
    hr_user = get_test_hr_user()
    app.dependency_overrides[require_hr_admin] = lambda: hr_user
    app.dependency_overrides[get_current_user] = lambda: hr_user
    yield
    app.dependency_overrides = {}

def test_credentials_vault_encryption():
    # Test token encryption at rest
    test_access = "secret_access_token_12345"
    test_refresh = "secret_refresh_token_67890"
    hr_user = get_test_hr_user()
    user_id = str(hr_user.id)

    vault.save_credentials(
        provider="google",
        account_email="test.hr@company.com",
        access_token=test_access,
        refresh_token=test_refresh,
        token_expiry="2027-01-01T00:00:00Z",
        granted_scopes=["gmail.send", "calendar.events"],
        connected_by=user_id
    )

    creds = vault.get_credentials("google", user_id)
    assert creds is not None
    assert creds["account_email"] == "test.hr@company.com"
    assert creds["access_token"] == test_access
    assert creds["refresh_token"] == test_refresh

    # Ensure status hides raw tokens
    status = vault.get_status("google", user_id)
    assert status["connected"] is True
    assert status["account_email"] == "test.hr@company.com"
    assert "access_token" not in status
    assert "refresh_token" not in status

def test_google_oauth_endpoints():
    # 1. Connect URL
    connect_res = client.get("/api/integrations/google/connect")
    assert connect_res.status_code == 200
    connect_data = connect_res.json()
    assert connect_data["provider"] == "google"
    assert "auth_url" in connect_data
    assert "gmail.send" in connect_data["auth_url"]
    assert "calendar.events" in connect_data["auth_url"]

    # 2. Callback code exchange
    callback_res = client.get("/api/integrations/google/callback?code=mock_google_code_xyz", follow_redirects=False)
    assert callback_res.status_code in (200, 307, 302)

    # 3. Status
    status_res = client.get("/api/integrations/google/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["connected"] is True
    assert status_data["account_email"] is not None

    # 4. Disconnect
    disc_res = client.post("/api/integrations/google/disconnect")
    assert disc_res.status_code == 200
    assert disc_res.json()["success"] is True

def test_microsoft_oauth_endpoints():
    # 1. Connect URL
    connect_res = client.get("/api/integrations/microsoft/connect")
    assert connect_res.status_code == 200
    connect_data = connect_res.json()
    assert connect_data["provider"] == "microsoft"
    assert "Calendars.ReadWrite" in connect_data["auth_url"]
    # Verify Mail permissions are NOT requested
    assert "Mail.Send" not in connect_data["auth_url"]

    # 2. Callback exchange
    callback_res = client.get("/api/integrations/microsoft/callback?code=mock_ms_code_xyz", follow_redirects=False)
    assert callback_res.status_code in (200, 307, 302)

    # 3. Status
    status_res = client.get("/api/integrations/microsoft/status")
    assert status_res.status_code == 200
    assert status_res.json()["connected"] is True

    # 4. Disconnect
    disc_res = client.post("/api/integrations/microsoft/disconnect")
    assert disc_res.status_code == 200

def test_gmail_service_send_and_email_provider():
    # Test EmailService returns GmailProvider by default
    provider = EmailService.get_provider()
    assert isinstance(provider, GmailProvider)

    # Send MIME message via GmailService with mocked token/api
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"id": "mock_gmail_msg_12345", "threadId": "mock_thread_1"}

    with patch("app.services.integrations.google_auth_service.google_auth_service.get_valid_access_token", return_value="mock_token"):
        pdf_attachment = b"%PDF-1.4 sample offer letter content"
        send_res = gmail_service.send_email(
            to_email="candidate@example.com",
            subject="Your Offer Letter – Software Engineer",
            text_body="Dear Candidate, Please find your offer letter attached.",
            html_body="<p>Dear Candidate, Please find your offer letter attached.</p>",
            attachment_bytes=pdf_attachment,
            attachment_name="Offer_Letter.pdf"
        )
        assert send_res["status"] == "sent"
        assert send_res["message_id"] is not None
        assert send_res["provider"] == "gmail"

def test_google_calendar_meet_provisioning():
    with patch("app.services.integrations.google_auth_service.google_auth_service.get_valid_access_token", return_value="mock_token"):
        cal_res = google_calendar_provider.create_interview_event(
            title="Interview — AI Engineer",
            description="Candidate: Alice Smith\nPosition: AI Engineer\nRound: Round 1",
            start_datetime_iso="2026-09-10T10:00:00",
            end_datetime_iso="2026-09-10T10:45:00",
            timezone_str="UTC",
            attendees=[{"email": "alice@example.com", "name": "Alice Smith"}, {"email": "interviewer@company.com", "name": "John Doe"}],
            create_online_meeting=True
        )
        assert cal_res.calendar_provider == "google"
        assert cal_res.status == "synced"
        assert cal_res.event_id is not None
        assert cal_res.meeting_link is not None
        assert "meet.google.com" in cal_res.meeting_link

        # Reschedule / Update
        updated = google_calendar_provider.update_interview_event(
            event_id=cal_res.event_id,
            start_datetime_iso="2026-09-10T11:00:00",
            end_datetime_iso="2026-09-10T11:45:00",
            timezone_str="UTC"
        )
        assert updated is True

        # Cancel / Delete
        cancelled = google_calendar_provider.cancel_interview_event(event_id=cal_res.event_id)
        assert cancelled is True

def test_outlook_calendar_teams_provisioning():
    cal_res = outlook_calendar_provider.create_interview_event(
        title="Interview — Product Manager",
        description="Candidate: Charlie Brown\nPosition: Product Manager\nRound: Round 1",
        start_datetime_iso="2026-09-11T14:00:00",
        end_datetime_iso="2026-09-11T14:45:00",
        timezone_str="UTC",
        attendees=[{"email": "charlie@example.com", "name": "Charlie Brown"}],
        create_online_meeting=True
    )
    assert cal_res.calendar_provider == "outlook"
    assert cal_res.status == "synced"
    assert cal_res.event_id is not None
    assert cal_res.meeting_link is not None
    assert "teams.microsoft.com" in cal_res.meeting_link

    # Reschedule / Update
    updated = outlook_calendar_provider.update_interview_event(
        event_id=cal_res.event_id,
        start_datetime_iso="2026-09-11T15:00:00",
        end_datetime_iso="2026-09-11T15:45:00",
        timezone_str="UTC"
    )
    assert updated is True

    # Cancel / Delete
    cancelled = outlook_calendar_provider.cancel_interview_event(event_id=cal_res.event_id)
    assert cancelled is True

def test_interview_scheduling_with_calendar_and_retry_sync():
    # 1. Fetch interviewer
    intv_res = client.get("/api/interviews/interviewers")
    assert intv_res.status_code == 200
    interviewers = intv_res.json()
    assert len(interviewers) > 0
    interviewer_id = interviewers[0]["user_id"]

    # 2. Create eligible test application
    pos_res = supabase.table("job_requirements").select("position_id").limit(1).execute()
    pos_id = pos_res.data[0]["position_id"]

    app_insert = supabase.table("applications").insert({
        "candidate_name": "Integration Test Candidate",
        "email": f"test_cal_{uuid.uuid4().hex[:6]}@example.com",
        "phone": "+1999888777",
        "position_id": pos_id,
        "position": "Software Engineer",
        "current_status": "ai_interview_completed"
    }).execute()
    app_id = app_insert.data[0]["application_id"]

    mock_cal_res = MagicMock()
    mock_cal_res.status = "synced"
    mock_cal_res.event_id = "mock_event_gcal"
    mock_cal_res.meeting_link = "https://meet.google.com/test-meet"
    mock_cal_res.calendar_provider = "google"

    with patch("app.services.integrations.google_calendar_service.GoogleCalendarProvider.create_interview_event", return_value=mock_cal_res), \
         patch("app.services.integrations.google_calendar_service.GoogleCalendarProvider.update_interview_event", return_value=True), \
         patch("app.services.email.gmail_provider.GmailProvider.send_email", return_value={"status": "sent", "message_id": "msg_123"}):
        # 3. Schedule Interview with Google Calendar
        sched_res = client.post(
            "/api/interviews/",
            json={
                "application_id": app_id,
                "round_number": 1,
                "date": str(date.today() + timedelta(days=2)),
                "time": "14:00:00",
                "interviewer_id": interviewer_id,
                "type": "Technical Round",
                "mode": "online",
                "calendar_provider": "google",
                "duration_minutes": 45
            }
        )
        assert sched_res.status_code == 200
        sched_data = sched_res.json()
        interview_id = sched_data["interview_id"]
        assert sched_data["calendar_provider"] == "google"
        assert sched_data["calendar_sync_status"] == "synced"
        assert sched_data["meeting_link"] is not None

        # 4. Reschedule Interview
        resched_res = client.post(
            f"/api/interviews/{interview_id}/reschedule",
            json={
                "date": str(date.today() + timedelta(days=3)),
                "time": "15:00:00",
                "interviewer_id": interviewer_id,
                "mode": "online",
                "calendar_provider": "google",
                "duration_minutes": 45,
                "reason": "Interviewer requested 1-hour push"
            }
        )
        assert resched_res.status_code == 200
        assert resched_res.json()["calendar_sync_status"] == "synced"

        # 5. Retry Calendar Sync endpoint
        sync_res = client.post(f"/api/interviews/{interview_id}/calendar-sync")
        assert sync_res.status_code == 200
        assert sync_res.json()["calendar_sync_status"] == "synced"

        # 6. Cancel Interview
        cancel_res = client.post(
            f"/api/interviews/{interview_id}/cancel",
            json={"reason": "Candidate withdrew application"}
        )
        assert cancel_res.status_code == 200

def test_rbac_security_for_integrations():
    # 1. Unauthenticated / Interviewer role blocked from Google Connect
    def mock_forbidden():
        raise HTTPException(status_code=403, detail="HR Admin role required.")

    app.dependency_overrides[require_hr_admin] = mock_forbidden

    res1 = client.get("/api/integrations/google/connect")
    assert res1.status_code == 403

    res2 = client.post("/api/integrations/google/disconnect")
    assert res2.status_code == 403

    res3 = client.get("/api/integrations/microsoft/connect")
    assert res3.status_code == 403

    res4 = client.post("/api/integrations/microsoft/disconnect")
    assert res4.status_code == 403

    res5 = client.post(f"/api/interviews/{str(uuid.uuid4())}/calendar-sync")
    assert res5.status_code == 403
