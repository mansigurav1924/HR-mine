import os
import sys
import uuid
import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app
from app.services.supabase_client import supabase
from app.dependencies.auth import get_current_user, require_hr_admin

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
    return MockUser("69803ee5-3de4-4c0e-9602-46f18c3f87f5", "mgurav2412@gmail.com", "hr_admin")

@pytest.fixture(autouse=True)
def override_auth():
    hr_user = get_test_hr_user()
    app.dependency_overrides[require_hr_admin] = lambda: hr_user
    app.dependency_overrides[get_current_user] = lambda: hr_user
    yield
    app.dependency_overrides = {}

def test_full_step21b_flow():
    # 1. Fetch available active positions
    jobs_res = client.get("/api/public/jobs")
    assert jobs_res.status_code == 200
    jobs = jobs_res.json()
    assert len(jobs) > 0
    test_job = jobs[0]
    pos_id = test_job["position_id"]

    # 2. Public candidate submission
    test_email = f"candidate_{uuid.uuid4().hex[:8]}@example.com"
    pdf_content = b"%PDF-1.4 sample resume content with React and Python skills"
    
    app_res = client.post(
        "/api/public/applications",
        data={
            "position_id": pos_id,
            "full_name": "Bob Candidate",
            "email": test_email,
            "phone": "+1987654321",
            "college": "Stanford",
            "degree": "B.S. Computer Science",
            "current_year": "2026",
            "skills": "React, Python, Node.js",
            "consent_given": "true"
        },
        files={
            "resume": ("resume.pdf", pdf_content, "application/pdf")
        }
    )
    assert app_res.status_code == 200
    app_data = app_res.json()
    assert app_data["success"] is True
    app_id = app_data["application_id"]
    verification_token = app_data["verification_token"]
    assert verification_token is not None

    # 3. Candidate loads job-specific skills for verification
    verify_get_res = client.get(f"/api/public/applications/skills/{verification_token}")
    assert verify_get_res.status_code == 200
    v_data = verify_get_res.json()
    assert v_data["application_id"] == app_id
    assert "required_skills" in v_data
    assert len(v_data["required_skills"]) > 0 or len(v_data["initial_skills"]) > 0

    # 4. Candidate verifies and self-rates skills with confirmation
    verify_post_res = client.post(
        f"/api/public/applications/skills/{verification_token}/verify",
        json={
            "skills": [
                {"skill": "React", "rating": "advanced"},
                {"skill": "Python", "rating": "intermediate"},
                {"skill": "Docker", "rating": "beginner"}
            ],
            "confirmed": True
        }
    )
    assert verify_post_res.status_code == 200
    assert verify_post_res.json()["success"] is True

    # 5. Verify application status is ml_evaluated or under_review (NOT automatically shortlisted!)
    db_app = supabase.table("applications").select("current_status, skills").eq("application_id", app_id).single().execute()
    assert db_app.data["current_status"] in ("ml_evaluated", "under_review")
    assert db_app.data["current_status"] != "shortlisted"

    # 6. Check HR Pending / Shortlisting endpoints
    pending_res = client.get("/api/shortlisting/pending")
    assert pending_res.status_code == 200
    pending_list = pending_res.json()
    assert any(c["application_id"] == app_id for c in pending_list)

    # 7. HR Shortlists Candidate
    shortlist_decision_res = client.post(
        f"/api/applications/{app_id}/shortlist-decision",
        json={
            "decision": "shortlisted",
            "reason": "Outstanding skills and project profile."
        }
    )
    assert shortlist_decision_res.status_code == 200
    assert shortlist_decision_res.json()["decision"] == "shortlisted"

    # 8. Check Candidate is now in Shortlisted list
    shortlisted_res = client.get("/api/shortlisting/shortlisted")
    assert shortlisted_res.status_code == 200
    shortlisted_list = shortlisted_res.json()
    assert any(c["application_id"] == app_id for c in shortlisted_list)

    # 9. Test Bulk Shortlist Email dispatch
    with patch("app.services.email.gmail_provider.GmailProvider.send_email", return_value={"status": "sent", "message_id": "test-msg-123", "provider": "gmail"}), \
         patch("app.services.email.smtp_provider.SMTPProvider.send_email", return_value={"status": "sent", "message_id": "test-msg-123", "provider": "smtp"}):
        email_res = client.post(
            "/api/shortlisting/send-email",
            json={
                "application_ids": [app_id],
                "email_type": "shortlisted"
            }
        )
        assert email_res.status_code == 200
        email_summary = email_res.json()
        assert email_summary["requested"] == 1
        assert email_summary["sent"] == 1
        assert email_summary["failed"] == 0

    # Verify email_logs has an entry for this candidate
    logs_res = supabase.table("email_logs").select("*").eq("application_id", app_id).execute()
    assert logs_res.data is not None
    assert len(logs_res.data) > 0
    assert any(l["recipient"] == test_email for l in logs_res.data)
    assert any("Shortlisted" in l["subject"] or "Assessment" in l["subject"] for l in logs_res.data)

    # 10. HR Overrides Decision to Non-Shortlisted (Rejection with optional rejection email)
    with patch("app.services.email.smtp_provider.SMTPProvider.send_email", return_value=True):
        reject_res = client.post(
            f"/api/applications/{app_id}/shortlist-decision",
            json={
                "decision": "non_shortlisted",
                "reason": "Position filled by prior batch.",
                "send_rejection_email": True
            }
        )
        assert reject_res.status_code == 200
        assert reject_res.json()["decision"] == "non_shortlisted"

    # 11. Reconsider Non-Shortlisted Candidate back to Shortlisted
    reconsider_res = client.post(
        f"/api/applications/{app_id}/shortlist-decision",
        json={
            "decision": "shortlisted",
            "reason": "New internship headcount opened up in department."
        }
    )
    assert reconsider_res.status_code == 200
    assert reconsider_res.json()["decision"] == "shortlisted"

    # Verify decision history contains all 3 decision records
    hist_res = client.get(f"/api/applications/{app_id}/shortlist-history")
    assert hist_res.status_code == 200
    hist = hist_res.json()
    assert len(hist) >= 3

    print("[PASS] Full Step 21B workflow passed successfully!")

def test_rbacs_and_security():
    def mock_forbidden():
        raise HTTPException(status_code=403, detail="HR Admin role required.")

    # 1. Interviewer cannot access HR shortlisting decision endpoint
    app.dependency_overrides[require_hr_admin] = mock_forbidden
    res_forbidden = client.post(
        f"/api/applications/{str(uuid.uuid4())}/shortlist-decision",
        json={"decision": "shortlisted", "reason": "Test"}
    )
    assert res_forbidden.status_code == 403

    # 2. Public candidate cannot call HR bulk email endpoint
    res_bulk_forbidden = client.post(
        "/api/shortlisting/send-email",
        json={"all_shortlisted": True}
    )
    assert res_bulk_forbidden.status_code == 403

    # 3. Invalid skill verification token
    res_bad_token = client.get("/api/public/applications/skills/invalid.token.123")
    assert res_bad_token.status_code == 403

    print("[PASS] Step 21B RBAC and Token Security verified.")

if __name__ == "__main__":
    test_full_step21b_flow()
    test_rbacs_and_security()
    print("All Step 21B tests completed!")
