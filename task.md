# Task: Google Calendar + Outlook Calendar + Gmail API Integration

## Background & Objectives
Replace SMTP as the primary email transport and integrate real external communication/calendar services using:
- **Gmail API** as the primary email-sending transport (`users.messages.send`, base64url encoded MIME, supporting attachments like Offer PDFs).
- **Google Calendar API v3** for human interview scheduling with unique **Google Meet** links.
- **Microsoft Graph Calendar API** for Outlook Calendar scheduling with **Microsoft Teams** online meeting links.
- **Unified `CalendarProvider` abstraction** for multi-provider calendar support.
- **AES-256 Encrypted Credentials Vault** to safely persist OAuth access & refresh tokens at rest with zero client exposure.
- **HR Settings & Integrations Dashboard** for OAuth connect/reconnect/disconnect and status monitoring.
- **Human Interview UI Integration** with provider selector, meeting links, sync status indicators, and retry sync actions.

---

## Status / Todo List

- [x] **Database & Security Vault**
  - [x] Create migration `server/supabase/migrations/009_integrations_calendar.sql` for `integration_credentials` and `interviews` calendar tracking columns.
  - [x] Implement AES-256 Fernet encrypted credential vault in `server/app/services/integrations/credentials_vault.py`.
- [x] **Google OAuth & Gmail API Service**
  - [x] Implement Google OAuth 2.0 flow with `gmail.send`, `calendar.events`, and `userinfo.email` scopes in `server/app/services/integrations/google_auth_service.py`.
  - [x] Implement RFC 2822 MIME message construction and base64url dispatch in `server/app/services/integrations/gmail_service.py`.
  - [x] Create `GmailProvider` implementing `BaseEmailProvider` in `server/app/services/email/gmail_provider.py`.
  - [x] Update `EmailService.get_provider()` to default to `GmailProvider`.
- [x] **Microsoft OAuth & Graph Calendar Service**
  - [x] Implement Microsoft Graph OAuth 2.0 flow with `Calendars.ReadWrite`, `offline_access`, `User.Read` (excluding Mail scopes) in `server/app/services/integrations/microsoft_auth_service.py`.
  - [x] Implement Microsoft Graph Calendar v1.0 `/me/events` with Teams meetings in `server/app/services/integrations/outlook_calendar_service.py`.
- [x] **Unified Calendar Abstraction & Google Meet**
  - [x] Implement `CalendarProvider` ABC and factory in `server/app/services/integrations/calendar_service.py`.
  - [x] Implement Google Calendar API v3 provider with Google Meet provisioning in `server/app/services/integrations/google_calendar_service.py`.
- [x] **API Endpoints & Router Mounting**
  - [x] Create Pydantic schemas in `server/app/schemas/integrations.py`.
  - [x] Implement endpoints `/api/integrations/status`, `/google/connect`, `/google/callback`, `/google/status`, `/google/disconnect`, `/microsoft/connect`, `/microsoft/callback`, `/microsoft/status`, `/microsoft/disconnect` in `server/app/api/integrations.py`.
  - [x] Add retry sync endpoint `POST /api/interviews/{interview_id}/calendar-sync` in `server/app/api/interviews.py`.
  - [x] Mount integrations router in `server/app/main.py`.
  - [x] Update `InterviewService` with external calendar event creation, reschedule sync, cancellation delete, and Gmail notifications.
- [x] **Frontend Integrations & UI**
  - [x] Create `client/src/services/integrationsApi.js`.
  - [x] Update `client/src/services/interviewApi.js` with `retryCalendarSync`.
  - [x] Upgrade `client/src/pages/Settings.jsx` with Google & Microsoft integration management cards.
  - [x] Upgrade `client/src/components/interviews/ScheduleInterviewModal.jsx` with calendar provider and duration selector.
  - [x] Upgrade `client/src/components/interviews/InterviewDetailModal.jsx` with calendar provider, sync status badge, meeting join link, and retry sync.
  - [x] Upgrade `client/src/pages/Interviews.jsx` with calendar provider badge and direct meeting link.
- [x] **Verification & Test Suite**
  - [x] Create comprehensive automated tests in `server/tests/test_integrations.py` (8 test scenarios).
  - [x] Run and pass all 58 backend pytest suite tests (100% pass).
  - [x] Run frontend linter and verify zero errors (`npm run lint`).
  - [x] Build frontend production bundle (`npm run build`).
