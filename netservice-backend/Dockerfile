FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libssl-dev \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Set entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN dos2unix /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

# --- ORIGINAL DOCKERFILE (Commented Out) ---
# FROM python:3.11-slim
# 
# WORKDIR /app
# 
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt
# 
# COPY . .
# 
# ENV PYTHONDONTWRITEBYTECODE=1
# ENV PYTHONUNBUFFERED=1
# 
# 
# RUN apt-get update && apt-get install -y openssh-client netcat-openbsd
# 
# 
# # Render: Write SSH private key from environment variable or secret mount
# RUN mkdir -p /root/.ssh
# COPY entrypoint.sh /entrypoint.sh
# RUN chmod +x /entrypoint.sh
# 
# CMD ["/entrypoint.sh"]
