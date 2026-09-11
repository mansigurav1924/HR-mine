import fitz  # PyMuPDF
import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

def extract_structured_pdf(file_bytes: bytes) -> Dict[str, Any]:
    """
    Multi-strategy PDF extraction using PyMuPDF:
    1. Plain text per page
    2. Text blocks with bounding boxes (sorted vertically and horizontally, column-aware)
    3. Word coordinates for layout-sensitive fields
    4. Embedded hyperlink annotations (URIs)
    5. Table structures where available
    """
    try:
        doc = fitz.open("pdf", file_bytes)
    except Exception as e:
        raise ValueError(f"Failed to parse PDF document: {str(e)}")

    all_plain_text = []
    all_blocks = []
    all_words = []
    all_links = []
    all_tables = []
    
    page_count = len(doc)
    
    for page_num in range(page_count):
        page = doc[page_num]
        
        # 1. Plain text extraction
        p_text = page.get_text("text") or ""
        if p_text.strip():
            all_plain_text.append(p_text.strip())
            
        # 2. Block extraction with bounding boxes
        try:
            raw_blocks = page.get_text("blocks")
            for b in raw_blocks:
                # b format: (x0, y0, x1, y1, "text", block_no, block_type)
                if len(b) >= 5 and b[4] and isinstance(b[4], str) and b[4].strip():
                    all_blocks.append({
                        "page": page_num + 1,
                        "x0": round(b[0], 2),
                        "y0": round(b[1], 2),
                        "x1": round(b[2], 2),
                        "y1": round(b[3], 2),
                        "text": b[4].strip(),
                        "block_no": b[5] if len(b) > 5 else 0,
                        "block_type": b[6] if len(b) > 6 else 0
                    })
        except Exception as e:
            logger.debug(f"Error extracting blocks on page {page_num}: {e}")

        # 3. Word extraction with coordinates (useful for header/contact)
        try:
            raw_words = page.get_text("words")
            for w in raw_words:
                # w format: (x0, y0, x1, y1, "word", block_no, line_no, word_no)
                if len(w) >= 5 and w[4]:
                    all_words.append({
                        "page": page_num + 1,
                        "x0": round(w[0], 2),
                        "y0": round(w[1], 2),
                        "x1": round(w[2], 2),
                        "y1": round(w[3], 2),
                        "word": w[4].strip(),
                        "block_no": w[5] if len(w) > 5 else 0,
                        "line_no": w[6] if len(w) > 6 else 0
                    })
        except Exception as e:
            logger.debug(f"Error extracting words on page {page_num}: {e}")

        # 4. Embedded hyperlinks
        try:
            for link in page.get_links():
                uri = link.get("uri")
                if uri and isinstance(uri, str) and uri.strip():
                    cleaned_uri = uri.strip()
                    if cleaned_uri not in all_links:
                        all_links.append(cleaned_uri)
        except Exception as e:
            logger.debug(f"Error extracting links on page {page_num}: {e}")

        # 5. Tables extraction
        try:
            if hasattr(page, "find_tables"):
                tabs = page.find_tables()
                for tab in tabs:
                    tab_data = tab.extract()
                    if tab_data and any(any(c for c in row if c) for row in tab_data):
                        all_tables.append(tab_data)
        except Exception as e:
            logger.debug(f"Error finding tables on page {page_num}: {e}")

    full_plain_text = "\n\n".join(all_plain_text).strip()
    
    # Sort blocks approx by vertical position, then horizontal position
    all_blocks.sort(key=lambda b: (b["page"], b["y0"], b["x0"]))
    
    # Determine if scanned/empty
    is_scanned = len(full_plain_text) < 30 and len(all_blocks) == 0

    return {
        "plain_text": full_plain_text,
        "blocks": all_blocks,
        "words": all_words,
        "links": all_links,
        "tables": all_tables,
        "page_count": page_count,
        "is_scanned": is_scanned
    }

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Convenience backward-compatible text extractor."""
    data = extract_structured_pdf(file_bytes)
    return data["plain_text"]

def extract_links_from_pdf(file_bytes: bytes) -> List[str]:
    """Convenience backward-compatible link extractor."""
    data = extract_structured_pdf(file_bytes)
    return data["links"]

def is_scanned_or_empty_pdf(text: str) -> bool:
    """Checks if extracted text is negligible."""
    return len(text.strip()) < 30
