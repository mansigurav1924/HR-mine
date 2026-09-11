from pydantic import BaseModel

class OfferSendRequest(BaseModel):
    resend: bool = False
