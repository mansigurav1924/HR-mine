import os
import sys
import uuid
import asyncio
import tempfile
import logging
from jinja2 import Environment, select_autoescape
from app.services.supabase_client import supabase

logger = logging.getLogger(__name__)

def _generate_pdf_worker(html_content: str) -> bytes:
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.set_content(html_content, wait_until="networkidle", timeout=3000)
        except Exception:
            page.set_content(html_content, wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        pdf_bytes = page.pdf(
            format="A4", 
            print_background=True, 
            margin={"top": "0px", "right": "0px", "bottom": "0px", "left": "0px"}
        )
        browser.close()
        return pdf_bytes

class PDFService:
    @staticmethod
    def render_html(template_str: str, data: dict) -> str:
        # Use Jinja2 to safely render the HTML with candidate values
        env = Environment(autoescape=select_autoescape(['html', 'xml']))
        template = env.from_string(template_str)
        rendered_html = template.render(**data)
        return rendered_html

    @staticmethod
    async def generate_pdf(html_content: str) -> bytes:
        return await asyncio.to_thread(_generate_pdf_worker, html_content)

    @staticmethod
    async def upload_pdf_to_storage(pdf_buffer: bytes, candidate_name: str, application_id: str) -> str:
        """
        Uploads a PDF buffer to the private offer-pdfs bucket in Supabase.
        Returns the storage path.
        """
        try:
            bucket_name = "offer-pdfs"
            file_name = f"{application_id}_{candidate_name.replace(' ', '_')}_{uuid.uuid4().hex[:8]}.pdf"
            
            # Supabase Python client handles bytes directly
            res = supabase.storage.from_(bucket_name).upload(
                path=file_name,
                file=pdf_buffer,
                file_options={"content-type": "application/pdf"}
            )
            
            # The python SDK returns the Response object or raises an exception if error
            return file_name
        except Exception as e:
            logger.error(f"Error uploading PDF to storage: {str(e)}")
            raise

    @staticmethod
    async def download_pdf_from_storage(file_path: str) -> bytes:
        """
        Downloads the PDF buffer from the private bucket.
        """
        try:
            bucket_name = "offer-pdfs"
            res = supabase.storage.from_(bucket_name).download(file_path)
            return res
        except Exception as e:
            logger.error(f"Error downloading PDF: {str(e)}")
            raise
