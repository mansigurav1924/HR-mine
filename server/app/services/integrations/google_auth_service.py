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

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

DEFAULT_SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email"
]

class GoogleAuthService:
    def __init__(self):
        self.client_id = os.getenv("GOOGLE_CLIENT_ID", "")
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
        self.redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/integrations/google/callback")
        self.scopes = os.getenv("GOOGLE_OAUTH_SCOPES", " ".join(DEFAULT_SCOPES)).split()

    def get_authorization_url(self, redirect_uri: Optional[str] = None, state: Optional[str] = None) -> str:
        """Generates Google OAuth 2.0 authorization URL."""
        if not self.client_id:
            # For development when credentials not yet set in .env
            logger.warning("GOOGLE_CLIENT_ID is not configured in .env")

        r_uri = redirect_uri or self.redirect_uri
        params = {
            "client_id": self.client_id or "mock-google-client-id",
            "redirect_uri": r_uri,
            "response_type": "code",
            "scope": " ".join(self.scopes),
            "access_type": "offline",
            "prompt": "consent",
            "state": state or "google_auth_state"
        }
        return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: Optional[str] = None, connected_by: Optional[str] = None) -> Dict[str, Any]:
        """Exchanges authorization code for tokens and saves them in credentials vault."""
        r_uri = redirect_uri or self.redirect_uri

        # If dummy or mock code during test/dev
        if code.startswith("mock_") or not self.client_secret:
            account_email = "hr.admin@company.com"
            access_token = f"mock_google_access_token_{code}"
            refresh_token = f"mock_google_refresh_token_{code}"
            expiry = (datetime.utcnow() + timedelta(hours=1)).isoformat()
            vault.save_credentials(
                provider="google",
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
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": r_uri,
            "grant_type": "authorization_code"
        }

        try:
            res = requests.post(GOOGLE_TOKEN_URL, data=payload, timeout=15)
            if res.status_code != 200:
                logger.error(f"Google token exchange failed: {res.text}")
                raise HTTPException(status_code=400, detail="Failed to exchange authorization code with Google.")

            token_data = res.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 3600)
            expiry = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
            granted_scopes = token_data.get("scope", "").split() or self.scopes

            # Fetch user email
            account_email = "connected-user@company.com"
            user_res = requests.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10
            )
            if user_res.status_code == 200:
                account_email = user_res.json().get("email", account_email)

            vault.save_credentials(
                provider="google",
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
            logger.error(f"Google exchange error: {e}")
            raise HTTPException(status_code=500, detail="Google authentication failed.")

    def get_valid_access_token(self, connected_by: Optional[str] = None) -> str:
        """Returns active access token, refreshing if needed."""
        creds = vault.get_credentials("google", connected_by)
        if not creds or not creds.get("is_active"):
            raise HTTPException(status_code=400, detail="Google integration is not connected. Please connect Google in Settings.")

        access_token = creds.get("access_token")
        refresh_token = creds.get("refresh_token")
        token_expiry_str = creds.get("token_expiry")

        # Check if expired
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

        # Attempt token refresh
        if not refresh_token:
            if access_token:
                return access_token
            raise HTTPException(status_code=400, detail="Google connection expired. Please reconnect your account.")

        if refresh_token.startswith("mock_"):
            new_expiry = (datetime.utcnow() + timedelta(hours=1)).isoformat()
            vault.save_credentials(
                provider="google",
                account_email=creds.get("account_email", "hr.admin@company.com"),
                access_token=f"mock_refreshed_access_token_{datetime.utcnow().timestamp()}",
                refresh_token=refresh_token,
                token_expiry=new_expiry,
                granted_scopes=creds.get("granted_scopes", self.scopes),
                connected_by=connected_by
            )
            return f"mock_refreshed_access_token_{datetime.utcnow().timestamp()}"

        refresh_payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }

        try:
            res = requests.post(GOOGLE_TOKEN_URL, data=refresh_payload, timeout=15)
            if res.status_code != 200:
                logger.error(f"Google token refresh failed: {res.text}")
                raise HTTPException(status_code=400, detail="Google token refresh failed. Please reconnect.")

            data = res.json()
            new_access_token = data.get("access_token")
            expires_in = data.get("expires_in", 3600)
            new_expiry = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()

            vault.save_credentials(
                provider="google",
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
            logger.error(f"Failed to refresh Google token: {e}")
            raise HTTPException(status_code=500, detail="Failed to refresh Google access token.")

    def _log_audit(self, user_id: Optional[str], email: str):
        try:
            supabase.table("audit_logs").insert({
                "action": "GOOGLE_INTEGRATION_CONNECTED",
                "hr_user": user_id,
                "metadata": {"account_email": email}
            }).execute()
        except Exception:
            pass

google_auth_service = GoogleAuthService()
