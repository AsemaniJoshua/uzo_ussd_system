from pydantic import BaseModel
from decimal import Decimal
from typing import Optional
from enum import Enum

class NetworkEnum(str, Enum):
    MTN = "MTN"
    AT = "AT"
    TELECEL = "TELECEL"

class PackageOut(BaseModel):
    id: int
    network: NetworkEnum
    package_name: str
    amount: Decimal
    active: int

    class Config:
        from_attributes = True

class PackageCreate(BaseModel):
    network: NetworkEnum
    package_name: str
    amount: Decimal
    active: Optional[int] = 1

class PackageUpdate(BaseModel):
    package_name: Optional[str]
    amount: Optional[Decimal]
    active: Optional[int]
