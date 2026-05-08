# app/repositories/admin_user_repo.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.orm_models import AdminUser
from app.schemas.auth import AdminCreate
from app.core.security import get_password_hash

class AdminUserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_username(self, username: str):
        q = await self.db.execute(select(AdminUser).where(AdminUser.username == username))
        return q.scalars().first()

    async def create(self, admin_in: AdminCreate):
        db_admin = AdminUser(
            username=admin_in.username,
            password_hash=get_password_hash(admin_in.password),
            role=admin_in.role
        )
        self.db.add(db_admin)
        await self.db.commit()
        await self.db.refresh(db_admin)
        return db_admin

    async def update_password(self, username: str, new_password: str):
        admin = await self.get_by_username(username)
        if not admin:
            return None
        admin.password_hash = get_password_hash(new_password)
        await self.db.commit()
        await self.db.refresh(admin)
        return admin

    async def list_all(self, skip: int = 0, limit: int = 100):
        q = await self.db.execute(select(AdminUser).offset(skip).limit(limit))
        return q.scalars().all()

    async def delete_by_username(self, username: str):
        admin = await self.get_by_username(username)
        if not admin:
            return False
        await self.db.delete(admin)
        await self.db.commit()
        return True
