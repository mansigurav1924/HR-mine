from pydantic import BaseModel
from typing import List, Optional, Literal

class ChecklistItemSchema(BaseModel):
    key: str
    label: str
    required: bool = True
    status: Literal['pending', 'received', 'verified', 'not_required'] = 'pending'
    completed_at: Optional[str] = None

class OnboardingCreate(BaseModel):
    document_checklist: Optional[List[ChecklistItemSchema]] = None
    it_provisioning_requested: bool = False
    hris_handoff_status: Literal['pending', 'ready', 'submitted', 'completed'] = 'pending'
    notes: Optional[str] = None

class ChecklistUpdate(BaseModel):
    key: str
    status: Literal['pending', 'received', 'verified', 'not_required']

class ITProvisioningUpdate(BaseModel):
    requested: bool

class HRISStatusUpdate(BaseModel):
    status: Literal['pending', 'ready', 'submitted', 'completed']
