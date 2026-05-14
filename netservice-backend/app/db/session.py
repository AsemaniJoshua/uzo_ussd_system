# app/db/session.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from typing import AsyncGenerator

# --- DIRECT DATABASE CONNECTION (Active) ---
# Since you are now hosting MySQL on your VPS, we connect directly via the DATABASE_URL.
engine = create_async_engine(
    settings.DATABASE_URL, 
    pool_recycle=1800, 
    pool_pre_ping=True, 
    future=True, 
    echo=False
)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


# --- PROGRAMMATIC SSH TUNNEL (Commented Out) ---
# import logging
# import time
# from contextlib import asynccontextmanager
# from sqlalchemy.exc import OperationalError
# from sshtunnel import SSHTunnelForwarder
# 
# logger = logging.getLogger(__name__)
# 
# class DatabaseManager:
#     def __init__(self):
#         self._tunnel: SSHTunnelForwarder | None = None
#         self._engine = None
#         self._session_factory = None
# 
#     def _get_db_url(self, port: int) -> str:
#         return f"mysql+aiomysql://{settings.DB_USER}:{settings.DB_PASSWORD}@127.0.0.1:{port}/{settings.DB_NAME}"
# 
#     def _establish_tunnel(self):
#         if self._tunnel and self._tunnel.is_active:
#             try:
#                 if self._tunnel.ssh_client.get_transport() and self._tunnel.ssh_client.get_transport().is_active():
#                     return
#             except Exception:
#                 pass
#         if self._tunnel:
#             try: self._tunnel.stop()
#             except Exception: pass
#         try:
#             self._tunnel = SSHTunnelForwarder(
#                 (settings.SSH_HOST, settings.SSH_PORT),
#                 ssh_username=settings.SSH_USER,
#                 ssh_password=settings.SSH_PASSWORD,
#                 remote_bind_address=('127.0.0.1', 3306),
#                 local_bind_address=('127.0.0.1', 5522),
#                 set_keepalive=30.0,
#             )
#             self._tunnel.start()
#             time.sleep(1)
#             self._engine = None 
#         except Exception as e:
#             raise
#
#     def get_engine(self):
#         self._establish_tunnel()
#         if self._engine is None:
#             db_url = self._get_db_url(self._tunnel.local_bind_port)
#             self._engine = create_async_engine(db_url, pool_recycle=1200, pool_pre_ping=True)
#             self._session_factory = sessionmaker(self._engine, class_=AsyncSession, expire_on_commit=False)
#         return self._engine
#
#     @asynccontextmanager
#     async def session(self) -> AsyncGenerator[AsyncSession, None]:
#         self._establish_tunnel()
#         engine = self.get_engine()
#         session = self._session_factory()
#         try:
#             yield session
#             await session.commit()
#         except Exception:
#             await session.rollback()
#             raise
#         finally:
#             await session.close()
#
# db_manager = DatabaseManager()
#
# def __getattr__(name):
#     if name == "engine":
#         return db_manager.get_engine()
#     if name == "AsyncSessionLocal":
#         db_manager.get_engine()
#         return db_manager._session_factory
#     raise AttributeError(f"module {__name__} has no attribute {name}")
