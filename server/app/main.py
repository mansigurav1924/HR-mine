import os
import sys
import asyncio
import logging

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.services.supabase_client import supabase
from app.middleware.security import SecurityHeadersMiddleware
from app.api import (
    auth, applications, assessments, ai_interviews, ml,
    shortlisting, interviews, final_selection, offer_templates,
    offers, onboarding, dashboard, reports, export, search, audit_logs,
    public_applications, integrations, group_interviews, departments, positions
)

# Logging configuration (redact sensitive auth tokens)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="HR Recruitment Management System API",
    docs_url="/docs" if os.getenv("APP_ENV") != "production" else None,
    redoc_url="/redoc" if os.getenv("APP_ENV") != "production" else None,
)

# Attach Security Headers & Rate Limiting Middleware
app.add_middleware(SecurityHeadersMiddleware)

# Environment-aware CORS Configuration
raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
frontend_url = os.getenv("FRONTEND_URL")
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
if frontend_url and frontend_url.strip() not in allowed_origins:
    allowed_origins.append(frontend_url.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Request-ID"],
)

# Global Exception Handlers for Centralized Error Format
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "UNPROCESSABLE_ENTITY",
        429: "RATE_LIMIT_EXCEEDED",
        500: "INTERNAL_SERVER_ERROR"
    }
    error_code = code_map.get(exc.status_code, "ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": error_code,
                "message": exc.detail
            },
            "detail": exc.detail  # Keep detail for frontend compatibility
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = errors[0]["msg"] if errors else "Invalid request data."
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": msg,
                "details": errors
            },
            "detail": msg
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"[Request {req_id}] Unhandled Server Error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred."
            },
            "detail": "An unexpected server error occurred."
        }
    )

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(applications.router, prefix="/api/applications", tags=["Applications"])
app.include_router(ml.router, prefix="/api/ml", tags=["Machine Learning"])
app.include_router(shortlisting.router)
app.include_router(assessments.router, prefix="/api/assessments", tags=["Assessments"])
app.include_router(ai_interviews.router, prefix="/api/ai-interviews", tags=["AI Interviews"])
app.include_router(interviews.router, prefix="/api/interviews", tags=["Human Interviews"])
app.include_router(group_interviews.router, prefix="/api/group-interviews", tags=["Group Interviews"])
app.include_router(final_selection.router, prefix="/api/final-selection", tags=["Final Selection"])
app.include_router(offer_templates.router, prefix="/api/offer-templates", tags=["Offer Templates"])
app.include_router(offer_templates.router, prefix="/offer-templates", tags=["Offer Templates"])
app.include_router(offers.router, prefix="/api/offers", tags=["Offers"])
app.include_router(offers.router, prefix="/offers", tags=["Offers"])
app.include_router(onboarding.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(export.router)
app.include_router(search.router)
app.include_router(audit_logs.router)
app.include_router(public_applications.router)
app.include_router(integrations.router)
app.include_router(group_interviews.router)
app.include_router(departments.router)
app.include_router(positions.router)

@app.get("/")
def read_root():
    return {"message": "HR Recruitment Management System API"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/debug/cors")
def debug_cors():
    return {
        "raw_ALLOWED_ORIGINS_env": os.getenv("ALLOWED_ORIGINS"),
        "raw_FRONTEND_URL_env": os.getenv("FRONTEND_URL"),
        "computed_allowed_origins": allowed_origins,
    }

@app.get("/api/health/supabase")
def supabase_health_check():
    try:
        supabase.table("users").select("user_id").limit(1).execute()
        return {"status": "connected"}
    except Exception as e:
        logger.error(f"Supabase connection failed: {e}")
        return {"status": "disconnected"}
