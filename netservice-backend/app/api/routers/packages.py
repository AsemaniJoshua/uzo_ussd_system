from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_session
from app.repositories.package_repo import PackageRepository
from app.schemas.package_schemas import PackageOut, PackageCreate, PackageUpdate, NetworkEnum
from typing import List, Optional

router = APIRouter(prefix="/packages", tags=["packages"])

@router.get("/", response_model=List[PackageOut])
async def list_packages(network: Optional[NetworkEnum] = None, db: AsyncSession = Depends(get_session)):
    repo = PackageRepository(db)
    return await repo.get_all(network)

@router.get("/{package_id}", response_model=PackageOut)
async def get_package(package_id: int, db: AsyncSession = Depends(get_session)):
    repo = PackageRepository(db)
    pkg = await repo.get_by_id(package_id)
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    return pkg

@router.post("/", response_model=PackageOut)
async def create_package(data: PackageCreate, db: AsyncSession = Depends(get_session)):
    repo = PackageRepository(db)
    return await repo.create(data)

@router.put("/{package_id}", response_model=PackageOut)
async def update_package(package_id: int, data: PackageUpdate, db: AsyncSession = Depends(get_session)):
    repo = PackageRepository(db)
    pkg = await repo.update(package_id, data)
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    return pkg

@router.delete("/{package_id}")
async def delete_package(package_id: int, db: AsyncSession = Depends(get_session)):
    repo = PackageRepository(db)
    ok = await repo.delete(package_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Package not found")
    return {"status": True}
