import os
from .base import BaseEmailProvider
from .gmail_provider import GmailProvider
from .smtp_provider import SMTPProvider

class EmailService:
    @staticmethod
    def get_provider() -> BaseEmailProvider:
        # Default transport is Gmail API
        provider_name = os.environ.get("EMAIL_PROVIDER", "gmail").lower()
        
        if provider_name == "smtp":
            return SMTPProvider()
        return GmailProvider()
