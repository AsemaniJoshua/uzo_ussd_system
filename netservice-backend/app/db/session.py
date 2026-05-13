# app/db/session.py

import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sshtunnel import SSHTunnelForwarder

from app.core.config import settings

logger = logging.getLogger(__name__)

# --- NEW AUTO-HEALING SSH TUNNEL CONFIGURATION ---
class DatabaseManager:
    def __init__(self):
        self._tunnel: SSHTunnelForwarder | None = None
        self._engine = None
        self._session_factory = None

    def _get_db_url(self, port: int) -> str:
        """Construct the async database URL using the tunnel's local port."""
        return f"mysql+aiomysql://{settings.DB_USER}:{settings.DB_PASSWORD}@127.0.0.1:{port}/{settings.DB_NAME}"

    def _establish_tunnel(self):
        """Programmatically establish and verify the SSH tunnel."""
        if self._tunnel and self._tunnel.is_active:
            return

        try:
            logger.info(f"Establishing SSH tunnel to {settings.SSH_HOST}:{settings.SSH_PORT}...")
            self._tunnel = SSHTunnelForwarder(
                (settings.SSH_HOST, settings.SSH_PORT),
                ssh_username=settings.SSH_USER,
                ssh_password=settings.SSH_PASSWORD,
                remote_bind_address=('127.0.0.1', 3306),
                local_bind_address=('127.0.0.1', 10022),
                set_keepalive=60.0,
            )
            self._tunnel.start()
            logger.info(f"SSH tunnel established on local port: {self._tunnel.local_bind_port}")
        except Exception as e:
            logger.error(f"Failed to establish SSH tunnel: {e}")
            raise

    def get_engine(self):
        """Returns a configured SQLAlchemy engine, initializing if necessary."""
        # Ensure tunnel is active before creating/returning engine
        self._establish_tunnel()

        if self._engine is None:
            db_url = self._get_db_url(self._tunnel.local_bind_port)
            self._engine = create_async_engine(
                db_url,
                pool_recycle=1800,
                pool_pre_ping=True,
                echo=False,
                future=True,
            )
            self._session_factory = sessionmaker(
                self._engine, 
                class_=AsyncSession, 
                expire_on_commit=False
            )
        return self._engine

    @asynccontextmanager
    async def session(self) -> AsyncGenerator[AsyncSession, None]:
        """Provides a safe async session scope with auto-healing tunnel checks."""
        # Check tunnel health before yielding session
        if not self._tunnel or not self._tunnel.is_active:
            logger.warning("SSH Tunnel dropped. Re-establishing...")
            self._establish_tunnel()

        engine = self.get_engine()
        session = self._session_factory()
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# Singleton instance
db_manager = DatabaseManager()

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI Dependency for yielding database sessions."""
    async with db_manager.session() as session:
        yield session

def __getattr__(name):
    """Lazy module-level attributes to maintain compatibility with existing imports."""
    if name == "engine":
        return db_manager.get_engine()
    if name == "AsyncSessionLocal":
        db_manager.get_engine()  # ensures session_factory is initialized
        return db_manager._session_factory
    raise AttributeError(f"module {__name__} has no attribute {name}")

# --- ORIGINAL CONFIGURATION (Commented Out) ---
# from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
# from sqlalchemy.orm import sessionmaker
# from app.core.config import settings
# 
# engine = create_async_engine(settings.DATABASE_URL, future=True, echo=False)
# AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
# 
# async def get_session():
#     async with AsyncSessionLocal() as session:
#         yield session
