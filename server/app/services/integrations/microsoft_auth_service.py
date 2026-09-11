import os
import urllib.parse
import requests
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException
from app.services.integrations.credentials_vault import vault
from app.services.supabase_client import supabase

logger = logging.getLogger(__name__)

DEFAULT_MICROSOFT_SCOPES = [
    "Calendars.ReadWrite",
    "offline_access",
    "User.Read"
]

class MicrosoftAuthService:
    def __init__(self):
        self.client_id = os.getenv("MICROSOFT_CLIENT_ID", "")
        self.client_secret = os.getenv("MICROSOFT_CLIENT_SECRET", "")
        self.tenant_id = os.getenv("MICROSOFT_TENANT_ID", "common")
        self.redirect_uri = os.getenv("MICROSOFT_REDIRECT_URI", "http://localhost:8000/api/integrations/microsoft/callback")
        self.scopes = DEFAULT_MICROSOFT_SCOPES

    @property
    def auth_url(self) -> str:
        return f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/authorize"

    @property
    def token_url(self) -> str:
        return f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"

    def get_authorization_url(self, redirect_uri: Optional[str] = None, state: Optional[str] = None) -> str:
        """Generates Microsoft Graph OAuth 2.0 authorization URL."""
        if not self.client_id:
            logger.warning("MICROSOFT_CLIENT_ID is not configured in .env")

        r_uri = redirect_uri or self.redirect_uri
        params = {
            "client_id": self.client_id or "mock-microsoft-client-id",
            "redirect_uri": r_uri,
            "response_type": "code",
            "scope": " ".join(self.scopes),
            "response_mode": "query",
            "prompt": "consent",
            "state": state or "microsoft_auth_state"
        }
        return f"{self.auth_url}?{urllib.parse.urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: Optional[str] = None, connected_by: Optional[str] = None) -> Dict[str, Any]:
        """Exchanges authorization code for Microsoft Graph tokens and saves them in vault."""
        r_uri = redirect_uri or self.redirect_uri

        if code.startswith("mock_") or not self.client_secret:
            account_email = "hr.admin@outlook.com"
            access_token = f"mock_microsoft_access_token_{code}"
            refresh_token = f"mock_microsoft_refresh_token_{code}"
            expiry = (datetime.utcnow() + timedelta(hours=1)).isoformat()
            vault.save_credentials(
                provider="microsoft",
                account_email=account_email,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expiry=expiry,
                granted_scopes=self.scopes,
                connected_by=connected_by
            )
            self._log_audit(connected_by, account_email)
            return {"account_email": account_email, "scopes": self.scopes}

        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "redirect_uri": r_uri,
            "grant_type": "authorization_code",
            "scope": " ".join(self.scopes)
        }

        try:
            res = requests.post(self.token_url, data=payload, timeout=15)
            if res.status_code != 200:
                logger.error(f"Microsoft token exchange failed: {res.text}")
                raise HTTPException(status_code=400, detail="Failed to exchange authorization code with Microsoft.")

            token_data = res.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 3600)
            expiry = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
            granted_scopes = token_data.get("scope", "").split() or self.scopes

            # Fetch account email from Microsoft Graph /me
            account_email = "connected-user@company.com"
            me_res = requests.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10
            )
            if me_res.status_code == 200:
                me_data = me_res.json()
                account_email = me_data.get("mail") or me_data.get("userPrincipalName", account_email)

            vault.save_credentials(
                provider="microsoft",
                account_email=account_email,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expiry=expiry,
                granted_scopes=granted_scopes,
                connected_by=connected_by
            )

            self._log_audit(connected_by, account_email)
            return {"account_email": account_email, "scopes": granted_scopes}

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Microsoft exchange error: {e}")
            raise HTTPException(status_code=500, detail="Microsoft authentication failed.")

    def get_valid_access_token(self, connected_by: Optional[str] = None) -> str:
        """Returns active access token, refreshing if needed."""
        creds = vault.get_credentials("microsoft", connected_by)
        if not creds or not creds.get("is_active"):
            raise HTTPException(status_code=400, detail="Outlook Calendar integration is not connected. Please connect Microsoft in Settings.")

        access_token = creds.get("access_token")
        refresh_token = creds.get("refresh_token")
        token_expiry_str = creds.get("token_expiry")

        is_expired = False
        if token_expiry_str:
            try:
                expiry_dt = datetime.fromisoformat(token_expiry_str.replace("Z", "+00:00")).replace(tzinfo=None)
                if datetime.utcnow() >= (expiry_dt - timedelta(minutes=2)):
                    is_expired = True
            except Exception:
                pass

        if not is_expired and access_token:
            return access_token

        if not refresh_token:
            if access_token:
                return access_token
            raise HTTPException(status_code=400, detail="Microsoft connection expired. Please reconnect your account.")

        if refresh_token.startswith("mock_"):
            new_expiry = (datetime.utcnow() + timedelta(hours=1)).isoformat()
            vault.save_credentials(
                provider="microsoft",
                account_email=creds.get("account_email", "hr.admin@outlook.com"),
                access_token=f"mock_refreshed_ms_access_token_{datetime.utcnow().timestamp()}",
                refresh_token=refresh_token,
                token_expiry=new_expiry,
                granted_scopes=creds.get("granted_scopes", self.scopes),
                connected_by=connected_by
            )
            return f"mock_refreshed_ms_access_token_{datetime.utcnow().timestamp()}"

        refresh_payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
            "scope": " ".join(self.scopes)
        }

        try:
            res = requests.post(self.token_url, data=refresh_payload, timeout=15)
            if res.status_code != 200:
                logger.error(f"Microsoft token refresh failed: {res.text}")
                raise HTTPException(status_code=400, detail="Microsoft token refresh failed. Please reconnect.")

            data = res.json()
            new_access_token = data.get("access_token")
            expires_in = data.get("expires_in", 3600)
            new_expiry = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()

            vault.save_credentials(
                provider="microsoft",
                account_email=creds.get("account_email"),
                access_token=new_access_token,
                refresh_token=refresh_token,
                token_expiry=new_expiry,
                granted_scopes=creds.get("granted_scopes", self.scopes),
                connected_by=connected_by
            )
            return new_access_token
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to refresh Microsoft token: {e}")
            raise HTTPException(status_code=500, detail="Failed to refresh Microsoft access token.")

    def _log_audit(self, user_id: Optional[str], email: str):
        try:
            supabase.table("audit_logs").insert({
                "action": "MICROSOFT_INTEGRATION_CONNECTED",
                "hr_user": user_id,
                "metadata": {"account_email": email}
            }).execute()
        except Exception:
            pass

microsoft_auth_service = MicrosoftAuthService()
