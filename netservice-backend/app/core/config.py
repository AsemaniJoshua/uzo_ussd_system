
# app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120

    DATABASE_URL: str

    MOOLRE_CALLBACK_SECRET: str | None = None

    THETELLER_API_KEY: str | None = None
    THETELLER_API_SECRET: str | None = None
    THETELLER_API_USERNAME: str | None = None
    THETELLER_MERCHANT_ID: str | None = None
    THETELLER_BASE_URL: str | None = None

    ADMIN_USERNAME: str | None = None
    ADMIN_PASSWORD: str | None = None
    THETELLER_CALLBACK_URL: str | None = None

    class Config:
        env_file = ".env"
        # extra = "ignore"

settings = Settings()
