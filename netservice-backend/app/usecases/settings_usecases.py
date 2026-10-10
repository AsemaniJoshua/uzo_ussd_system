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

    async def is_voting_enabled(self) -> bool:
        """Check if voting decoy mode is enabled"""
        return await self.repo.is_voting_enabled()

    async def set_voting_enabled(self, enabled: bool) -> dict:
        """Enable or disable voting decoy mode"""
        setting = await self.repo.set_voting_enabled(enabled)
        return {
            "voting_enabled": setting.setting_value == 'true',
            "updated_at": setting.updated_at.isoformat()
        }

    async def get_all_settings(self) -> dict:
        """Get all system settings"""
        ussd_restricted = await self.repo.is_ussd_restricted()
        voting_enabled = await self.repo.is_voting_enabled()
        return {
            "ussd_restricted": ussd_restricted,
            "voting_enabled": voting_enabled
        }
