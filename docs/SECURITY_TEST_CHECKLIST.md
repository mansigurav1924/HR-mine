# Security Test Checklist & RBAC Matrix

## 1. Role-Based Access Control (RBAC) Matrix

| Resource / Endpoint | HTTP Method | Allowed Role | Auth Mechanism | Test Status |
| :--- | :---: | :---: | :---: | :---: |
| `/api/auth/*` | POST | Public / HR Admin | Supabase Auth + MFA | **PASS** |
| `/api/applications` | GET, POST | `hr_admin` | JWT + `require_hr_admin` | **PASS** |
| `/api/applications/{id}` | GET, PUT | `hr_admin` | JWT + `require_hr_admin` | **PASS** |
| `/api/ml/*` | GET, POST | `hr_admin` | JWT + `require_hr_admin` | **PASS** |
| `/api/shortlisting/*` | GET, POST | `hr_admin` | JWT + `require_hr_admin` | **PASS** |
| `/api/assessments` (HR routes) | GET, POST | `hr_admin` | JWT + `require_hr_admin` | **PASS** |
| `/api/assessments/access/{token}` | GET, POST | Candidate (Stage 1) | SHA-256 Hash Token Validation | **PASS** |
| `/api/ai-interviews` (HR routes) | GET, POST | `hr_admin` | JWT + `require_hr_admin` | **PASS** |
| `/api/ai-interviews/access/{token}` | GET, POST | Candidate (Stage 2) | SHA-256 Hash Token Validation | **PASS** |
| `/api/interviews` | GET, POST | `hr_admin` / `interviewer` | Scoped by `interviewer_id` | **PASS** |
| `/api/final-selection/*` | GET, POST | `hr_admin` | JWT + `require_hr_admin` | **PASS** |
| `/api/offer-templates/*` | GET, POST, PUT | `hr_admin` | JWT + `require_hr_admin` | **PASS** |
| `/api/offers/*` | GET, POST | `hr_admin` | JWT + `require_hr_admin` | **PASS** |
| `/api/onboarding/*` | GET, POST, PATCH | `hr_admin` | JWT + `require_hr_admin` | **PASS** |
| `/api/dashboard/*` | GET | `hr_admin` | JWT + `require_hr_admin` | **PASS** |
| `/api/reports/*` | GET | `hr_admin` | JWT + `require_hr_admin` | **PASS** |
| `/api/export/*` | GET | `hr_admin` | JWT + `require_hr_admin` | **PASS** |
| `/api/search` | GET | `hr_admin` | JWT + `require_hr_admin` | **PASS** |
| `/api/audit-logs` | GET | `hr_admin` | JWT + `require_hr_admin` | **PASS** |

---

## 2. Attack Simulation Results

- **Interviewer attempts to list all applications**: Blocked with `HTTP 403 Forbidden` (`require_hr_admin`). [PASS]
- **Interviewer attempts to trigger ML evaluation or shortlisting**: Blocked with `HTTP 403 Forbidden`. [PASS]
- **Interviewer attempts to access reports or export data**: Blocked with `HTTP 403 Forbidden`. [PASS]
- **Interviewer attempts to inspect audit logs**: Blocked with `HTTP 403 Forbidden`. [PASS]
- **Interviewer attempts to access another interviewer's assigned interview**: Blocked with `HTTP 403 Forbidden`. [PASS]
- **Assessment token used at AI Interview route**: Blocked with `ValueError("Invalid token stage")`. [PASS]
- **AI Interview token used at Assessment route**: Blocked with `ValueError("Invalid token stage")`. [PASS]
- **Expired candidate access token**: Blocked with `ValueError("This access link has expired")`. [PASS]
- **Revoked candidate access token**: Blocked with `ValueError("This access link has been revoked")`. [PASS]
- **Used/Completed candidate token**: Blocked with `ValueError("This stage has already been completed")`. [PASS]
- **Withdrawn candidate token**: Blocked with `ValueError("This application has been withdrawn")`. [PASS]

---

## 3. Storage & Upload Security

- **Storage Buckets**: `resumes`, `offer-pdfs`, `attachments` are configured as private buckets in Supabase Storage.
- **Upload Size Limit**: Strictly enforced at 5 MB max server-side.
- **Extension Whitelist**: Only `.pdf` and `.docx` accepted.
- **Magic Byte Validation**:
  - PDF: Verified `%PDF-` signature.
  - DOCX: Verified `PK\x03\x04` zip archive signature.
- **Object Key Generation**: Uses cryptographically secure random UUIDs (`uuid.uuid4()`). Original filename is never executed or used as local filesystem path.

---

## 4. API & Network Hardening

- **Security Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-XSS-Protection: 1; mode=block`
  - `X-Request-ID`: Generated per request.
- **Rate Limiting**: Sliding window rate limiter protects sensitive authentication, candidate token evaluation, resume parsing, export, and search endpoints.
- **Error Formatting**: Production responses return standard `{ "error": { "code": "...", "message": "..." } }` without leaking stack traces, SQL syntax, or internal file paths.
- **Export Safety Cap**: Maximum 5,000 rows per export.
