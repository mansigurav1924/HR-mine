from typing import Optional
from .base import BaseEmailProvider
from app.services.integrations.gmail_service import gmail_service

class GmailProvider(BaseEmailProvider):
    """Email provider implementation utilizing Gmail API users.messages.send."""
    def __init__(self):
        self.service = gmail_service

    def send_email(
        self,
        to_email: str,
        subject: str,
        text_body: Optional[str] = None,
        html_body: Optional[str] = None,
        attachment_bytes: Optional[bytes] = None,
        attachment_name: Optional[str] = None,
        body: Optional[str] = None,
        **kwargs
    ) -> bool:
        resolved_text = text_body or body or ""
        resolved_html = html_body or f"<p>{resolved_text}</p>"
        res = self.service.send_email(
            to_email=to_email,
            subject=subject,
            text_body=resolved_text,
            html_body=resolved_html,
            attachment_bytes=attachment_bytes,
            attachment_name=attachment_name,
            **kwargs
        )
        return res
