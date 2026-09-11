from pydantic import BaseModel
from typing import Optional

class OfferTemplateCreateRequest(BaseModel):
    name: str
    department: Optional[str] = None
    region: Optional[str] = None
    html_body: str

class OfferTemplateVersionRequest(BaseModel):
    html_body: str
    
class OfferTemplateActiveRequest(BaseModel):
    is_active: bool
