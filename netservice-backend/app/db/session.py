# app/db/session.py

import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError
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
        # More robust check: verify transport is actually active
        if self._tunnel and self._tunnel.is_active:
            try:
                if self._tunnel.ssh_client.get_transport() and self._tunnel.ssh_client.get_transport().is_active():
                    return
            except Exception:
                pass
        
        # If dead or inactive, clean up old tunnel before restarting
        if self._tunnel:
            try:
                self._tunnel.stop()
            except Exception:
                pass

        try:
            logger.info(f"Establishing SSH tunnel to {settings.SSH_HOST}:{settings.SSH_PORT}...")
            self._tunnel = SSHTunnelForwarder(
                (settings.SSH_HOST, settings.SSH_PORT),
                ssh_username=settings.SSH_USER,
                ssh_password=settings.SSH_PASSWORD,
                remote_bind_address=('127.0.0.1', 3306),
                local_bind_address=('127.0.0.1', 5522),
                set_keepalive=30.0, # Reduced to 30s to prevent Namecheap timeouts
            )
            self._tunnel.start()
            time.sleep(1)
            logger.info(f"SSH tunnel established on local port: {self._tunnel.local_bind_port}")
            
            # Reset engine if tunnel port might have changed (though we use fixed 5522)
            self._engine = None 
        except Exception as e:
            logger.error(f"Failed to establish SSH tunnel: {e}")
            raise

    def get_engine(self):
        """Returns a configured SQLAlchemy engine, initializing if necessary."""
        self._establish_tunnel()

        if self._engine is None:
            db_url = self._get_db_url(self._tunnel.local_bind_port)
            self._engine = create_async_engine(
                db_url,
                pool_recycle=1200, # Reduced to 20m for safety
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
        """Provides a safe async session scope with auto-healing and retry logic."""
        # Check tunnel health before yielding session
        self._establish_tunnel()
        
        engine = self.get_engine()
        session = self._session_factory()
        try:
            try:
                yield session
                await session.commit()
            except (OperationalError, Exception) as e:
                # If we lose connection, try to heal tunnel and retry once
                error_msg = str(e).lower()
                if "lost connection" in error_msg or "ssh session not active" in error_msg:
                    logger.warning("Database connection lost. Healing tunnel and retrying...")
                    self._tunnel = None # Force re-establishment
                    self._establish_tunnel()
                    # Re-yield from a fresh session might be complex here, so we raise
                    # but the NEXT request will be perfectly healed.
                    # For immediate retry:
                    await session.rollback()
                    await session.close()
                    
                    engine = self.get_engine()
                    new_session = self._session_factory()
                    try:
                        yield new_session
                        await new_session.commit()
                    finally:
                        await new_session.close()
                else:
                    raise
        except Exception:
            await session.rollback()
            raise
        finally:
            if session:
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
