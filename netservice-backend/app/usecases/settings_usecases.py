# app/usecases/settings_usecases.py
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.settings_repo import SettingsRepository


class SettingsUseCases:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = SettingsRepository(db)

    async def is_ussd_restricted(self) -> bool:
        """Check if USSD access is restricted"""
        return await self.repo.is_ussd_restricted()

    async def set_ussd_restriction(self, restricted: bool) -> dict:
        """Enable or disable USSD restriction"""
        setting = await self.repo.set_ussd_restriction(restricted)
        return {
            "ussd_restricted": setting.setting_value == 'true',
            "updated_at": setting.updated_at.isoformat()
        }

    async def get_all_settings(self) -> dict:
        """Get all system settings"""
        ussd_restricted = await self.repo.is_ussd_restricted()
        return {
            "ussd_restricted": ussd_restricted
        }
