from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from app.dependencies.auth import require_hr_admin
from app.schemas.shortlisting import (
    ShortlistingDecisionRequest, ShortlistingDecisionResponse,
    BulkShortlistEmailRequest, BulkEmailResponse
)
from app.services.shortlisting_service import ShortlistingService

router = APIRouter(tags=["Shortlisting"])
service = ShortlistingService()

@router.post("/api/applications/{application_id}/shortlist-decision", response_model=ShortlistingDecisionResponse)
def create_decision(
    application_id: str,
    request: ShortlistingDecisionRequest,
    current_user = Depends(require_hr_admin)
):
    """HR Admin only. Applies shortlist or non_shortlist decision, enforces reason and optional candidate rejection email."""
    return service.create_decision(application_id, str(current_user.id), request)

@router.get("/api/applications/{application_id}/shortlist-history", response_model=List[ShortlistingDecisionResponse])
def get_history(
    application_id: str,
    current_user = Depends(require_hr_admin)
):
    """HR Admin only. Returns decision audit trail for an application."""
    return service.get_history(application_id)

@router.get("/api/shortlisting/pending")
def get_pending(current_user = Depends(require_hr_admin)):
    """HR Admin only. Returns candidate applications awaiting HR shortlisting decision."""
    return service.get_pending()

@router.get("/api/shortlisting/shortlisted")
def get_shortlisted(current_user = Depends(require_hr_admin)):
    """HR Admin only. Returns candidates with current_status == 'shortlisted'."""
    return service.get_decided("shortlisted")

@router.get("/api/shortlisting/non-shortlisted")
def get_non_shortlisted(current_user = Depends(require_hr_admin)):
    """HR Admin only. Returns candidates with current_status == 'non_shortlisted'."""
    return service.get_decided("non_shortlisted")

# Backward compatibility routes
@router.get("/shortlisted")
def get_shortlisted_compat(current_user = Depends(require_hr_admin)):
    return service.get_decided("shortlisted")

@router.get("/non-shortlisted")
def get_non_shortlisted_compat(current_user = Depends(require_hr_admin)):
    return service.get_decided("non_shortlisted")

@router.post("/api/shortlisting/send-email", response_model=BulkEmailResponse)
def send_bulk_shortlist_emails(
    request: BulkShortlistEmailRequest,
    current_user = Depends(require_hr_admin)
):
    """HR Admin only. Sends individual, confidential shortlist invitation emails with candidate-specific assessment tokens."""
    return service.send_bulk_shortlist_emails(request, str(current_user.id))
