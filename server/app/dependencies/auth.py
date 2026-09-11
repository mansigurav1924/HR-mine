from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services.supabase_client import supabase

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        response = supabase.auth.get_user(token)
        if response and response.user:
            user = response.user
            # Ensure role is set on user object
            role = None
            if hasattr(user, "user_metadata") and user.user_metadata:
                role = user.user_metadata.get("role")
            if not role:
                try:
                    resp = supabase.table("users").select("role").eq("user_id", user.id).execute()
                    if resp.data and resp.data[0].get("role"):
                        role = resp.data[0]["role"]
                except Exception:
                    pass
            user.role = role or "hr_admin"
            return user

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_hr_admin(current_user = Depends(get_current_user)):
    user_role = getattr(current_user, "role", None)
    if user_role == "hr_admin":
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized. HR Admin only."
    )
