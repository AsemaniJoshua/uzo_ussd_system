# app/repositories/settings_repo.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.orm_models import SystemSettings
from typing import Optional


class SettingsRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_setting(self, key: str) -> Optional[str]:
        """Get a setting value by key"""
        q = await self.db.execute(
            select(SystemSettings).where(SystemSettings.setting_key == key)
        )
        setting = q.scalars().first()
        return setting.setting_value if setting else None

    async def set_setting(self, key: str, value: str) -> SystemSettings:
        """Set or update a setting value"""
        q = await self.db.execute(
            select(SystemSettings).where(SystemSettings.setting_key == key)
        )
        setting = q.scalars().first()
        
        if setting:
            setting.setting_value = value
        else:
            setting = SystemSettings(setting_key=key, setting_value=value)
            self.db.add(setting)
        
        await self.db.commit()
        await self.db.refresh(setting)
        return setting

    async def is_ussd_restricted(self) -> bool:
        """Check if USSD is currently restricted"""
        value = await self.get_setting('ussd_restricted')
        return value == 'true' if value else False

    async def set_ussd_restriction(self, restricted: bool) -> SystemSettings:
        """Enable or disable USSD restriction"""
        return await self.set_setting('ussd_restricted', 'true' if restricted else 'false')
