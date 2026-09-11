from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.dependencies.auth import require_hr_admin
from app.schemas.ml import MLModelInfoResponse, MLEvaluationResponse, MLBatchEvaluationResponse
from app.services.ml_model_service import MLModelService
from app.services.ml_evaluation_service import MLEvaluationService

router = APIRouter()
eval_service = MLEvaluationService()

@router.get("/info", response_model=MLModelInfoResponse)
def get_model_info(current_user = Depends(require_hr_admin)):
    """HR Admin only."""
    return eval_service.get_model_info()

@router.post("/evaluate/{application_id}", response_model=MLEvaluationResponse)
def evaluate_application(application_id: str, rescore: bool = False, current_user = Depends(require_hr_admin)):
    """HR Admin only."""
    return eval_service.evaluate_application(application_id, rescore=rescore)

@router.get("/evaluations/{application_id}", response_model=List[MLEvaluationResponse])
def get_evaluations(application_id: str, current_user = Depends(require_hr_admin)):
    """HR Admin only."""
    return eval_service.get_evaluations(application_id)

@router.get("/evaluations/position/{position_id}", response_model=List[MLEvaluationResponse])
def get_evaluations_for_position(position_id: str, current_user = Depends(require_hr_admin)):
    """HR Admin only."""
    return eval_service.get_evaluations_for_position(position_id)

@router.post("/evaluate-position/{position_id}", response_model=MLBatchEvaluationResponse)
def evaluate_position(position_id: str, rescore: bool = False, current_user = Depends(require_hr_admin)):
    """HR Admin only."""
    return eval_service.evaluate_position(position_id, rescore=rescore)
