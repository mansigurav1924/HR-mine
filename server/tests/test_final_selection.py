from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app

client = TestClient(app)

def test_final_selection_requires_hr_admin():
    with patch("app.dependencies.auth.supabase.auth.get_user") as mock_get_user, \
         patch("app.dependencies.auth.supabase.table") as mock_table:
        
        mock_get_user.return_value = MagicMock(user=MagicMock(id="123", email="int@test.com", user_metadata={"role": "interviewer"}))
        
        # Mock role as interviewer
        mock_user_resp = MagicMock()
        mock_user_resp.execute.return_value = MagicMock(data=[{"role": "interviewer", "email": "int@test.com"}])
        mock_table.return_value.select.return_value.eq.return_value = mock_user_resp
        
        response = client.post(
            "/api/final-selection/app-123",
            headers={"Authorization": "Bearer mock-token"},
            json={"notes": "Great candidate"}
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "Not authorized. HR Admin only."

def test_final_selection_concurrency_conflict():
    with patch("app.dependencies.auth.supabase.auth.get_user") as mock_get_user, \
         patch("app.dependencies.auth.supabase.table") as mock_table, \
         patch("app.services.final_selection_service.supabase.table") as mock_service_table:
        
        mock_get_user.return_value = MagicMock(user=MagicMock(id="hr-1", email="hr@test.com", user_metadata={"role": "hr_admin"}))
        
        # Mock role as hr_admin
        mock_user_resp = MagicMock()
        mock_user_resp.execute.return_value = MagicMock(data=[{"role": "hr_admin", "email": "hr@test.com"}])
        mock_table.return_value.select.return_value.eq.return_value = mock_user_resp
        
        # Mock current_status as something other than interview_selected
        mock_app_resp = MagicMock()
        mock_app_resp.execute.return_value = MagicMock(data={"current_status": "ai_interview_completed"})
        mock_service_table.return_value.select.return_value.eq.return_value.single.return_value = mock_app_resp
        
        response = client.post(
            "/api/final-selection/app-123",
            headers={"Authorization": "Bearer mock-token"},
            json={"notes": "Ready for offer"}
        )
        assert response.status_code == 409
        assert "Concurrency conflict" in response.json()["detail"]
