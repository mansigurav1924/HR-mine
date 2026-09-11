import hmac
import os
import time
import secrets
import hashlib
from datetime import datetime, timedelta
from app.services.supabase_client import supabase
from typing import Optional, Dict, Any, Tuple

class CandidateTokenService:
    def __init__(self):
        self.default_ttl_hours = 72
        
    def _hash_token(self, token: str) -> str:
        """Computes SHA-256 hash of the plaintext token."""
        return hashlib.sha256(token.encode('utf-8')).hexdigest()

    def _get_signing_secret(self) -> str:
        return os.getenv("CANDIDATE_ACCESS_TOKEN_SECRET", os.getenv("SUPABASE_SECRET_KEY", "default-signing-secret-recruitment-key-12345"))

    def generate_token_for_stage(self, application_id: str, stage: str = "assessment", ttl_hours: Optional[int] = None) -> Tuple[str, str, datetime]:
        """Generates a secure candidate access token for a specific stage.
        Returns: (plaintext_token, token_id, expires_at)
        """
        if stage not in ("assessment", "ai_interview", "text_interview"):
            raise ValueError(f"Invalid candidate access stage: '{stage}'. Allowed: 'assessment', 'ai_interview', 'text_interview'.")

        ttl = ttl_hours or self.default_ttl_hours
        plaintext_token = secrets.token_urlsafe(32)
        token_hash = self._hash_token(plaintext_token)
        expires_at = datetime.utcnow() + timedelta(hours=ttl)
        
        response = supabase.table("candidate_access_tokens").insert({
            "application_id": application_id,
            "stage": stage,
            "token_hash": token_hash,
            "expires_at": expires_at.isoformat()
        }).execute()
        
        token_id = response.data[0]["token_id"]
        return plaintext_token, token_id, expires_at

    def generate_assessment_token(self, application_id: str) -> Tuple[str, str, datetime]:
        """Convenience alias for assessment stage token generation."""
        return self.generate_token_for_stage(application_id, stage="assessment", ttl_hours=self.default_ttl_hours)

    def resolve_token(self, plaintext_token: str, expected_stage: Optional[str] = None, allow_used: bool = False) -> Dict[str, Any]:
        """Validates and resolves a plaintext candidate token against database.
        Enforces stage isolation, expiration, revocation, completion, and withdrawal rules.
        """
        if not plaintext_token or len(plaintext_token.strip()) < 10:
            raise ValueError("This access link is invalid.")

        token_hash = self._hash_token(plaintext_token.strip())
        response = supabase.table("candidate_access_tokens").select("*").eq("token_hash", token_hash).execute()
        
        if not response.data:
            raise ValueError("This access link is no longer valid.")
            
        token = response.data[0]
        
        if token.get("revoked"):
            raise ValueError("This access link has been revoked.")
            
        if token.get("used_at") and not allow_used:
            raise ValueError("This stage has already been completed.")
            
        # Parse and check expiry
        raw_expires = token.get("expires_at")
        if raw_expires:
            try:
                from dateutil import parser
                expires_at = parser.parse(raw_expires)
                from datetime import timezone
                now_utc = datetime.now(timezone.utc)
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if now_utc > expires_at:
                    raise ValueError("This access link has expired.")
            except ValueError as ve:
                if "expired" in str(ve):
                    raise
                pass
            
        # Enforce stage isolation
        if expected_stage and token.get("stage") != expected_stage:
            raise ValueError(f"Invalid token stage. Expected '{expected_stage}' but found '{token.get('stage')}'.")
            
        # Verify associated application is valid and not withdrawn
        app_resp = supabase.table("applications").select("current_status").eq("application_id", token["application_id"]).execute()
        if not app_resp.data:
            raise ValueError("This access link is no longer valid.")
            
        status = app_resp.data[0].get("current_status")
        if status == "withdrawn":
            raise ValueError("This application has been withdrawn.")
            
        return token

    def invalidate_token(self, token_id: str):
        """Marks a candidate token as used/completed."""
        supabase.table("candidate_access_tokens").update({
            "used_at": datetime.utcnow().isoformat()
        }).eq("token_id", token_id).execute()

    def revoke_token(self, token_id: str):
        """Explicitly revokes a candidate token."""
        supabase.table("candidate_access_tokens").update({
            "revoked": True
        }).eq("token_id", token_id).execute()

    # ----------------------------------------------------
    # Skill Verification Token Support
    # ----------------------------------------------------
    def generate_skill_verification_token(self, application_id: str, ttl_hours: int = 72) -> str:
        """Generates a tamper-proof cryptographic token for post-application skill verification."""
        secret = self._get_signing_secret()
        expires_at = int(time.time()) + (ttl_hours * 3600)
        msg = f"{application_id}:{expires_at}:skill_verification"
        sig = hmac.new(secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()
        return f"{application_id}.{expires_at}.{sig}"

    def resolve_skill_verification_token(self, token: str) -> Dict[str, Any]:
        """Resolves and validates a skill verification token."""
        if not token or "." not in token:
            raise ValueError("This skill verification link is invalid.")

        parts = token.strip().split(".")
        if len(parts) != 3:
            raise ValueError("This skill verification link is invalid.")

        app_id, raw_exp, sig = parts
        try:
            exp = int(raw_exp)
        except ValueError:
            raise ValueError("This skill verification link is invalid.")

        secret = self._get_signing_secret()
        expected_msg = f"{app_id}:{exp}:skill_verification"
        expected_sig = hmac.new(secret.encode("utf-8"), expected_msg.encode("utf-8"), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(sig, expected_sig):
            raise ValueError("This skill verification link is invalid.")

        if time.time() > exp:
            raise ValueError("This skill verification link has expired.")

        # Query application
        app_resp = supabase.table("applications").select("*, job_requirements(*)").eq("application_id", app_id).single().execute()
        if not app_resp.data:
            raise ValueError("Application not found.")

        app_data = app_resp.data
        if app_data.get("current_status") == "withdrawn":
            raise ValueError("This application has been withdrawn.")

        return app_data
