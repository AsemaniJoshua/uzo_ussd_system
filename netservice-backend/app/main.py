# app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import ussd, webhook, admin
from app.api.routers import packages
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
import asyncio

app = FastAPI(title="NetService USSD Backend")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include routers
app.include_router(ussd.router, prefix="")
app.include_router(webhook.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(packages.router, prefix="/api")


# Removed hardcoded packages - packages should be managed through admin interface

@app.on_event("startup")
async def startup():
    # create DB tables if not exist (use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Initialize database session for admin user creation only
    from sqlalchemy.ext.asyncio import AsyncSession
    async_session = AsyncSession(engine)
    
    # Create default admin user if not exists
    from app.repositories.admin_user_repo import AdminUserRepository
    from app.schemas.auth import AdminCreate
    admin_repo = AdminUserRepository(async_session)
    existing_admin = await admin_repo.get_by_username("admin")
    if not existing_admin:
        default_admin = AdminCreate(
            username="admin",
            password="admin",  # Simple password within bcrypt limits
            role="superadmin"
        )
        await admin_repo.create(default_admin)
        print("✅ Default admin user created - Username: admin, Password: admin")
    
    await async_session.close()

@app.get("/")
async def root():
    return {"service": "netservice-backend", "status": "ok"}




