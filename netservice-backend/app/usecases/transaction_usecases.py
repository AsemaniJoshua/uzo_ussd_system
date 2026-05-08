# app/usecases/transaction_usecases.py
from app.repositories.transaction_repo import TransactionRepository
from app.schemas.request_schemas import CreateTransactionIn
from sqlalchemy.ext.asyncio import AsyncSession

class TransactionUseCases:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = TransactionRepository(db)

    async def create_transaction(self, data: CreateTransactionIn):
        return await self.repo.create(data)

    async def list_transactions(self, skip: int=0, limit: int=100):
        return await self.repo.list(skip=skip, limit=limit)

    async def serve_transaction(self, tx_id: int, processed_by: str | None = None):
        tx = await self.repo.get_by_id(tx_id)
        if not tx:
            return None
        
        # Only allow serving PAID transactions
        if tx.status != "PAID":
            raise ValueError(f"Cannot serve transaction with status '{tx.status}'. Only PAID transactions can be served.")
        
        return await self.repo.move_to_served(tx, processed_by)

    async def list_served_requests(self, skip: int=0, limit: int=100):
        return await self.repo.list_served(skip=skip, limit=limit)

    async def unserve_request(self, served_id: int):
        """Move a served request back to transactions (unserve)"""
        served = await self.repo.get_served_by_id(served_id)
        if not served:
            return None
        return await self.repo.move_back_to_transaction(served)

    async def delete_served_request(self, served_id: int):
        """Permanently delete a served request"""
        served = await self.repo.get_served_by_id(served_id)
        if not served:
            return None
        await self.repo.delete_served(served)
        return True

    async def user_has_paid_before(self, msisdn: str) -> bool:
        """Check if user has any paid transaction ever"""
        return await self.repo.has_paid_transaction(msisdn)
