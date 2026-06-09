# app/schemas/auth.py
from pydantic import BaseModel


# Admin user schemas
from typing import Optional
from enum import Enum
from datetime import datetime

class AdminRole(str, Enum):
    superadmin = "superadmin"
    staff = "staff"

class AdminCreate(BaseModel):
    username: str
    password: str
    role: Optional[AdminRole] = AdminRole.staff

class AdminOut(BaseModel):
    id: int
    username: str
    role: AdminRole
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[AdminOut] = None

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str
