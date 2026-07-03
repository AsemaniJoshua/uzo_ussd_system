from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_session
from app.repositories.package_repo import PackageRepository
from app.schemas.package_schemas import PackageOut, PackageCreate, PackageUpdate, NetworkEnum
from typing import List, Optional
from app.api.routers.admin import get_superadmin

# New imports for web purchase checkout
import uuid
import random
from sqlalchemy import select, or_
from app.schemas.purchase_schemas import PurchaseRequest, PurchaseResponse
from app.repositories.transaction_repo import TransactionRepository
from app.schemas.request_schemas import CreateTransactionIn
from app.clients.theteller_client import initiate_checkout_payment
from app.models.orm_models import Transaction, ServedRequest

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
async def create_package(data: PackageCreate, db: AsyncSession = Depends(get_session), admin = Depends(get_superadmin)):
    repo = PackageRepository(db)
    return await repo.create(data)

@router.put("/{package_id}", response_model=PackageOut)
async def update_package(package_id: int, data: PackageUpdate, db: AsyncSession = Depends(get_session), admin = Depends(get_superadmin)):
    repo = PackageRepository(db)
    pkg = await repo.update(package_id, data)
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    return pkg

@router.delete("/{package_id}")
async def delete_package(package_id: int, db: AsyncSession = Depends(get_session), admin = Depends(get_superadmin)):
    repo = PackageRepository(db)
    ok = await repo.delete(package_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Package not found")
    return {"status": True}


@router.post("/purchase", response_model=PurchaseResponse)
async def purchase_package(data: PurchaseRequest, db: AsyncSession = Depends(get_session)):
    # 1. Fetch package from DB
    pkg_repo = PackageRepository(db)
    pkg = await pkg_repo.get_by_id(data.package_id)
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    if not pkg.active:
        raise HTTPException(status_code=400, detail="Package is inactive")

    # 2. Generate unique 12-digit transaction ID for TheTeller
    theteller_tx_id = str(random.randint(100000000000, 999999999999))

    # Create transaction row in DB
    tx_repo = TransactionRepository(db)
    tx_in = CreateTransactionIn(
        session_id=f"web_{uuid.uuid4().hex[:16]}",
        user_msisdn=data.recipient,
        network=pkg.network.value if hasattr(pkg.network, "value") else str(pkg.network),
        package_id=pkg.id,
        package_name=pkg.package_name,
        amount=pkg.amount,
        profit_amount=pkg.profit_amount or 0,
        recipient=data.recipient,
        payment_method="Web Checkout"
    )
    tx = await tx_repo.create(tx_in)
    
    # Save reference
    tx.payment_reference = theteller_tx_id
    await db.commit()

    try:
        # 3. Call TheTeller Checkout Initiate API
        resp = await initiate_checkout_payment(
            amount_ghs=float(pkg.amount),
            tx_id=theteller_tx_id,
            desc=f"Data Bundle: {pkg.package_name}",
            redirect_url=data.redirect_url,
            email=data.email
        )
        
        checkout_url = resp.get("checkout_url")
        if not checkout_url:
            raise Exception("checkout_url missing from TheTeller response")
            
        return PurchaseResponse(
            status="pending",
            transaction_id=tx.id,
            checkout_url=checkout_url,
            message="Checkout session initiated successfully"
        )
    except Exception as e:
        # Mark transaction as failed if initiation failed
        tx.status = "FAILED"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to initiate payment: {str(e)}")


@router.get("/purchase/status/{ref}")
async def get_purchase_status(ref: str, db: AsyncSession = Depends(get_session)):
    ref_str = str(ref).strip()
    ref_padded = ref_str.zfill(12)
    
    conditions = [
        Transaction.payment_reference == ref_str,
        Transaction.payment_reference == ref_padded
    ]
    if ref_str.isdigit():
        conditions.append(Transaction.id == int(ref_str))
        
    q = await db.execute(select(Transaction).where(or_(*conditions)))
    tx = q.scalars().first()
    if tx:
        # FALLBACK: If status is PENDING, check the status in real-time with TheTeller API
        if tx.status == "PENDING" and tx.payment_reference:
            try:
                from app.clients.theteller_client import verify_payment
                resp = await verify_payment(tx.payment_reference)
                print(f"Real-time TheTeller status check for {tx.payment_reference}: {resp}")
                
                # Check status/code
                status_lower = resp.get("status", "").lower() if resp.get("status") else ""
                code = resp.get("code")
                reason_lower = resp.get("reason", "").lower() if resp.get("reason") else ""
                
                is_success = (
                    code == "000" or 
                    status_lower in ("success", "paid", "completed", "approved", "successful")
                )
                is_failed = (
                    code in ("111", "112", "113", "114", "999") or
                    status_lower in ("failed", "cancelled", "declined")
                )
                
                if is_success:
                    tx.status = "PAID"
                    await db.commit()
                    await db.refresh(tx)
                    print(f"Transaction {tx.id} updated to PAID via real-time check")
                elif is_failed:
                    tx.status = "FAILED"
                    await db.commit()
                    await db.refresh(tx)
                    print(f"Transaction {tx.id} updated to FAILED via real-time check")
            except Exception as ex:
                print(f"Error during real-time TheTeller status check: {ex}")
                
        return {
            "status": tx.status,
            "id": tx.id,
            "payment_reference": tx.payment_reference,
            "amount": float(tx.amount),
            "package_name": tx.package_name,
            "recipient": tx.recipient
        }
        
    # Check if moved to served_requests (paid and processed)
    served_conditions = [
        ServedRequest.payment_reference == ref_str,
        ServedRequest.payment_reference == ref_padded
    ]
    if ref_str.isdigit():
        served_conditions.append(ServedRequest.transaction_id == int(ref_str))
        
    q_served = await db.execute(select(ServedRequest).where(or_(*served_conditions)))
    served = q_served.scalars().first()
    if served:
        return {
            "status": "PAID",
            "id": served.transaction_id,
            "payment_reference": served.payment_reference,
            "amount": float(served.amount),
            "package_name": served.package_name,
            "recipient": served.recipient
        }
        
    raise HTTPException(status_code=404, detail="Transaction not found")

