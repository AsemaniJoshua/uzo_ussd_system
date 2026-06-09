#!/bin/sh
set -e

echo "SSH tunnel established. Starting FastAPI..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
