# app/core/security.py
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from .config import settings
import bcrypt

# Simple bcrypt context configuration
pwd_context = CryptContext(
    schemes=["bcrypt"], 
    deprecated="auto"
)
ALGORITHM = "HS256"

def create_access_token(subject: str, expires_minutes: int | None = None):
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)

def verify_access_token(token: str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except Exception:
        return None

def get_password_hash(password: str) -> str:
    """Hash password using bcrypt"""
    # Ensure password is within bcrypt limits (72 bytes)
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password = password_bytes[:72].decode('utf-8', errors='ignore')
    
    # Use bcrypt directly for more reliable hashing
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash"""
    try:
        # Try bcrypt first
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        # Fall back to passlib if bcrypt fails
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False
