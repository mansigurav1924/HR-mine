import io
import os
import sys
import uuid
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app
from app.services.supabase_client import supabase

client = TestClient(app)

def test_list_public_jobs():
    response = client.get("/api/public/jobs")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        job = data[0]
        assert "position_id" in job
        assert "position" in job
        assert "department" in job
        assert "required_skills" in job
        # Verify internal fields are not exposed
        assert "share_prior_round_feedback" not in job
        assert "created_by" not in job
    print("[PASS] Public jobs listing verified.")

def test_get_public_job_by_id():
    # Fetch all jobs first
    jobs_res = client.get("/api/public/jobs")
    jobs = jobs_res.json()
    
    if len(jobs) > 0:
        pos_id = jobs[0]["position_id"]
        res = client.get(f"/api/public/jobs/{pos_id}")
        assert res.status_code == 200
        assert res.json()["position_id"] == pos_id
        assert "position" in res.json()

    # Invalid ID
    fake_id = str(uuid.uuid4())
    res_404 = client.get(f"/api/public/jobs/{fake_id}")
    assert res_404.status_code == 404
    print("[PASS] Public job detail and 404 handling verified.")

def test_public_application_validation_and_submission():
    # 1. Get a valid position
    jobs_res = client.get("/api/public/jobs")
    jobs = jobs_res.json()
    if not jobs:
        pytest.skip("No open jobs available for testing.")

    valid_pos_id = jobs[0]["position_id"]
    test_email = f"candidate_{uuid.uuid4().hex[:8]}@example.com"

    # 2. Missing consent -> 400
    res_no_consent = client.post(
        "/api/public/applications",
        data={
            "position_id": valid_pos_id,
            "full_name": "Test Candidate",
            "email": test_email,
            "phone": "+1234567890",
            "college": "Test University",
            "degree": "B.S. Computer Science",
            "current_year": "Senior",
            "skills": "Python, React, SQL",
            "consent_given": "false"
        },
        files={
            "resume": ("resume.pdf", b"%PDF-1.4 sample content", "application/pdf")
        }
    )
    assert res_no_consent.status_code == 400
    assert "Consent is required" in res_no_consent.json()["detail"]

    # 3. Invalid resume format -> 400
    res_bad_file = client.post(
        "/api/public/applications",
        data={
            "position_id": valid_pos_id,
            "full_name": "Test Candidate",
            "email": test_email,
            "phone": "+1234567890",
            "college": "Test University",
            "degree": "B.S. Computer Science",
            "skills": "Python, React, SQL",
            "consent_given": "true"
        },
        files={
            "resume": ("resume.exe", b"MZ\x90\x00 bad binary", "application/x-msdownload")
        }
    )
    assert res_bad_file.status_code == 400

    # 4. Valid Submission -> 200
    valid_pdf_content = b"%PDF-1.4 " + b"A" * 500
    res_success = client.post(
        "/api/public/applications",
        data={
            "position_id": valid_pos_id,
            "full_name": "Alice Candidate",
            "email": test_email,
            "phone": "+1234567890",
            "college": "MIT",
            "degree": "B.S. Computer Science",
            "current_year": "2026",
            "skills": "React, Python, TypeScript, Docker",
            "experience": "Software Engineering Intern at Startup",
            "projects": "Full Stack E-commerce Application",
            "github_url": "https://github.com/alice",
            "linkedin_url": "https://linkedin.com/in/alice",
            "consent_given": "true"
        },
        files={
            "resume": ("alice_resume.pdf", valid_pdf_content, "application/pdf")
        }
    )
    assert res_success.status_code == 200
    resp_json = res_success.json()
    assert resp_json["success"] is True
    assert "application_id" in resp_json
    app_id = resp_json["application_id"]

    # Verify directly in Supabase
    db_res = supabase.table("applications").select("*").eq("application_id", app_id).single().execute()
    assert db_res.data is not None
    app_data = db_res.data
    assert app_data["candidate_name"] == "Alice Candidate"
    assert app_data["email"] == test_email
    assert app_data["source"] == "website"
    assert app_data["current_status"] == "application_received"
    assert app_data["position_id"] == valid_pos_id
    assert "React" in app_data["skills"]
    assert "resume_url" in app_data and app_data["resume_url"].startswith("applications/")

    # 5. Duplicate Submission -> 409 Conflict
    res_duplicate = client.post(
        "/api/public/applications",
        data={
            "position_id": valid_pos_id,
            "full_name": "Alice Candidate",
            "email": test_email,
            "phone": "+1234567890",
            "college": "MIT",
            "degree": "B.S. Computer Science",
            "skills": "React, Python",
            "consent_given": "true"
        },
        files={
            "resume": ("alice_resume.pdf", valid_pdf_content, "application/pdf")
        }
    )
    assert res_duplicate.status_code == 409
    assert "already been received" in res_duplicate.json()["detail"]

    print("[PASS] Public candidate application submission and duplicate detection verified.")

if __name__ == "__main__":
    test_list_public_jobs()
    test_get_public_job_by_id()
    test_public_application_validation_and_submission()
    print("All Step 21A tests passed successfully!")
