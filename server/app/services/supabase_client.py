from supabase import create_client, Client
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

def get_supabase_client() -> Client | None:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        logger.error("Supabase credentials missing. Cannot initialize client.")
        return None
    try:
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {str(e)}")
        return None

# Singleton instance
supabase: Client | None = get_supabase_client()
