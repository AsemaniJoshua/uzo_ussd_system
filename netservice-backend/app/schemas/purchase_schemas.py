# app/schemas/purchase_schemas.py
from pydantic import BaseModel
from typing import Optional

class PurchaseRequest(BaseModel):
    package_id: int
    recipient: str
    redirect_url: str
    email: Optional[str] = "customer@netservicedata.site"

class PurchaseResponse(BaseModel):
    status: str
    transaction_id: int
    checkout_url: str
    message: str
