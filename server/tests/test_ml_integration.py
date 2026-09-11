import os
import sys
import pytest
from unittest import mock
from fastapi import HTTPException
from uuid import uuid4
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from ml.training.model_factory import build_candidate_pipelines
from app.services.skill_matching_service import SkillMatchingService
from app.services.ml_model_service import MLModelService
from app.services.ml_evaluation_service import MLEvaluationService

def test_skill_matching():
    candidate_skills = ["react", "Node.JS", "SQL", "HTML"]
    required_skills = ["React", "Python", "SQL"]
    preferred_skills = ["Git", "HTML"]
    
    matching, missing = SkillMatchingService.match_skills(candidate_skills, required_skills, preferred_skills)
    
    assert "React" in matching
    assert "SQL" in matching
    assert "HTML" in matching
    assert "Python" in missing
    assert "Git" not in missing # It's preferred, not required
    assert "Node.JS" not in matching # Not in req or pref

@pytest.fixture
def mock_ml_service():
    with mock.patch("app.services.ml_model_service.os.environ.get") as mock_env:
        # Prevent it from actually loading a model from disk
        mock_env.side_effect = lambda k: "mock" if k in ["ML_MODEL_VERSION", "ML_MODEL_PATH", "ML_MODEL_METADATA_PATH"] else None
        
        service = MLModelService()
        service.available = True
        service.version = "resume_classifier_v1"
        service.model = mock.MagicMock()
        service.model.predict.return_value = ["good_intern"]
        service.model.predict_proba.return_value = [[0.2, 0.8]]
        service.model.classes_ = ["bad_intern", "good_intern"]
        
        return service

@pytest.fixture
def mock_supabase():
    with mock.patch("app.services.ml_evaluation_service.supabase") as mock_sb:
        yield mock_sb

def test_evaluate_application_withdrawn(mock_ml_service, mock_supabase):
    eval_service = MLEvaluationService()
    eval_service.ml_service = mock_ml_service
    
    # Mock supabase application fetch
    mock_app_response = mock.MagicMock()
    mock_app_response.data = {"current_status": "withdrawn"}
    mock_supabase.table().select().eq().single().execute.return_value = mock_app_response
    
    with pytest.raises(HTTPException) as excinfo:
        eval_service.evaluate_application(str(uuid4()))
        
    assert excinfo.value.status_code == 400
    assert "withdrawn" in excinfo.value.detail

def test_evaluate_application_success(mock_ml_service, mock_supabase):
    eval_service = MLEvaluationService()
    eval_service.ml_service = mock_ml_service
    
    # We must patch _fetch_resume_text since we don't want to hit storage
    with mock.patch.object(eval_service, '_fetch_resume_text', return_value="Sample resume text"):
        
        # 1st select: Application
        mock_app_data = {
            "application_id": str(uuid4()),
            "position_id": str(uuid4()),
            "current_status": "under_review",
            "resume_url": "test.pdf",
            "skills": ["python"],
            "experience": [],
            "projects": []
        }
        
        # 2nd select: Job
        mock_job_data = {
            "position_id": mock_app_data["position_id"],
            "status": "active",
            "required_skills": ["python", "sql"],
            "preferred_skills": []
        }
        
        # We need to chain the supabase mocks
        # table("applications").select("*").eq("application_id", id).single().execute()
        # This is tough to mock exactly without a fake client, but we can do a side_effect
        
        def mock_table(name):
            chain = mock.MagicMock()
            if name == "applications":
                chain.select().eq().single().execute.return_value.data = mock_app_data
            elif name == "job_requirements":
                chain.select().eq().single().execute.return_value.data = mock_job_data
            elif name == "ml_evaluations":
                chain.insert().execute.return_value.data = [{
                    "evaluation_id": str(uuid4()),
                    "application_id": mock_app_data["application_id"],
                    "position_id": mock_app_data["position_id"],
                    "model_version": "resume_classifier_v1",
                    "predicted_class": "good_intern",
                    "match_score": 0.8,
                    "matching_skills": ["python"],
                    "missing_skills": ["sql"],
                    "recommendation": "Mocked",
                    "evaluated_at": datetime.utcnow().isoformat()
                }]
            return chain
            
        mock_supabase.table.side_effect = mock_table
        
        res = eval_service.evaluate_application(mock_app_data["application_id"])
        
        assert res.predicted_class == "good_intern"
        assert res.match_score == 0.8
        assert "python" in res.matching_skills
        assert "sql" in res.missing_skills
