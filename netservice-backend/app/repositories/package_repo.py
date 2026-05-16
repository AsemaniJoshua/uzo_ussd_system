from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.orm_models import Package, NetworkEnum
from app.schemas.package_schemas import PackageCreate, PackageUpdate
from typing import List, Optional

class PackageRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self, network: Optional[NetworkEnum] = None) -> List[Package]:
        stmt = select(Package)
        if network:
            # Use the string value to avoid Enum class mismatch issues
            val = network.value if hasattr(network, 'value') else str(network)
            stmt = stmt.where(Package.network == val)
        q = await self.db.execute(stmt)
        return q.scalars().all()

    async def get_by_id(self, id: int) -> Optional[Package]:
        q = await self.db.execute(select(Package).where(Package.id == id))
        return q.scalars().first()

    async def create(self, data: PackageCreate) -> Package:
        obj = Package(**data.dict())
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def update(self, id: int, data: PackageUpdate) -> Optional[Package]:
        obj = await self.get_by_id(id)
        if not obj:
            return None
        for field, value in data.dict(exclude_unset=True).items():
            setattr(obj, field, value)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def delete(self, id: int) -> bool:
        obj = await self.get_by_id(id)
        if not obj:
            return False
        await self.db.delete(obj)
        await self.db.commit()
        return True
