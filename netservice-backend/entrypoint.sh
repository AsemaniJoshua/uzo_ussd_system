#!/bin/sh
set -e

# echo "Running database migrations..."
# alembic upgrade head

echo "SSH tunnel established. Starting FastAPI..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
