import pytest
from fastapi import HTTPException
from app.api.applications import validate_resume_file, MAX_FILE_SIZE

def test_file_upload_validations():
    # 1. Valid PDF
    valid_pdf_content = b"%PDF-1.4 sample pdf content for resume parsing"
    ext = validate_resume_file("resume.pdf", valid_pdf_content, "application/pdf")
    assert ext == "pdf"

    # 2. Valid DOCX
    valid_docx_content = b"PK\x03\x04\x14\x00\x06\x00 sample docx content"
    ext = validate_resume_file("my_cv.docx", valid_docx_content, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    assert ext == "docx"

    # 3. Invalid Extension
    with pytest.raises(HTTPException) as exc_info:
        validate_resume_file("malicious_script.exe", b"MZ\x90\x00 binary", "application/x-msdownload")
    assert exc_info.value.status_code == 400
    assert "Only .pdf and .docx" in exc_info.value.detail

    # 4. Corrupted PDF (missing magic bytes)
    with pytest.raises(HTTPException) as exc_info:
        validate_resume_file("fake_resume.pdf", b"NOT_A_REAL_PDF header", "application/pdf")
    assert exc_info.value.status_code == 400
    assert "Corrupted or invalid PDF" in exc_info.value.detail

    # 5. Oversized File (> 5 MB)
    oversized_content = b"%PDF-" + b"0" * (MAX_FILE_SIZE + 100)
    with pytest.raises(HTTPException) as exc_info:
        validate_resume_file("large.pdf", oversized_content, "application/pdf")
    assert exc_info.value.status_code == 400
    assert "exceeds maximum allowed limit" in exc_info.value.detail

    print("[PASS] File upload signature, extension, and size security checks verified.")

if __name__ == "__main__":
    test_file_upload_validations()
