from typing import Optional, List
from pydantic import BaseModel

class IntegrationStatusResponse(BaseModel):
    provider: str
    connected: bool
    account_email: Optional[str] = None
    granted_scopes: List[str] = []
    token_expiry: Optional[str] = None

class AllIntegrationsStatusResponse(BaseModel):
    google: IntegrationStatusResponse
    microsoft: IntegrationStatusResponse

class ConnectUrlResponse(BaseModel):
    provider: str
    auth_url: str

class DisconnectResponse(BaseModel):
    provider: str
    success: bool
    message: str
