import json
import re
import os
import logging
from typing import List, Dict, Any, Optional, Tuple, Set

logger = logging.getLogger(__name__)

# ==============================================================================
# 1. SKILLS CATALOG INITIALIZATION & DOMAIN EXPANSION
# ==============================================================================
SKILLS_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "skills.json")
try:
    with open(SKILLS_FILE, 'r', encoding='utf-8') as f:
        SKILLS_CATALOG = json.load(f)
except Exception as e:
    logger.warning(f"Could not load skills.json ({e}), using built-in catalog.")
    SKILLS_CATALOG = {}

# Flatten skills catalog for fast phrase-aware canonical mapping
# normalized_alias -> canonical_name
FLAT_SKILLS: Dict[str, str] = {}
for category, skills in SKILLS_CATALOG.items():
    for canonical, aliases in skills.items():
        # Map canonical name itself
        FLAT_SKILLS[canonical.lower()] = canonical
        for alias in aliases:
            FLAT_SKILLS[alias.lower()] = canonical

# ==============================================================================
# 2. SECTION ALIASES CONFIGURATION MATRIX
# ==============================================================================
SECTION_ALIASES: Dict[str, List[str]] = {
    "EDUCATION": [
        "education", "academics", "academic details", "academic profile",
        "academic qualification", "academic qualifications", "educational qualification",
        "educational qualifications", "qualifications", "education & certifications",
        "scholastic background", "educational background", "academic background"
    ],
    "SKILLS": [
        "skills", "technical skills", "key skills", "core competencies",
        "technical competencies", "technologies", "tools & technologies",
        "professional skills", "expertise", "technical expertise", "skills & tools",
        "areas of expertise", "programming languages", "technical proficiencies",
        "core skills", "it skills", "technical stack", "tech stack"
    ],
    "EXPERIENCE": [
        "experience", "work experience", "professional experience",
        "internship", "internships", "internship experience", "employment",
        "employment history", "work history", "practical experience",
        "relevant experience", "professional background", "industry experience"
    ],
    "PROJECTS": [
        "projects", "academic projects", "personal projects", "key projects",
        "project experience", "selected projects", "portfolio projects",
        "technical projects", "major projects", "notable projects"
    ],
    "CERTIFICATIONS": [
        "certifications", "certificates", "courses", "training",
        "licenses & certifications", "online courses", "workshops",
        "certifications & achievements"
    ],
    "LINKS": [
        "links", "profiles", "online profiles", "social profiles",
        "social links", "coding profiles", "portfolio & profiles", "web links",
        "social accounts", "socials"
    ],
    "SUMMARY": [
        "summary", "professional summary", "executive summary", "career summary",
        "about me", "profile", "objective", "career objective", "personal statement"
    ]
}

# Reverse lookup: normalized_heading -> section_type
HEADING_TO_SECTION: Dict[str, str] = {}
for sec_type, aliases in SECTION_ALIASES.items():
    for a in aliases:
        HEADING_TO_SECTION[a.lower()] = sec_type

# ==============================================================================
# 3. TEXT NORMALIZATION & UTILITIES
# ==============================================================================
def normalize_text(text: str) -> str:
    """
    Normalizes unicode bullets, non-breaking spaces, dashes, quotes, and whitespace
    while strictly preserving line breaks necessary for section identification.
    """
    if not text or not isinstance(text, str):
        return ""
    
    t = text
    # Replace special unicode replacements & non-breaking spaces
    t = t.replace('\ufffd', '-').replace('\u00a0', ' ').replace('\u202f', ' ').replace('\u3000', ' ')
    
    # Normalize unicode bullets
    for b in ['\u2022', '\u25cf', '\u25aa', '\u25cb', '\u25e6', '\u25a0', '\u2219', '\xb7', '\u2043']:
        t = t.replace(b, '•')
        
    # Normalize common dashes
    for d in ['\u2013', '\u2014', '\u2015', '\u2212', '\uff0d', '—', '–']:
        t = t.replace(d, '-')
        
    # Normalize quotes
    t = t.replace('\u2018', "'").replace('\u2019', "'").replace('\u201c', '"').replace('\u201d', '"')
    
    # Normalize spacing within lines but preserve newlines
    lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in t.split('\n')]
    
    # Collapse multiple blank lines down to 2
    res_lines = []
    blank_count = 0
    for l in lines:
        if not l:
            blank_count += 1
            if blank_count <= 2:
                res_lines.append("")
        else:
            blank_count = 0
            res_lines.append(l)
            
    return "\n".join(res_lines).strip()

def clean_and_normalize_url(raw_url: str) -> Optional[str]:
    """
    Cleans raw URL strings, strips surrounding punctuation/brackets,
    and enforces standard https:// scheme.
    """
    if not raw_url or not isinstance(raw_url, str):
        return None
    url = raw_url.strip()
    
    # Ignore mailto:, tel:, javascript:
    if url.lower().startswith(('mailto:', 'tel:', 'javascript:')):
        return None
        
    # Strip enclosing brackets, quotes, and punctuation
    url = re.sub(r'^[<\(\[\{\'\"]+', '', url)
    url = re.sub(r'[\s.,;:)>\]\}\'\"]+$', '', url)
    
    if not url:
        return None
        
    # Ensure standard scheme
    if not re.match(r'^https?://', url, re.IGNORECASE):
        url = 'https://' + url
        
    return url

# ==============================================================================
# 4. SECTION SEGMENTATION MATRIX
# ==============================================================================
def is_section_heading(line: str) -> Optional[str]:
    """
    Determines if a given line is a section heading matching SECTION_ALIASES.
    Returns section type (e.g. 'EDUCATION', 'SKILLS') or None.
    """
    cleaned = line.strip().lower()
    # Strip trailing colon, dashes, underscores, and extra symbols
    cleaned = re.sub(r'[:_\-\|\•\*\#]+$', '', cleaned).strip()
    cleaned = re.sub(r'^[:_\-\|\•\*\#]+', '', cleaned).strip()
    
    if not cleaned or len(cleaned) > 50:
        return None
        
    # Direct alias match
    if cleaned in HEADING_TO_SECTION:
        return HEADING_TO_SECTION[cleaned]
        
    # Match with prefix/suffix (e.g. "my education", "technical skills summary")
    for alias, sec_type in HEADING_TO_SECTION.items():
        pattern = r'^(\d+[\.\)]\s*)?' + re.escape(alias) + r'(:|\s*$)'
        if re.match(pattern, cleaned):
            return sec_type
            
    return None

def segment_sections(text: str) -> Dict[str, List[str]]:
    """
    Segments normalized resume text into structured section blocks.
    Returns: {"HEADER": [...], "EDUCATION": [...], "SKILLS": [...], "EXPERIENCE": [...], ...}
    """
    norm = normalize_text(text)
    lines = [l.strip() for l in norm.split('\n')]
    
    sections: Dict[str, List[str]] = {
        "HEADER": [],
        "EDUCATION": [],
        "SKILLS": [],
        "EXPERIENCE": [],
        "PROJECTS": [],
        "CERTIFICATIONS": [],
        "LINKS": [],
        "SUMMARY": [],
        "OTHER": []
    }
    
    current_section = "HEADER"
    
    for line in lines:
        if not line:
            continue
            
        detected_sec = is_section_heading(line)
        if detected_sec:
            current_section = detected_sec
            continue
            
        sections[current_section].append(line)
        
    return sections

# ==============================================================================
# 5. FIELD EXTRACTION CANDIDATES & CONFIDENCE SCORING
# ==============================================================================

def extract_name_candidates(
    text: str,
    sections: Dict[str, List[str]],
    blocks: Optional[List[Dict[str, Any]]] = None
) -> Tuple[Optional[str], int]:
    """
    Extracts candidate name using multiple strategies and returns (name, confidence).
    """
    ignored_words = {
        'resume', 'curriculum', 'vitae', 'cv', 'profile', 'contact', 'email', 'phone',
        'http', 'https', 'github', 'linkedin', 'education', 'skills', 'experience',
        'projects', 'summary', 'address', 'page', 'objective', 'work', 'academic',
        'portfolio', 'software', 'engineer', 'developer', 'intern', 'specialist',
        'full', 'stack', 'manager', 'lead', 'associate', 'analyst', 'creator',
        'bachelor', 'master', 'university', 'college', 'school', 'institute',
        'technical', 'professional', 'about', 'career', 'details'
    }

    candidates = []

    # Strategy 1: First block from PyMuPDF layout (confidence 95)
    if blocks:
        for b in blocks[:4]:
            b_lines = [l.strip() for l in b["text"].split('\n') if l.strip()]
            for line in b_lines[:2]:
                line_clean = re.sub(r'[^a-zA-Z\s.-]', '', line).strip()
                words = line_clean.split()
                if 2 <= len(words) <= 4:
                    if not any(w.lower() in ignored_words for w in words):
                        if all(w[0].isupper() for w in words if len(w) > 1):
                            candidates.append((line_clean, 95))
                            break

    # Strategy 2: First non-empty lines from HEADER section (confidence 90)
    header_lines = sections.get("HEADER", [])[:5]
    for line in header_lines:
        line_clean = line.strip()
        line_lower = line_clean.lower()
        if any(w in line_lower for w in ['@', 'http', '.com', '.in', '.org', '.dev', 'www.', 'phone:', 'email:']):
            continue
        cleaned = re.sub(r'[^a-zA-Z\s.-]', '', line_clean).strip()
        words = cleaned.split()
        if 2 <= len(words) <= 4:
            if not any(w.lower() in ignored_words for w in words):
                if all(w[0].isupper() for w in words if len(w) > 1):
                    candidates.append((cleaned, 90))
                    break

    # Strategy 3: Top lines of full document (confidence 75)
    full_lines = [l.strip() for l in text.split('\n') if l.strip()][:6]
    for line in full_lines:
        line_lower = line.lower()
        if any(w in line_lower for w in ['@', 'http', '.com', '.in', '.org', 'phone']):
            continue
        cleaned = re.sub(r'[^a-zA-Z\s.-]', '', line).strip()
        words = cleaned.split()
        if 2 <= len(words) <= 4:
            if not any(w.lower() in ignored_words for w in words):
                if all(w[0].isupper() for w in words if len(w) > 1):
                    candidates.append((cleaned, 75))
                    break

    if not candidates:
        return None, 0

    # Pick candidate with highest confidence
    candidates.sort(key=lambda x: x[1], reverse=True)
    return candidates[0]

def extract_email_candidates(
    text: str,
    embedded_links: Optional[List[str]] = None
) -> Tuple[Optional[str], int]:
    """
    Extracts candidate email and confidence using mailto links and regex.
    """
    # Strategy 1: mailto: hyperlink (confidence 100)
    if embedded_links:
        for link in embedded_links:
            if link and isinstance(link, str) and link.lower().startswith('mailto:'):
                email_part = link[7:].split('?')[0].strip()
                if re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', email_part):
                    return email_part.lower(), 100

    # Strategy 2: regex match across text (confidence 95)
    m = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', text)
    if m:
        return m.group(0).lower().rstrip('.'), 95

    return None, 0

def extract_phone_candidates(text: str) -> Tuple[Optional[str], int]:
    """
    Extracts phone number supporting Indian (+91 9876543210, 9876543210)
    and international numbers, while rejecting dates and roll numbers.
    """
    norm = normalize_text(text)
    patterns = [
        # Explicit +91 / 91 Indian mobile with space/dash
        (r'(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b', 95),
        (r'(?:\+91[\s-]?)?[6-9]\d{9}\b', 95),
        # US/Intl format
        (r'(?:\+1[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b', 90),
        # General bracketed country code
        (r'\(\+\d{1,3}\)[\s-]?\d{10}\b', 90)
    ]
    
    for pat, conf in patterns:
        m = re.search(pat, norm)
        if m:
            candidate = m.group(0).strip()
            digits = re.sub(r'\D', '', candidate)
            # Guard against year ranges (e.g. 20202024), dates, CGPA
            if len(digits) in (10, 11, 12, 13) and not digits.startswith(('201', '202', '200')):
                return candidate, conf

    return None, 0

def extract_location_candidates(
    sections: Dict[str, List[str]],
    text: str
) -> Tuple[Optional[str], int]:
    """
    Extracts city/state location from contact header.
    """
    city_patterns = (
        r'\b(?:bengaluru|bangalore|mumbai|delhi|new delhi|hyderabad|pune|chennai|kolkata|'
        r'noida|gurgaon|gurugram|ahmedabad|jaipur|kochi|indore|chandigarh|mysuru|mysore|'
        r'lucknow|patna|bhopal|coimbatore|thiruvananthapuram|trivandrum|visakhapatnam|'
        r'new york|san francisco|los angeles|seattle|austin|chicago|boston|london|toronto|berlin|singapore)\b'
    )
    country_patterns = ('india', 'usa', 'united states', 'uk', 'canada', 'germany', 'singapore', 'australia')

    # Look in HEADER section first (confidence 90)
    header_lines = sections.get("HEADER", [])[:8]
    for line in header_lines:
        parts = [p.strip() for p in re.split(r'[,|•·]', line)]
        for part in parts:
            part_lower = part.lower()
            if any(part_lower.endswith(c) for c in country_patterns) or re.search(city_patterns, part_lower):
                if not any(k in part_lower for k in ['email', '@', 'http', 'github', 'phone', '+', 'linkedin', 'portfolio', 'cgpa', 'university']):
                    if len(part) < 60:
                        return part.strip(), 90

    # Fallback to top 10 lines of text (confidence 75)
    for line in text.split('\n')[:10]:
        parts = [p.strip() for p in re.split(r'[,|•·]', line)]
        for part in parts:
            part_lower = part.lower()
            if re.search(city_patterns, part_lower):
                if not any(k in part_lower for k in ['@', 'http', 'github', 'phone']):
                    if len(part) < 60:
                        return part.strip(), 75

    return None, 0

def extract_education_details(
    sections: Dict[str, List[str]],
    text: str,
    tables: Optional[List[Any]] = None
) -> Tuple[Dict[str, Optional[str]], int]:
    """
    Extracts structured education details from education section, tables, or document body.
    """
    edu_lines = sections.get("EDUCATION", [])
    in_edu_section = len(edu_lines) > 0
    confidence = 95 if (in_edu_section or tables) else 70
    
    # If no explicit education section, scan full document
    search_lines = edu_lines if in_edu_section else text.split('\n')

    college = None
    degree = None
    specialization = None
    cgpa = None
    graduation_year = None
    current_year = None

    college_keywords = [
        'college', 'university', 'institute', 'school', 'academy', 'iit', 'nit',
        'iiit', 'bits', 'polytechnic', 'stanford', 'mit', 'harvard', 'oxford', 'cambridge',
        'vtu', 'anna university', 'delhi university', 'mumbai university', 'srm', 'vit',
        'manipal', 'amity', 'pes university', 'bms', 'rvce', 'thapar', 'st. xavier', 'xavier'
    ]

    degree_patterns = [
        (r'b\.?tech(?:\.?)?', 'B.Tech'),
        (r'b\.?e(?:\.?)?', 'B.E.'),
        (r'b\.?sc(?:\.?)?', 'B.Sc'),
        (r'bca', 'BCA'),
        (r'mca', 'MCA'),
        (r'm\.?tech(?:\.?)?', 'M.Tech'),
        (r'm\.?e(?:\.?)?', 'M.E.'),
        (r'm\.?sc(?:\.?)?', 'M.Sc'),
        (r'mba', 'MBA'),
        (r'diploma', 'Diploma'),
        (r'12th|hsc|senior secondary', '12th / HSC'),
        (r'10th|ssc|secondary school', '10th / SSC'),
        (r'bachelor(?:[\'\s]s)?\s+(?:of\s+)?(?:science|engineering|technology|arts|commerce|business)?', "Bachelor's Degree"),
        (r'master(?:[\'\s]s)?\s+(?:of\s+)?(?:science|engineering|technology|arts|commerce|business)?', "Master's Degree")
    ]

    specialization_keywords = [
        'computer science and engineering', 'computer science & engineering', 'computer science',
        'information technology', 'artificial intelligence and data science', 'artificial intelligence & data science',
        'artificial intelligence & machine learning', 'ai & ml', 'data science', 'software engineering',
        'cybersecurity', 'electronics and communication', 'electrical and electronics',
        'electrical engineering', 'mechanical engineering', 'civil engineering',
        'business administration', 'marketing', 'human resources', 'finance'
    ]

    # 0. Table-based parsing
    if tables:
        for tab in tables:
            for row in tab:
                row_str = " | ".join([str(c) for c in row if c])
                row_lower = row_str.lower()
                
                # Check for college
                if not college and any(kw in row_lower for kw in college_keywords):
                    for cell in row:
                        c_str = str(cell).strip()
                        if any(kw in c_str.lower() for kw in college_keywords):
                            college = c_str.split('|')[0].split('•')[0].split('-')[0].strip()
                            break
                            
                # Check for degree
                if not degree:
                    for pattern, canon in degree_patterns:
                        if re.search(r'\b' + pattern + r'\b', row_lower):
                            degree = canon
                            break
                            
                # Check for CGPA
                if not cgpa:
                    cgpa_m = re.search(r'(?:cgpa|gpa|percentage|score|marks|aggregate)[:\s]*([0-9]+(?:\.[0-9]+)?(?:\s*/\s*[0-9]+(?:\.[0-9]+)?)?%?)', row_str, re.IGNORECASE)
                    if cgpa_m:
                        cgpa = cgpa_m.group(1).strip()
                    else:
                        for cell in row:
                            c_str = str(cell).strip()
                            if re.match(r'^[0-9]\.[0-9]{1,2}$', c_str) or re.match(r'^[0-9]{2}(?:\.[0-9]+)?%$', c_str):
                                cgpa = c_str
                                break
                                
                # Check for year
                if not graduation_year:
                    year_m = re.search(r'\b(202[0-9]|203[0-9]|201[0-9])\b', row_str)
                    if year_m:
                        graduation_year = year_m.group(1).strip()

    # 1. College / University detection from lines
    for l in search_lines:
        l_lower = l.lower()
        if any(kw in l_lower for kw in college_keywords) and not college:
            college_cand = l.split('|')[0].split('•')[0].split('-')[0].strip()
            if len(college_cand) > 3:
                college = college_cand
                break

    # 2. Degree & Specialization detection from lines
    for l in search_lines:
        l_lower = l.lower()
        if not degree:
            for pattern, canon in degree_patterns:
                if re.search(r'\b' + pattern + r'\b', l_lower):
                    degree = canon
                    break
        if not specialization:
            for spec in specialization_keywords:
                if spec in l_lower:
                    specialization = spec.title()
                    break

    # 3. CGPA / Percentage from lines
    for l in search_lines:
        if not cgpa:
            cgpa_m = re.search(r'(?:cgpa|gpa|percentage|score|marks|aggregate)[:\s]*([0-9]+(?:\.[0-9]+)?(?:\s*/\s*[0-9]+(?:\.[0-9]+)?)?%?)', l, re.IGNORECASE)
            if cgpa_m:
                cgpa = cgpa_m.group(1).strip()

    # 4. Graduation Year from lines
    for l in search_lines:
        if not graduation_year:
            grad_m = re.search(r'(?:graduat(?:ion|ing)|expected|batch|class of|passing year|year)[:\s]*(?:in\s*)?([12][09]\d{2})', l, re.IGNORECASE)
            if grad_m:
                graduation_year = grad_m.group(1).strip()
            else:
                year_m = re.search(r'\b(202[0-9]|203[0-9])\b', l)
                if year_m:
                    graduation_year = year_m.group(1).strip()

    if graduation_year:
        current_year = f"Class of {graduation_year}"

    degree_summary = degree or ""
    if specialization:
        degree_summary = f"{degree_summary} in {specialization}" if degree_summary else specialization

    return {
        "college": college,
        "degree": degree,
        "specialization": specialization,
        "current_year": current_year,
        "graduation_year": graduation_year,
        "cgpa": cgpa,
        "degree_summary": degree_summary.strip() or None
    }, confidence

def extract_skills_matrix(
    sections: Dict[str, List[str]],
    text: str
) -> Tuple[List[str], int]:
    """
    Hybrid skill extraction matrix:
    1. Scan SKILLS section (high priority, confidence 100)
    2. Scan PROJECTS & EXPERIENCE section (confidence 80)
    3. Scan full document (confidence 60)
    """
    found_skills: Set[str] = set()
    skills_sec_lines = sections.get("SKILLS", [])
    has_skills_section = len(skills_sec_lines) > 0
    
    # Text from Skills section
    skills_text = "\n".join(skills_sec_lines).lower()
    # Text from Projects & Experience
    proj_exp_text = "\n".join(sections.get("PROJECTS", []) + sections.get("EXPERIENCE", [])).lower()
    # Full document text
    full_text_lower = text.lower()

    for alias, canonical in FLAT_SKILLS.items():
        escaped_alias = re.escape(alias)
        start_bound = r'\b' if alias[0].isalnum() else r'(^|\s)'
        end_bound = r'\b' if alias[-1].isalnum() else r'($|\s|[.,!?;:])'
        pattern = f"{start_bound}{escaped_alias}{end_bound}"

        # Match in Skills section
        if skills_text and re.search(pattern, skills_text):
            found_skills.add(canonical)
        # Match in Projects / Experience section
        elif proj_exp_text and re.search(pattern, proj_exp_text):
            found_skills.add(canonical)
        # Match in Full text
        elif re.search(pattern, full_text_lower):
            found_skills.add(canonical)

    sorted_skills = sorted(list(found_skills))
    confidence = 100 if has_skills_section and sorted_skills else 80 if sorted_skills else 0
    return sorted_skills, confidence

def extract_urls(
    text: str,
    embedded_links: Optional[List[str]] = None
) -> Tuple[Dict[str, Optional[str]], Dict[str, int]]:
    """
    Extract, normalize, and classify GitHub, LinkedIn, and Portfolio URLs
    from both embedded document hyperlinks and visible text.
    """
    raw_candidates = []
    
    # 1. Embedded hyperlink annotations (PDF & DOCX)
    if embedded_links:
        for link in embedded_links:
            if link and isinstance(link, str) and link.strip():
                raw_candidates.append((link.strip(), 100))

    # 2. Visible text URL patterns
    norm_text = normalize_text(text)
    visible_patterns = [
        r'https?://[^\s,;()<>\"\'\\]+',
        r'(?:www\.)?github\.com/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)?',
        r'(?:www\.)?linkedin\.com/(?:in|pub)/[A-Za-z0-9_.-]+',
        r'(?:www\.)?[A-Za-z0-9_-]+\.(?:vercel\.app|netlify\.app|github\.io|dev|me|tech|io|space|site|online)(?:/[^\s,;()<>\"\'\\]*)?'
    ]
    for pat in visible_patterns:
        for m in re.finditer(pat, norm_text, re.IGNORECASE):
            raw_candidates.append((m.group(0), 95))

    github_url = None
    linkedin_url = None
    portfolio_url = None

    conf_scores = {"github_url": 0, "linkedin_url": 0, "portfolio_url": 0}

    ignored_portfolio_domains = (
        'github.com', 'linkedin.com', 'google.com', 'twitter.com', 'x.com',
        'facebook.com', 'instagram.com', 'youtube.com', 'medium.com', 'substack.com',
        'gmail.com', 'microsoft.com', 'apple.com', 'w3.org', 'schema.org', 'apache.org',
        'adobe.com', 'zoom.us', 'meet.google.com', 'teams.microsoft.com', 'wikipedia.org'
    )
    ignored_extensions = ('.pdf', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.svg')

    seen_urls = set()
    for raw, conf in raw_candidates:
        norm = clean_and_normalize_url(raw)
        if not norm or norm in seen_urls:
            continue
        seen_urls.add(norm)
        norm_lower = norm.lower()

        # Check GitHub URL
        if 'github.com/' in norm_lower:
            gh_m = re.search(r'github\.com/([A-Za-z0-9_.-]+)', norm, re.IGNORECASE)
            if gh_m:
                user = gh_m.group(1).rstrip('.,;:/')
                if user and user.lower() not in ('features', 'explore', 'topics', 'pricing', 'about', 'join', 'login', 'signup', 'site', 'org'):
                    if not github_url:
                        github_url = f"https://github.com/{user}"
                        conf_scores["github_url"] = conf
            continue

        # Check LinkedIn URL
        if 'linkedin.com/' in norm_lower:
            li_m = re.search(r'linkedin\.com/(?:in|pub)/([A-Za-z0-9_.-]+)', norm, re.IGNORECASE)
            if li_m:
                user = li_m.group(1).rstrip('.,;:/')
                if user and not linkedin_url:
                    linkedin_url = f"https://linkedin.com/in/{user}"
                    conf_scores["linkedin_url"] = conf
            continue

        # Check Portfolio URL
        if not portfolio_url:
            if not any(dom in norm_lower for dom in ignored_portfolio_domains) and not norm_lower.endswith(ignored_extensions):
                if re.search(r'https?://(?:www\.)?[A-Za-z0-9.-]+\.[a-zA-Z]{2,}', norm):
                    portfolio_url = norm
                    conf_scores["portfolio_url"] = conf

    return {
        "github_url": github_url or "",
        "linkedin_url": linkedin_url or "",
        "portfolio_url": portfolio_url or ""
    }, conf_scores

def extract_experience_structured(
    sections: Dict[str, List[str]],
    text: str
) -> Tuple[Dict[str, Any], int]:
    """
    Extracts experience summary and structured internship/job items.
    """
    exp_lines = sections.get("EXPERIENCE", [])
    confidence = 95 if exp_lines else 60
    lines = exp_lines if exp_lines else text.split('\n')
    
    internships = []
    current_entry = None

    for l in lines:
        clean_line = l.strip()
        if not clean_line:
            continue
        is_bullet = clean_line.startswith(('•', '-', '*', '·', '1.', '2.', '3.', '4.', '5.'))
        is_pure_date = bool(re.match(r'^[0-9]{4}\s*[-–—]\s*(?:[0-9]{4}|present|current)$', clean_line.lower()))

        if is_pure_date and current_entry:
            current_entry["duration"] = clean_line
            continue

        has_role_keyword = any(k in clean_line.lower() for k in [
            'intern', 'engineer', 'developer', 'analyst', 'manager', 'lead',
            'associate', 'specialist', 'consultant', 'assistant', 'officer',
            'coordinator', 'trainee'
        ])
        has_separator = any(sep in clean_line for sep in ['-', '|', '—', '–', '·', '•', '\xb7', '\ufffd', ' at '])

        if (has_separator or has_role_keyword) and not is_bullet and not is_pure_date and len(clean_line) < 120:
            if current_entry:
                internships.append(current_entry)

            dur_m = re.search(r'\(([^)]+)\)', clean_line)
            if dur_m:
                duration = dur_m.group(1).strip()
                clean_header = clean_line.replace(dur_m.group(0), '').strip()
            else:
                duration = ''
                clean_header = clean_line

            parts = re.split(r'[-|•–—·\xb7\ufffd]|\bat\b', clean_header, maxsplit=1)
            role = parts[0].strip() if len(parts) >= 2 else clean_header
            company = parts[1].strip() if len(parts) >= 2 else ''

            current_entry = {
                "title": clean_header,
                "company": company,
                "role": role,
                "duration": duration,
                "description": ""
            }
        elif current_entry:
            current_entry["description"] = (current_entry["description"] + "\n" + clean_line).strip()

    if current_entry:
        internships.append(current_entry)

    summary = "\n".join(exp_lines)
    return {
        "summary": summary,
        "internships": internships,
        "items": internships
    }, confidence

def extract_projects_structured(
    sections: Dict[str, List[str]],
    text: str
) -> Tuple[List[Dict[str, Any]], str, int]:
    """
    Extracts structured projects and a combined summary for application form.
    """
    proj_lines = sections.get("PROJECTS", [])
    confidence = 95 if proj_lines else 60
    lines = proj_lines if proj_lines else text.split('\n')

    projects = []
    current_proj = None

    for l in lines:
        clean_line = l.strip()
        if not clean_line:
            continue
        is_bullet = clean_line.startswith(('•', '-', '*', '·', '1.', '2.', '3.', '4.', '5.'))
        is_desc = clean_line.lower().startswith(('built with', 'designed', 'developed', 'implemented', 'engineered', 'created', 'a full', 'an ai', 'web app'))

        if not is_bullet and not is_desc and len(clean_line) < 90 and (current_proj is None or len(current_proj["description"]) > 0 or '(' in clean_line):
            if current_proj:
                projects.append(current_proj)
            techs, _ = extract_skills_matrix({}, clean_line)
            current_proj = {
                "name": clean_line.split('(')[0].split('-')[0].strip(),
                "description": "",
                "technologies": techs,
                "url": ""
            }
        elif current_proj:
            current_proj["description"] = (current_proj["description"] + "\n" + clean_line).strip()
            new_techs, _ = extract_skills_matrix({}, clean_line)
            for t in new_techs:
                if t not in current_proj["technologies"]:
                    current_proj["technologies"].append(t)

    if current_proj:
        projects.append(current_proj)

    summary = "\n".join(proj_lines)
    return projects, summary, confidence

# ==============================================================================
# 6. HYBRID RESUME PARSING MATRIX ENTRY POINT
# ==============================================================================
def extract_full_profile(
    text: str,
    embedded_links: Optional[List[str]] = None,
    blocks: Optional[List[Dict[str, Any]]] = None,
    tables: Optional[List[Any]] = None
) -> Dict[str, Any]:
    """
    Main Hybrid Resume Parsing Matrix entry point.
    Segments document, runs multi-strategy extraction per field,
    computes confidence scores, and returns unified structured JSON.
    """
    # 1. Segment text into section blocks
    sections = segment_sections(text)

    # 2. Field extractions with confidence matrix
    name, name_conf = extract_name_candidates(text, sections, blocks)
    email, email_conf = extract_email_candidates(text, embedded_links)
    phone, phone_conf = extract_phone_candidates(text)
    loc, loc_conf = extract_location_candidates(sections, text)
    edu, edu_conf = extract_education_details(sections, text, tables)
    skills, skills_conf = extract_skills_matrix(sections, text)
    exp, exp_conf = extract_experience_structured(sections, text)
    proj_list, proj_summary, proj_conf = extract_projects_structured(sections, text)
    urls, url_confs = extract_urls(text, embedded_links)

    # 3. Compute coverage metric (internal diagnostic only)
    detected_fields = []
    if name: detected_fields.append("full_name")
    if email: detected_fields.append("email")
    if phone: detected_fields.append("phone")
    if loc: detected_fields.append("location")
    if edu.get("college"): detected_fields.append("college")
    if edu.get("degree"): detected_fields.append("degree")
    if skills: detected_fields.append("skills")
    if exp.get("summary"): detected_fields.append("experience")
    if proj_list: detected_fields.append("projects")
    if urls.get("github_url"): detected_fields.append("github_url")
    if urls.get("linkedin_url"): detected_fields.append("linkedin_url")
    if urls.get("portfolio_url"): detected_fields.append("portfolio_url")

    supported_count = 12
    coverage_str = f"{len(detected_fields)}/{supported_count}"

    return {
        "parsed": True,
        "personal": {
            "full_name": name or "",
            "email": email or "",
            "phone": phone or "",
            "location": loc or ""
        },
        "education": {
            "college": edu.get("college") or "",
            "university": edu.get("college") or "",
            "degree": edu.get("degree") or "",
            "specialization": edu.get("specialization") or "",
            "current_year": edu.get("current_year") or "",
            "graduation_year": edu.get("graduation_year") or "",
            "cgpa": edu.get("cgpa") or ""
        },
        "skills": skills,
        "experience": {
            "summary": exp.get("summary") or "",
            "items": exp.get("items") or [],
            "internships": exp.get("internships") or []
        },
        "projects": proj_list,
        "projects_summary": proj_summary,
        "links": {
            "github_url": urls.get("github_url") or "",
            "linkedin_url": urls.get("linkedin_url") or "",
            "portfolio_url": urls.get("portfolio_url") or ""
        },
        "extraction_meta": {
            "confidence": {
                "full_name": name_conf,
                "email": email_conf,
                "phone": phone_conf,
                "education": edu_conf,
                "skills": skills_conf,
                "experience": exp_conf,
                "projects": proj_conf,
                "github_url": url_confs.get("github_url", 0),
                "linkedin_url": url_confs.get("linkedin_url", 0),
                "portfolio_url": url_confs.get("portfolio_url", 0)
            },
            "coverage": coverage_str,
            "fields_detected": detected_fields
        },
        # Convenience fields for flat access
        "full_name": name,
        "email": email,
        "phone": phone,
        "college": edu.get("college"),
        "degree": edu.get("degree_summary") or edu.get("degree"),
        "specialization": edu.get("specialization"),
        "current_year": edu.get("current_year"),
        "experience_summary": exp.get("summary"),
        "github_url": urls.get("github_url") or "",
        "linkedin_url": urls.get("linkedin_url") or "",
        "portfolio_url": urls.get("portfolio_url") or ""
    }

# Backward compatibility alias functions
def extract_skills(text: str) -> List[str]:
    skills, _ = extract_skills_matrix({}, text)
    return skills

def extract_name(text: str) -> Optional[str]:
    name, _ = extract_name_candidates(text, segment_sections(text))
    return name

def extract_email(text: str) -> Optional[str]:
    email, _ = extract_email_candidates(text)
    return email

def extract_phone(text: str) -> Optional[str]:
    phone, _ = extract_phone_candidates(text)
    return phone

def extract_location(text: str) -> Optional[str]:
    loc, _ = extract_location_candidates(segment_sections(text), text)
    return loc

def extract_education(text: str) -> List[Dict[str, str]]:
    norm = normalize_text(text)
    sections = segment_sections(norm)
    edu_lines = sections.get("EDUCATION", [])
    results = []
    
    for line in edu_lines:
        line_lower = line.lower()
        if any(re.search(r'\b' + pat + r'\b', line_lower) for pat in [r'b\.?tech', r'b\.?e', r'b\.?sc', r'bca', r'mca', r'm\.?sc', r'm\.?tech', r'mba', r'bachelor', r'master', r'diploma', r'hsc', r'ssc', r'12th', r'10th']):
            results.append({"degree": line.strip()})
    if results:
        return results
    edu, _ = extract_education_details(sections, norm)
    if edu.get("degree") or edu.get("college"):
        return [{
            "degree": edu.get("degree_summary") or edu.get("degree") or "",
            "field": edu.get("specialization") or "",
            "institution": edu.get("college") or "",
            "year": edu.get("graduation_year") or ""
        }]
    return []

def extract_experience(text: str) -> List[Dict[str, str]]:
    exp, _ = extract_experience_structured(segment_sections(text), text)
    return exp.get("internships") or []

def extract_projects(text: str) -> List[Dict[str, Any]]:
    proj_list, _, _ = extract_projects_structured(segment_sections(text), text)
    return proj_list

def extract_experience_summary(text: str) -> str:
    exp, _ = extract_experience_structured(segment_sections(text), text)
    return exp.get("summary") or ""

def extract_projects_summary(text: str) -> Tuple[List[str], str]:
    proj_list, summary, _ = extract_projects_structured(segment_sections(text), text)
    items = [p["name"] for p in proj_list]
    return items, summary

def extract_profile(text: str, embedded_links: Optional[List[str]] = None) -> Dict[str, Any]:
    return extract_full_profile(text, embedded_links)
