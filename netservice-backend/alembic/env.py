
import sys
import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context


# Load .env variables automatically
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from app.core.config import settings

# Programmatic SSH Tunnel for migrations
tunnel = None
db_port = 5522 # Default MySQL port

if settings.SSH_HOST:
    from sshtunnel import SSHTunnelForwarder
    print(f"Establishing SSH tunnel for migrations to {settings.SSH_HOST}...")
    tunnel = SSHTunnelForwarder(
        (settings.SSH_HOST, settings.SSH_PORT),
        ssh_username=settings.SSH_USER,
        ssh_password=settings.SSH_PASSWORD,
        remote_bind_address=('127.0.0.1', 3306),
        local_bind_address=('127.0.0.1', 10022),
    )
    tunnel.start()
    db_port = tunnel.local_bind_port
    print(f"Tunnel active on port {db_port}")

# Construct synchronous URL for migrations
if settings.DATABASE_URL:
    database_url = settings.DATABASE_URL
    if 'aiomysql' in database_url:
        database_url = database_url.replace('mysql+aiomysql://', 'mysql+pymysql://')
else:
    # Build from components
    database_url = f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}@127.0.0.1:{db_port}/{settings.DB_NAME}"

# --- ORIGINAL MIGRATION CONFIG (Commented Out) ---
# # Convert async DATABASE_URL to sync for migrations
# database_url = os.getenv('DATABASE_URL')
# if database_url and 'aiomysql' in database_url:
#     database_url = database_url.replace('mysql+aiomysql://', 'mysql+pymysql://')
# config.set_main_option('sqlalchemy.url', database_url)

config = context.config
config.set_main_option('sqlalchemy.url', database_url)

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.db.base import Base
from app.models import orm_models  # ensure models are imported
from app.core.config import settings

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline():
    url = settings.DATABASE_URL
    context.configure(
        url=url, target_metadata=target_metadata, literal_binds=True, compare_type=True
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata, compare_type=True
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
