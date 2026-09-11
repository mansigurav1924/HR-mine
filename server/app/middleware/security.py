import time
import uuid
from typing import Dict, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

class InMemoryRateLimiter:
    """Sliding-window / leaky bucket in-memory rate limiter."""
    def __init__(self):
        # map: (ip, route_prefix) -> (count, reset_time)
        self.buckets: Dict[Tuple[str, str], Tuple[int, float]] = {}

    def is_allowed(self, ip: str, path: str) -> bool:
        # Define limits: max_requests per window_seconds
        window = 60.0
        limit = 120  # default 120 req / min

        if path.startswith("/api/auth"):
            limit = 20
        elif path.startswith("/api/public/applications"):
            limit = 15
        elif path.startswith("/api/public/jobs"):
            limit = 60
        elif path.startswith("/api/applications") and "/parse-resume" in path:
            limit = 15
        elif "/access/" in path:  # candidate token verification/answering
            limit = 45
        elif path.startswith("/api/export"):
            limit = 30
        elif path.startswith("/api/search"):
            limit = 90

        now = time.time()
        key = (ip, path.split('?')[0])
        
        if key in self.buckets:
            count, reset_time = self.buckets[key]
            if now > reset_time:
                self.buckets[key] = (1, now + window)
                return True
            if count >= limit:
                return False
            self.buckets[key] = (count + 1, reset_time)
            return True
        else:
            self.buckets[key] = (1, now + window)
            return True

rate_limiter = InMemoryRateLimiter()

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        
        # Rate limit check for API routes
        if request.url.path.startswith("/api/") and not request.url.path.startswith("/api/health"):
            if not rate_limiter.is_allowed(client_ip, request.url.path):
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": {
                            "code": "RATE_LIMIT_EXCEEDED",
                            "message": "Too many requests. Please try again later."
                        },
                        "detail": "Too many requests. Please try again later."
                    }
                )

        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        response: Response = await call_next(request)

        # Attach Security Headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"

        return response
