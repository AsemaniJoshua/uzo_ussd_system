# app/api/deps.py
from fastapi import Depends, HTTPException, status
from app.db.session import get_session
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import verify_access_token
from app.models.orm_models import Transaction
from app.repositories.transaction_repo import TransactionRepository

from typing import AsyncGenerator

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async for s in get_session():
        yield s

async def get_current_admin(token: str = Depends(...)):
    # placeholder: implement OAuth2PasswordBearer in main and decode token
    # for simplicity, this file will be used by admin router (see main)
    raise NotImplementedError
