from abc import ABC, abstractmethod
from typing import Optional

class BaseEmailProvider(ABC):
    @abstractmethod
    def send_email(self, to_email: str, subject: str, text_body: str, html_body: str, attachment_bytes: Optional[bytes] = None, attachment_name: Optional[str] = None) -> dict:
        """
        Sends an email and returns a dict with success, message_id, provider.
        Raises an Exception with a safe error message on failure.
        """
        pass
