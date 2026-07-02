# app/api/routers/support.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

from app.db.session import get_session
from app.models.orm_models import SupportMessage
from app.api.routers.admin import get_superadmin

router = APIRouter(prefix="/support", tags=["support"])

# Pydantic schemas
class SupportMessageCreate(BaseModel):
    name: str
    email: EmailStr
    message: str

class SupportMessageOut(BaseModel):
    id: int
    name: str
    email: str
    message: str
    created_at: datetime

    class Config:
        from_attributes = True

# 1. Create a support inquiry (Public)
@router.post("/contact", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_support_message(payload: SupportMessageCreate, db: AsyncSession = Depends(get_session)):
    new_msg = SupportMessage(
        name=payload.name,
        email=payload.email,
        message=payload.message
    )
    db.add(new_msg)
    await db.commit()
    await db.refresh(new_msg)
    return {"status": "success", "message": "Support message submitted successfully"}

# 2. View all support inquiries (Superadmin only)
@router.get("/contact", response_model=List[SupportMessageOut])
async def list_support_messages(
    db: AsyncSession = Depends(get_session),
    superadmin = Depends(get_superadmin)
):
    result = await db.execute(select(SupportMessage).order_by(SupportMessage.created_at.desc()))
    messages = result.scalars().all()
    return messages

# 3. Delete a support inquiry (Superadmin only)
@router.delete("/contact/{message_id}", response_model=dict)
async def delete_support_message(
    message_id: int,
    db: AsyncSession = Depends(get_session),
    superadmin = Depends(get_superadmin)
):
    result = await db.execute(select(SupportMessage).where(SupportMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Support message not found")
    
    await db.delete(msg)
    await db.commit()
    return {"status": "success", "message": "Support message deleted successfully"}
