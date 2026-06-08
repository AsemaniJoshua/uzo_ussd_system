# app/schemas/request_schemas.py
from pydantic import BaseModel
from decimal import Decimal
from typing import Optional
from datetime import datetime

class CreateTransactionIn(BaseModel):
    session_id: str
    user_msisdn: str
    network: str
    package_id: Optional[int] = None
    package_name: str
    amount: Decimal
    profit_amount: Optional[Decimal] = None
    recipient: str
    payment_method: Optional[str] = None

class TransactionOut(BaseModel):
    id: int
    session_id: str
    user_msisdn: str
    network: str
    package_name: str
    amount: Decimal
    profit_amount: Optional[Decimal] = None
    recipient: str
    payment_method: Optional[str]
    payment_reference: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
