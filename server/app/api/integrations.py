import os
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from typing import Optional
from app.dependencies.auth import require_hr_admin, get_current_user
from app.schemas.integrations import (
    IntegrationStatusResponse,
    AllIntegrationsStatusResponse,
    ConnectUrlResponse,
    DisconnectResponse
)
from app.services.integrations.credentials_vault import vault
from app.services.integrations.google_auth_service import google_auth_service
from app.services.integrations.microsoft_auth_service import microsoft_auth_service

router = APIRouter(prefix="/api/integrations", tags=["Integrations"])

@router.get("/status", response_model=AllIntegrationsStatusResponse)
def get_all_integrations_status(current_user = Depends(require_hr_admin)):
    """HR Admin only. Returns connection status for Google and Microsoft external integrations."""
    user_id = str(current_user.id)
    g_status = vault.get_status("google", user_id)
    m_status = vault.get_status("microsoft", user_id)
    return AllIntegrationsStatusResponse(
        google=IntegrationStatusResponse(**g_status),
        microsoft=IntegrationStatusResponse(**m_status)
    )

# --- GOOGLE OAUTH & GMAIL ---

@router.get("/google/connect", response_model=ConnectUrlResponse)
def google_connect(
    redirect_uri: Optional[str] = None,
    current_user = Depends(require_hr_admin)
):
    """HR Admin only. Returns Google OAuth 2.0 authorization URL for Gmail and Google Calendar."""
    auth_url = google_auth_service.get_authorization_url(redirect_uri=redirect_uri)
    return ConnectUrlResponse(provider="google", auth_url=auth_url)

@router.get("/google/callback")
def google_callback(
    code: Optional[str] = None,
    error: Optional[str] = None,
    state: Optional[str] = None,
    redirect_uri: Optional[str] = None
):
    """Callback endpoint for Google OAuth authorization code exchange."""
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip('/')
    if error or not code:
        return RedirectResponse(url=f"{frontend_url}/settings?integration_error={error or 'cancelled'}")

    try:
        google_auth_service.exchange_code(code=code, redirect_uri=redirect_uri)
        return RedirectResponse(url=f"{frontend_url}/settings?integration_success=google")
    except Exception as e:
        return RedirectResponse(url=f"{frontend_url}/settings?integration_error=failed")

@router.get("/google/status", response_model=IntegrationStatusResponse)
def google_status(current_user = Depends(require_hr_admin)):
    """HR Admin only. Returns Google integration connection status."""
    status_data = vault.get_status("google", str(current_user.id))
    return IntegrationStatusResponse(**status_data)

@router.post("/google/disconnect", response_model=DisconnectResponse)
def google_disconnect(current_user = Depends(require_hr_admin)):
    """HR Admin only. Disconnects Google integration."""
    vault.delete_credentials("google", str(current_user.id))
    return DisconnectResponse(provider="google", success=True, message="Google account disconnected successfully.")

# --- MICROSOFT GRAPH & OUTLOOK ---

@router.get("/microsoft/connect", response_model=ConnectUrlResponse)
def microsoft_connect(
    redirect_uri: Optional[str] = None,
    current_user = Depends(require_hr_admin)
):
    """HR Admin only. Returns Microsoft Graph OAuth 2.0 authorization URL for Outlook Calendar."""
    auth_url = microsoft_auth_service.get_authorization_url(redirect_uri=redirect_uri)
    return ConnectUrlResponse(provider="microsoft", auth_url=auth_url)

@router.get("/microsoft/callback")
def microsoft_callback(
    code: Optional[str] = None,
    error: Optional[str] = None,
    state: Optional[str] = None,
    redirect_uri: Optional[str] = None
):
    """Callback endpoint for Microsoft OAuth authorization code exchange."""
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip('/')
    if error or not code:
        return RedirectResponse(url=f"{frontend_url}/settings?integration_error={error or 'cancelled'}")

    try:
        microsoft_auth_service.exchange_code(code=code, redirect_uri=redirect_uri)
        return RedirectResponse(url=f"{frontend_url}/settings?integration_success=microsoft")
    except Exception as e:
        return RedirectResponse(url=f"{frontend_url}/settings?integration_error=failed")

@router.get("/microsoft/status", response_model=IntegrationStatusResponse)
def microsoft_status(current_user = Depends(require_hr_admin)):
    """HR Admin only. Returns Microsoft Graph integration connection status."""
    status_data = vault.get_status("microsoft", str(current_user.id))
    return IntegrationStatusResponse(**status_data)

@router.post("/microsoft/disconnect", response_model=DisconnectResponse)
def microsoft_disconnect(current_user = Depends(require_hr_admin)):
    """HR Admin only. Disconnects Microsoft Outlook Calendar integration."""
    vault.delete_credentials("microsoft", str(current_user.id))
    return DisconnectResponse(provider="microsoft", success=True, message="Microsoft Outlook Calendar disconnected successfully.")
