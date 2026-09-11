import pytest
import hashlib
import uuid
from unittest import mock
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.assessment import (
    AssessmentGenerateRequest, AnswerRequest, HROverrideRequest, CandidateAssessmentStateResponse
)
from app.services.assessment_service import AssessmentService
from app.services.candidate_token_service import CandidateTokenService
from app.services.supabase_client import supabase

client = TestClient(app)

def test_token_generation_and_hashing():
    service = CandidateTokenService()
    plaintext = "super_secret_token_123"
    token_hash = service._hash_token(plaintext)
    
    assert token_hash != plaintext
    assert token_hash == hashlib.sha256(plaintext.encode()).hexdigest()

def test_assessment_schemas():
    req = AssessmentGenerateRequest(question_count=20, pass_threshold=60.0)
    assert req.question_count == 20
    assert req.pass_threshold == 60.0
    
    ans = AnswerRequest(question_index=1, selected_option=2)
    assert ans.question_index == 1
    assert ans.selected_option == 2

@mock.patch("app.services.email.email_service.EmailService.get_provider")
def test_full_assessment_lifecycle(mock_email_provider):
    mock_email = mock.MagicMock()
    mock_email.send_email.return_value = {"success": True, "message_id": "test-msg-123"}
    mock_email_provider.return_value = mock_email

    service = AssessmentService()
    
    # 1. Setup candidate application in DB
    pos_res = supabase.table("job_requirements").select("position_id, position_title").limit(1).execute()
    pos_id = pos_res.data[0]["position_id"] if pos_res.data else None
    
    app_id = str(uuid.uuid4())
    cand_email = f"candidate_{app_id[:8]}@example.com"
    
    # Create application with shortlisted status and verified skills
    supabase.table("applications").insert({
        "application_id": app_id,
        "candidate_name": "Test Candidate",
        "email": cand_email,
        "position_id": pos_id,
        "position": "Full Stack Intern",
        "department": "Engineering",
        "skills": ["Python", "React.js", "PostgreSQL", "FastAPI"],
        "current_status": "shortlisted"
    }).execute()

    # 2. Non-shortlisted rejection test
    unshortlisted_id = str(uuid.uuid4())
    supabase.table("applications").insert({
        "application_id": unshortlisted_id,
        "candidate_name": "Unshortlisted Candidate",
        "email": f"unshortlisted_{unshortlisted_id[:8]}@example.com",
        "current_status": "application_received"
    }).execute()
    
    with pytest.raises(ValueError) as excinfo:
        service.generate_assessment(unshortlisted_id, AssessmentGenerateRequest(question_count=20))
    assert "only shortlisted candidates" in str(excinfo.value).lower()

    # 3. Assessment generation for shortlisted candidate
    gen_res = service.generate_assessment(app_id, AssessmentGenerateRequest(question_count=20, pass_threshold=60.0))
    assert gen_res is not None
    assert "assessment_id" in gen_res
    assessment_id = gen_res["assessment_id"]
    assert len(gen_res["questions_json"]) == 20

    # 4. Generate token and send Gmail invitation
    invite_res = service.generate_token_and_invite(assessment_id)
    assert invite_res["email_sent"] is True
    assert "assessment/" in invite_res["candidate_url"]
    
    # Verify Gmail invitation called with clean text (no ML/HR notes leak)
    assert mock_email.send_email.called
    call_args = mock_email.send_email.call_args[1]
    assert call_args["to_email"] == cand_email
    assert "good_intern" not in call_args["body_text"]
    assert "bad_intern" not in call_args["body_text"]
    assert invite_res["candidate_url"] in call_args["body_text"]

    plaintext_token = invite_res["candidate_url"].split("/assessment/")[1]

    # 5. Candidate portal: Check candidate state (No duplicate skills required)
    state_res = service.get_candidate_state(plaintext_token)
    assert state_res["candidate_name"] == "Test Candidate"
    assert state_res["total_questions"] == 20
    assert state_res["answered_count"] == 0
    assert state_res["completed"] is False
    assert "pending_skills" not in state_res.get("status", "")

    # 6. Candidate portal: Get Question 1 (One at a time, no correct answer leak)
    q1 = service.get_current_question(plaintext_token)
    assert q1["question_number"] == 1
    assert q1["total_questions"] == 20
    assert "question" in q1
    assert len(q1["options"]) == 4
    assert "correct_option" not in q1
    assert "is_correct" not in q1

    # 7. Answer Question 1 (Locks answer)
    ans1 = service.submit_answer(plaintext_token, AnswerRequest(question_index=1, selected_option=1))
    assert ans1["success"] is True

    # 8. Modifying locked answer is rejected
    with pytest.raises(ValueError) as err_modify:
        service.submit_answer(plaintext_token, AnswerRequest(question_index=1, selected_option=2))
    assert "already been answered" in str(err_modify.value).lower()

    # 9. Refresh simulation: resumes at Question 2
    q2 = service.get_current_question(plaintext_token)
    assert q2["question_number"] == 2
    assert q2["answered_count"] == 1

    # 10. Answer remaining 19 questions (2 to 20)
    for q_num in range(2, 21):
        service.submit_answer(plaintext_token, AnswerRequest(question_index=q_num, selected_option=1))

    # All questions answered -> ready_to_submit
    ready_check = service.get_current_question(plaintext_token)
    assert ready_check["ready_to_submit"] is True

    # 11. Submit Assessment (calculates score backend-side, hides raw score from candidate)
    submit_res = service.submit_assessment(plaintext_token)
    assert submit_res["completed"] is True
    assert "score" not in submit_res  # raw score is not leaked to candidate
    assert "Thank you for completing" in submit_res["message"] or "Assessment Completed" in submit_res["message"]
    
    # Check that Result Email was sent (called Gmail API)
    # The first call was generate_token_and_invite. The second is submit_assessment result email.
    assert mock_email.send_email.call_count == 2
    res_email_args = mock_email.send_email.call_args[1]
    assert res_email_args["to_email"] == cand_email
    assert "Assessment Result" in res_email_args["subject"]
    
    # 12. Token is now invalidated
    with pytest.raises(ValueError) as inv_err:
        service.get_candidate_state(plaintext_token)
    assert "already been completed" in str(inv_err.value).lower() or "revoked" in str(inv_err.value).lower()

    # 13. Application status updated in DB
    app_after = supabase.table("applications").select("current_status").eq("application_id", app_id).single().execute()
    assert app_after.data["current_status"] in ("assessment_passed", "assessment_failed")

    # 14. Retry Email Idempotency Test
    retry_res = service.retry_result_email(assessment_id)
    # The retry uses the same `_send_assessment_result_email` which checks logs. Since we mocked success, it should return 'sent'.
    # But wait, `_send_assessment_result_email` skips if status is 'sent', returning None, but `retry_result_email` reads the log which says 'sent'.
    assert retry_res["success"] is True
    assert retry_res["status"] == "sent"
    # Call count should still be 2 (no new email sent because it's idempotent)
    assert mock_email.send_email.call_count == 2


    # 14. HR Detail view (HR sees raw score, verified skills, and question breakdown)
    hr_detail = service.get_detail(assessment_id)
    assert hr_detail["candidate_name"] == "Test Candidate"
    assert hr_detail["score"] is not None
    assert len(hr_detail["verified_skills"]) > 0
    assert len(hr_detail["question_breakdown"]) == 20
    assert "correct_answer" in hr_detail["question_breakdown"][0]

    # 15. HR Override: Fail -> Pass or Pass -> Fail
    orig_result = hr_detail["result"]
    new_result = "fail" if orig_result == "pass" else "pass"
    override_res = service.override_result(
        assessment_id,
        HROverrideRequest(result=new_result, reason="HR Manual Evaluation Override"),
        admin_id=str(uuid.uuid4())
    )
    assert override_res["success"] is True

    # 16. If passed, send text interview invitation via Gmail (No calendar event)
    if new_result != "pass":
        service.override_result(
            assessment_id,
            HROverrideRequest(result="pass", reason="HR Pass for interview testing"),
            admin_id=str(uuid.uuid4())
        )
    
    interview_res = service.send_interview_invitation(app_id)
    assert interview_res["success"] is True
    assert "interview/" in interview_res["interview_url"]
    
    app_final = supabase.table("applications").select("current_status").eq("application_id", app_id).single().execute()
    assert app_final.data["current_status"] in ("ai_interview_invited", "interview_invited")
