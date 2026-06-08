# app/repositories/transaction_repo.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_
from app.models.orm_models import Transaction, ServedRequest, Package
from app.schemas.request_schemas import CreateTransactionIn
from decimal import Decimal
from typing import List, Optional

class TransactionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, inp: CreateTransactionIn) -> Transaction:
        obj = Transaction(
            session_id=inp.session_id,
            user_msisdn=inp.user_msisdn,
            network=inp.network,
            package_id=inp.package_id,
            package_name=inp.package_name,
            amount=inp.amount,
            profit_amount=inp.profit_amount,
            recipient=inp.recipient,
            payment_method=inp.payment_method,
            status="PENDING"
        )
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def get_by_id(self, id: int) -> Optional[Transaction]:
        q = await self.db.execute(select(Transaction).where(Transaction.id == id))
        return q.scalars().first()

    async def list(self, skip: int=0, limit: int=100) -> List[Transaction]:
        q = await self.db.execute(select(Transaction).order_by(Transaction.created_at.desc()).offset(skip).limit(limit))
        return q.scalars().all()

    async def update_status_by_ref(self, ref: str, status: str):
        # Handle both zero-padded and non-padded references, and support numeric fallback
        ref_str = str(ref).strip()
        ref_padded = ref_str.zfill(12)
        
        conditions = [
            Transaction.payment_reference == ref_str,
            Transaction.payment_reference == ref_padded
        ]
        
        if ref_str.isdigit():
            conditions.append(Transaction.id == int(ref_str))
            
        q = await self.db.execute(select(Transaction).where(or_(*conditions)))
        obj = q.scalars().first()
        if obj:
            obj.status = status
            await self.db.commit()
            await self.db.refresh(obj)
            print(f"[Repo] Successfully updated transaction ID {obj.id} (ref={obj.payment_reference}) status to {status}")
        else:
            print(f"[Repo] WARNING: No transaction found matching reference '{ref_str}' or '{ref_padded}'")
        return obj

    async def move_to_served(self, tx: Transaction, processed_by: str | None = None):
        served = ServedRequest(
            transaction_id=tx.id,
            network=tx.network.value if hasattr(tx.network, "value") else tx.network,
            package_name=tx.package_name,
            amount=tx.amount,
            profit_amount=tx.profit_amount,
            recipient=tx.recipient,
            processed_by=processed_by,
            payment_reference=tx.payment_reference,
            status=tx.status,  # Preserve original status
            session_id=tx.session_id,  # Preserve session_id
            user_msisdn=tx.user_msisdn  # Preserve user_msisdn
        )
        self.db.add(served)
        # delete old transaction
        await self.db.flush()
        await self.db.delete(tx)
        await self.db.commit()
        await self.db.refresh(served)
        return served

    async def delete(self, tx: Transaction):
        await self.db.delete(tx)
        await self.db.commit()

    async def get_served_by_id(self, served_id: int) -> Optional[ServedRequest]:
        q = await self.db.execute(select(ServedRequest).where(ServedRequest.id == served_id))
        return q.scalars().first()

    async def list_served(self, skip: int=0, limit: int=100) -> List[ServedRequest]:
        q = await self.db.execute(select(ServedRequest).order_by(ServedRequest.served_at.desc()).offset(skip).limit(limit))
        return q.scalars().all()

    async def move_back_to_transaction(self, served: ServedRequest) -> Transaction:
        """Move a served request back to transactions table (unserve)"""
        # Create transaction from served request, preserving original data
        # Convert network string to NetworkEnum
        from app.models.orm_models import NetworkEnum
        network_value = served.network if isinstance(served.network, NetworkEnum) else NetworkEnum(served.network)
        
        tx = Transaction(
            session_id=served.session_id or f"unserved_{served.id}",
            user_msisdn=served.user_msisdn or "",
            network=network_value,
            package_id=None,
            package_name=served.package_name,
            amount=served.amount,
            profit_amount=served.profit_amount,
            recipient=served.recipient,
            payment_method=None,
            payment_reference=served.payment_reference,
            status=served.status or "PAID"  # Restore original status
        )
        self.db.add(tx)
        # Delete from served_requests
        await self.db.flush()
        await self.db.delete(served)
        await self.db.commit()
        await self.db.refresh(tx)
        return tx

    async def delete_served(self, served: ServedRequest):
        """Permanently delete a served request"""
        await self.db.delete(served)
        await self.db.commit()

    async def has_paid_transaction(self, msisdn: str) -> bool:
        """Check if user has ANY paid transaction (in transactions or served_requests table)"""
        # Check in transactions table
        q1 = await self.db.execute(
            select(Transaction)
            .where(Transaction.user_msisdn == msisdn)
            .where(Transaction.status == "PAID")
            .limit(1)
        )
        if q1.scalars().first():
            return True
        
        # Check in served_requests table
        q2 = await self.db.execute(
            select(ServedRequest)
            .where(ServedRequest.user_msisdn == msisdn)
            .where(ServedRequest.status == "PAID")
            .limit(1)
        )
        return q2.scalars().first() is not None

    async def list_by_date(self, parsed_date, status: str = "PAID") -> List[Transaction]:
        from sqlalchemy import func
        q = await self.db.execute(
            select(Transaction)
            .where(func.date(Transaction.created_at) == parsed_date)
            .where(Transaction.status == status)
            .order_by(Transaction.created_at.desc())
        )
        return q.scalars().all()

    async def list_recent_days(self, days: int = 3) -> List[Transaction]:
        from datetime import datetime, time, timedelta
        today = datetime.now().date()
        start_date = today - timedelta(days=days - 1)
        start_datetime = datetime.combine(start_date, time.min)
        
        q = await self.db.execute(
            select(Transaction)
            .where(Transaction.created_at >= start_datetime)
            .order_by(Transaction.created_at.desc())
        )
        return q.scalars().all()


