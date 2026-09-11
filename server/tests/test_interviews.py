from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app

client = TestClient(app)

def test_schedule_interview_requires_hr_admin():
    # Should block regular interviewer or user from hitting POST /api/interviews
    with patch("app.dependencies.auth.supabase.auth.get_user") as mock_get_user, \
         patch("app.dependencies.auth.supabase.table") as mock_table:
        
        mock_get_user.return_value = MagicMock(user=MagicMock(id="123", email="int@test.com", user_metadata={"role": "interviewer"}))
        
        mock_user_resp = MagicMock()
        mock_user_resp.execute.return_value = MagicMock(data=[{"role": "interviewer", "email": "int@test.com"}])
        mock_table.return_value.select.return_value.eq.return_value = mock_user_resp
        
        response = client.post(
            "/api/interviews/",
            headers={"Authorization": "Bearer mock-token"},
            json={
                "application_id": "app-123",
                "round_number": 1,
                "date": "2026-09-01",
                "time": "10:00:00",
                "interviewer_id": "int-1",
                "type": "Technical",
                "mode": "online",
                "meeting_link": "http://meet"
            }
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "Not authorized. HR Admin only."

def test_interviewer_access_denied_for_other_interviews():
    with patch("app.dependencies.auth.supabase.auth.get_user") as mock_get_user, \
         patch("app.dependencies.auth.supabase.table") as mock_table, \
         patch("app.services.interview_service.supabase.table") as mock_service_table:
        
        mock_get_user.return_value = MagicMock(user=MagicMock(id="int-1", email="int@test.com", user_metadata={"role": "interviewer"}))
        
        mock_user_resp = MagicMock()
        mock_user_resp.execute.return_value = MagicMock(data=[{"role": "interviewer", "email": "int@test.com"}])
        mock_table.return_value.select.return_value.eq.return_value = mock_user_resp
        
        # Mock the service returning an interview belonging to int-2
        mock_intv_resp = MagicMock()
        mock_intv_resp.execute.return_value = MagicMock(data={"interview_id": "i-123", "interviewer_id": "int-2", "application_id": "app-123"})
        mock_service_table.return_value.select.return_value.eq.return_value.single.return_value = mock_intv_resp
        
        response = client.get(
            "/api/interviews/i-123",
            headers={"Authorization": "Bearer mock-token"}
        )
        assert response.status_code == 403
        assert "Forbidden" in response.json()["detail"]
