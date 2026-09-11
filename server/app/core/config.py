import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    APP_ENV: str = os.getenv("APP_ENV", "development")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL")
    SUPABASE_SECRET_KEY: str = os.getenv("SUPABASE_SECRET_KEY")
    SUPABASE_PUBLISHABLE_KEY: str = os.getenv("SUPABASE_PUBLISHABLE_KEY")

    # Assessment Integrity Feature Flags
    ASSESSMENT_FULLSCREEN_REQUIRED: bool = os.getenv("ASSESSMENT_FULLSCREEN_REQUIRED", "true").lower() == "true"
    ASSESSMENT_COPY_PASTE_DISABLED: bool = os.getenv("ASSESSMENT_COPY_PASTE_DISABLED", "true").lower() == "true"
    ASSESSMENT_TAB_SWITCH_TRACKING: bool = os.getenv("ASSESSMENT_TAB_SWITCH_TRACKING", "true").lower() == "true"
    ASSESSMENT_TAB_SWITCH_REVIEW_THRESHOLD: int = int(os.getenv("ASSESSMENT_TAB_SWITCH_REVIEW_THRESHOLD", "3"))

    # Question Timer
    ASSESSMENT_QUESTION_TIME_SECONDS: int = int(os.getenv("ASSESSMENT_QUESTION_TIME_SECONDS", "30"))

    # Integrity Penalty Policy
    INTEGRITY_WARNING_LIMIT: int          = int(os.getenv("INTEGRITY_WARNING_LIMIT", "2"))
    INTEGRITY_TAB_SWITCH_PENALTY: int     = int(os.getenv("INTEGRITY_TAB_SWITCH_PENALTY", "2"))
    INTEGRITY_FULLSCREEN_EXIT_PENALTY: int = int(os.getenv("INTEGRITY_FULLSCREEN_EXIT_PENALTY", "2"))
    INTEGRITY_COPY_ATTEMPT_PENALTY: int   = int(os.getenv("INTEGRITY_COPY_ATTEMPT_PENALTY", "1"))
    INTEGRITY_PASTE_ATTEMPT_PENALTY: int  = int(os.getenv("INTEGRITY_PASTE_ATTEMPT_PENALTY", "1"))
    INTEGRITY_CUT_ATTEMPT_PENALTY: int    = int(os.getenv("INTEGRITY_CUT_ATTEMPT_PENALTY", "1"))
    INTEGRITY_MAX_PENALTY: int            = int(os.getenv("INTEGRITY_MAX_PENALTY", "15"))
    INTEGRITY_DEDUP_WINDOW_SECONDS: int   = int(os.getenv("INTEGRITY_DEDUP_WINDOW_SECONDS", "3"))

    def validate(self):
        missing = []
        if not self.SUPABASE_URL:
            missing.append("SUPABASE_URL")
        if not self.SUPABASE_SECRET_KEY:
            missing.append("SUPABASE_SECRET_KEY")
        
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

settings = Settings()
try:
    settings.validate()
except ValueError as e:
    import logging
    logging.error(f"Configuration error: {e}")
    # We do not exit here to allow the app to boot and health checks to fail gracefully
