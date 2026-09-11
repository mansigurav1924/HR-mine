import os
import json
import base64
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from app.services.supabase_client import supabase

logger = logging.getLogger(__name__)

class CredentialsVault:
    def __init__(self):
        # Derive a 32-byte encryption key from backend secret key
        raw_secret = os.getenv("CREDENTIAL_VAULT_KEY") or os.getenv("SUPABASE_SECRET_KEY", "antigravity-secure-default-vault-secret-key-32b")
        salt = b"hr_recruitment_integrations_salt_v1"
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        derived_key = base64.urlsafe_b64encode(kdf.derive(raw_secret.encode()))
        self.fernet = Fernet(derived_key)
        self.fallback_file = os.path.join(os.path.dirname(__file__), "..", "..", "..", ".credentials_vault.enc")

    def _encrypt(self, text: Optional[str]) -> Optional[str]:
        if not text:
            return None
        return self.fernet.encrypt(text.encode()).decode()

    def _decrypt(self, cipher_text: Optional[str]) -> Optional[str]:
        if not cipher_text:
            return None
        try:
            return self.fernet.decrypt(cipher_text.encode()).decode()
        except Exception as e:
            logger.error(f"Failed to decrypt credential token: {e}")
            return None

    def _read_fallback(self) -> Dict[str, Any]:
        if not os.path.exists(self.fallback_file):
            return {}
        try:
            with open(self.fallback_file, "r") as f:
                enc_data = f.read().strip()
                if not enc_data:
                    return {}
                dec_data = self.fernet.decrypt(enc_data.encode()).decode()
                return json.loads(dec_data)
        except Exception:
            return {}

    def _write_fallback(self, data: Dict[str, Any]):
        try:
            payload = json.dumps(data)
            enc_data = self.fernet.encrypt(payload.encode()).decode()
            with open(self.fallback_file, "w") as f:
                f.write(enc_data)
        except Exception as e:
            logger.warning(f"Failed to write fallback credentials vault: {e}")

    def save_credentials(
        self,
        provider: str,
        account_email: str,
        access_token: str,
        refresh_token: Optional[str] = None,
        token_expiry: Optional[str] = None,
        granted_scopes: Optional[List[str]] = None,
        connected_by: Optional[str] = None
    ) -> bool:
        """Stores OAuth credentials encrypted at rest."""
        enc_access = self._encrypt(access_token)
        enc_refresh = self._encrypt(refresh_token) if refresh_token else None

        db_saved = False
        try:
            # Check existing
            query = supabase.table("integration_credentials").select("integration_id, refresh_token").eq("provider", provider)
            if connected_by:
                query = query.eq("connected_by", connected_by)
            existing = query.execute()

            # Preserve previous refresh token if new one is omitted by OAuth provider
            if existing.data and not enc_refresh:
                enc_refresh = existing.data[0].get("refresh_token")

            record = {
                "provider": provider,
                "account_email": account_email,
                "access_token": enc_access,
                "refresh_token": enc_refresh,
                "token_expiry": token_expiry,
                "granted_scopes": granted_scopes or [],
                "connected_by": connected_by,
                "is_active": True,
                "updated_at": datetime.utcnow().isoformat()
            }

            if existing.data:
                supabase.table("integration_credentials").update(record).eq("integration_id", existing.data[0]["integration_id"]).execute()
            else:
                supabase.table("integration_credentials").insert(record).execute()
            db_saved = True
        except Exception as e:
            logger.info(f"Database integration_credentials storage deferred/fallback: {e}")

        # Always maintain encrypted fallback vault for seamless local/test operation
        vault_data = self._read_fallback()
        key = f"{provider}:{connected_by or 'global'}"
        vault_data[key] = {
            "provider": provider,
            "account_email": account_email,
            "access_token": access_token,
            "refresh_token": refresh_token or (vault_data.get(key, {}).get("refresh_token")),
            "token_expiry": token_expiry,
            "granted_scopes": granted_scopes or [],
            "connected_by": connected_by,
            "is_active": True,
            "updated_at": datetime.utcnow().isoformat()
        }
        self._write_fallback(vault_data)
        return True

    def get_credentials(self, provider: str, connected_by: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Retrieves and decrypts credentials for a provider."""
        # 1. Try DB
        try:
            query = supabase.table("integration_credentials").select("*").eq("provider", provider).eq("is_active", True)
            if connected_by:
                query = query.eq("connected_by", connected_by)
            res = query.order("updated_at", desc=True).limit(1).execute()
            if res.data:
                row = res.data[0]
                return {
                    "provider": row["provider"],
                    "account_email": row.get("account_email"),
                    "access_token": self._decrypt(row.get("access_token")),
                    "refresh_token": self._decrypt(row.get("refresh_token")),
                    "token_expiry": row.get("token_expiry"),
                    "granted_scopes": row.get("granted_scopes") or [],
                    "connected_by": row.get("connected_by"),
                    "is_active": row.get("is_active", True)
                }
        except Exception:
            pass

        # 2. Try Fallback vault
        vault_data = self._read_fallback()
        key = f"{provider}:{connected_by or 'global'}"
        if key in vault_data and vault_data[key].get("is_active"):
            return vault_data[key]
        
        # Check global key for provider
        alt_key = f"{provider}:global"
        if alt_key in vault_data and vault_data[alt_key].get("is_active"):
            return vault_data[alt_key]

        return None

    def delete_credentials(self, provider: str, connected_by: Optional[str] = None) -> bool:
        """Deactivates/removes integration credentials."""
        try:
            query = supabase.table("integration_credentials").update({"is_active": False}).eq("provider", provider)
            if connected_by:
                query = query.eq("connected_by", connected_by)
            query.execute()
        except Exception:
            pass

        vault_data = self._read_fallback()
        key = f"{provider}:{connected_by or 'global'}"
        if key in vault_data:
            vault_data[key]["is_active"] = False
        alt_key = f"{provider}:global"
        if alt_key in vault_data:
            vault_data[alt_key]["is_active"] = False
        self._write_fallback(vault_data)
        return True

    def get_status(self, provider: str, connected_by: Optional[str] = None) -> Dict[str, Any]:
        """Returns safe connection metadata without secret tokens."""
        creds = self.get_credentials(provider, connected_by)
        if not creds or not creds.get("is_active"):
            return {
                "provider": provider,
                "connected": False,
                "account_email": None,
                "granted_scopes": [],
                "token_expiry": None
            }
        return {
            "provider": provider,
            "connected": True,
            "account_email": creds.get("account_email"),
            "granted_scopes": creds.get("granted_scopes", []),
            "token_expiry": creds.get("token_expiry")
        }

vault = CredentialsVault()
