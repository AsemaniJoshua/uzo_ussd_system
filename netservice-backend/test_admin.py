import asyncio
import logging
from app.db.session import AsyncSessionLocal
from app.repositories.admin_user_repo import AdminUserRepository

async def test_repo():
    async with AsyncSessionLocal() as db:
        repo = AdminUserRepository(db)
        admins = await repo.list_all()
        for a in admins:
            print(f"Admin: {a.username}, Role: {a.role}, Type: {type(a.role)}")

if __name__ == "__main__":
    asyncio.run(test_repo())
