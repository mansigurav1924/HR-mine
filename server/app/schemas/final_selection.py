from typing import Optional
from pydantic import BaseModel, Field


class FinalSelectionRequest(BaseModel):
    notes: Optional[str] = Field(None, max_length=2000, description="HR notes for final selection")


class FinalRejectRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=2000, description="Required rejection reason")
    send_email: bool = Field(False, description="Whether to send rejection email to candidate")


class FinalHoldRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=2000, description="Required hold reason")
    review_date: Optional[str] = Field(None, description="Optional future review date (ISO date string)")
