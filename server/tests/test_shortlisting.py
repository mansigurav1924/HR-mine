import pytest
from unittest import mock
from fastapi import HTTPException
from uuid import uuid4

from app.schemas.shortlisting import ShortlistingDecisionRequest
from app.services.shortlisting_service import ShortlistingService

@pytest.fixture
def mock_supabase():
    with mock.patch("app.services.shortlisting_service.supabase") as mock_sb:
        yield mock_sb

def test_invalid_decision():
    service = ShortlistingService()
    req = ShortlistingDecisionRequest(decision="invalid", reason="test")
    
    with pytest.raises(HTTPException) as excinfo:
        service.create_decision(str(uuid4()), str(uuid4()), req)
        
    assert excinfo.value.status_code == 400

def test_missing_reason():
    service = ShortlistingService()
    with pytest.raises(ValueError):
        # Pydantic will catch this before the service logic
        ShortlistingDecisionRequest(decision="shortlisted", reason="")

def test_invalid_status_transition(mock_supabase):
    service = ShortlistingService()
    req = ShortlistingDecisionRequest(decision="shortlisted", reason="test reason")
    
    # Mock application status to be hired (invalid for shortlisting)
    mock_app_data = {"current_status": "hired"}
    mock_supabase.table().select().eq().single().execute.return_value.data = mock_app_data
    
    with pytest.raises(HTTPException) as excinfo:
        service.create_decision(str(uuid4()), str(uuid4()), req)
        
    assert excinfo.value.status_code == 400
    assert "Cannot apply shortlisting decision" in excinfo.value.detail

def test_successful_decision(mock_supabase):
    service = ShortlistingService()
    req = ShortlistingDecisionRequest(decision="shortlisted", reason="Valid reason")
    app_id = str(uuid4())
    hr_id = str(uuid4())
    
    def mock_table(name):
        chain = mock.MagicMock()
        if name == "applications":
            chain.select().eq().single().execute.return_value.data = {"current_status": "ml_evaluated"}
            chain.update().eq().eq().execute.return_value.data = [{"id": "updated"}]
        elif name == "ml_evaluations":
            chain.select().eq().order().limit().execute.return_value.data = [{"evaluation_id": str(uuid4()), "model_version": "v1", "predicted_class": "bad_intern"}]
        elif name == "shortlisting_decisions":
            chain.insert().execute.return_value.data = [{"decision_id": str(uuid4()), "application_id": app_id, "decision": "shortlisted", "reason": "Valid reason", "decided_by": hr_id, "decided_at": "2026-08-26T00:00:00Z", "created_at": "2026-08-26T00:00:00Z"}]
        elif name == "audit_logs":
            chain.insert().execute.return_value.data = []
        return chain
        
    mock_supabase.table.side_effect = mock_table
    
    # Note: ML predicted 'bad_intern', but HR chose 'shortlisted'. This override MUST succeed.
    res = service.create_decision(app_id, hr_id, req)
    
    assert res.decision == "shortlisted"
    assert res.reason == "Valid reason"
