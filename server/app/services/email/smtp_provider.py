import os
import smtplib
from email.message import EmailMessage
from typing import Optional
from .base import BaseEmailProvider

class SMTPProvider(BaseEmailProvider):
    def __init__(self):
        self.host = os.environ.get("SMTP_HOST", "")
        self.port = int(os.environ.get("SMTP_PORT", 587))
        self.username = os.environ.get("SMTP_USERNAME", "")
        self.password = os.environ.get("SMTP_PASSWORD", "")
        self.from_email = os.environ.get("SMTP_FROM_EMAIL", "no-reply@company.com")
        self.from_name = os.environ.get("SMTP_FROM_NAME", "HR Department")
        self.use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"

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
    ) -> dict:
        resolved_text = text_body or body or ""
        resolved_html = html_body or f"<p>{resolved_text}</p>"

        # Strip newlines to prevent header injection
        subject = subject.replace('\n', '').replace('\r', '')
        to_email = to_email.replace('\n', '').replace('\r', '')

        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = f"{self.from_name} <{self.from_email}>"
        msg['To'] = to_email
        
        msg.set_content(resolved_text)
        msg.add_alternative(resolved_html, subtype='html')

        if attachment_bytes and attachment_name:
            msg.add_attachment(
                attachment_bytes,
                maintype='application',
                subtype='pdf',
                filename=attachment_name
            )
        # Basic check to avoid hanging if not configured during local testing
        if not self.host:
            raise Exception("SMTP_HOST is not configured.")

        try:
            with smtplib.SMTP(self.host, self.port, timeout=15) as server:
                if self.use_tls:
                    server.starttls()
                
                if self.username and self.password:
                    server.login(self.username, self.password)
                    
                server.send_message(msg)
            return {"success": True, "provider": "smtp", "message_id": None}
        except smtplib.SMTPAuthenticationError:
            raise Exception("SMTP Authentication failed. Check credentials.")
        except smtplib.SMTPConnectError:
            raise Exception("Failed to connect to the SMTP server.")
        except TimeoutError:
            raise Exception("Connection to SMTP server timed out.")
        except Exception as e:
            # Mask full stack traces and sensitive info
            raise Exception(f"Failed to send email via SMTP: {str(e)[:100]}")
