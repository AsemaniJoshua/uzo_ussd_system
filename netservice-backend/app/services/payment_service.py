# app/services/payment_service.py

import logging
from app.clients.theteller_client import initiate_mobile_money, verify_payment
from app.repositories.transaction_repo import TransactionRepository
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings

logger = logging.getLogger(__name__)

class PaymentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = TransactionRepository(db)


    async def start_payment(self, transaction_id: int, amount: float, phone: str, metadata: dict):
        # Get transaction for details
        tx = await self.repo.get_by_id(transaction_id)
        if not tx:
            raise ValueError("Transaction not found")
        
        # Use transaction_id as TheTeller transaction_id
        tx_id = str(tx.id).zfill(12)
        desc = f"Data Bundle: {tx.package_name}"
        
        # Get network string for TheTeller
        network = tx.network.value if hasattr(tx.network, 'value') else str(tx.network)
        
        try:
            # Store transaction_id as payment_reference before calling TheTeller
            tx.payment_reference = tx_id
            await self.db.commit()
            
            # Call TheTeller API
            resp = await initiate_mobile_money(
                amount_ghs=float(amount),
                phone=phone,
                tx_id=tx_id,
                desc=desc,
                network=network
            )
            
            # Log successful initiation
            print(f"Payment initiated successfully: TX {tx_id}, Amount: {amount}, Phone: {phone}")
            print(f"TheTeller response: {resp}")
            
            # Update transaction status based on response
            status = resp.get("status")
            if status is None:
                status = ""
            status = status.lower()
            code = resp.get("code", "")
            
            if status in ("approved", "successful", "success") and code == "000":
                tx.status = "PAID"
            elif status in ("pending", "processing") or code == "000" or resp.get("reason", "") == "request received successfully":
                tx.status = "PENDING"
            else:
                tx.status = "FAILED"
            
            await self.db.commit()
            return resp
            
        except Exception as e:
            error_details = f"TheTeller payment initiation failed: {type(e).__name__}: {str(e)}"
            print(error_details)
            print(f"Transaction context - ID: {transaction_id}, Amount: {amount}, Phone: {phone}, Network: {network}")
            logger.error(error_details, exc_info=True)
            # Update transaction status to failed
            tx.status = "FAILED"
            await self.db.commit()
            raise e

    async def handle_webhook(self, payload: dict):
        """
        Handle TheTeller webhook for payment status updates.
        
        Common TheTeller response codes:
        - "000": Success/Approved
        - "111": Insufficient balance
        - "112": Wrong PIN/Incorrect PIN
        - "113": Transaction timeout
        - "114": Transaction cancelled by user
        """
        tx_id = payload.get("transaction_id") or payload.get("data", {}).get("transaction_id")
        status = payload.get("status") or payload.get("data", {}).get("status")
        code = payload.get("code") or payload.get("data", {}).get("code")
        reason = payload.get("reason") or payload.get("data", {}).get("reason", "")
        
        if not tx_id:
            logger.warning("Webhook received without transaction_id")
            return False
            
        logger.info(f"Webhook received - TX: {tx_id}, Status: {status}, Code: {code}, Reason: {reason}")
        
        # Update transaction status
        # TheTeller's primary success indicator is code '000'
        if code == "000" or (status and status.lower() in ("success", "paid", "completed", "approved", "successful")):
            await self.repo.update_status_by_ref(tx_id, "PAID")
            logger.info(f"Transaction {tx_id} marked as PAID")
        elif code == "112" or "incorrect pin" in reason.lower() or "wrong pin" in reason.lower():
            await self.repo.update_status_by_ref(tx_id, "FAILED")
            logger.warning(f"Transaction {tx_id} failed - Incorrect PIN")
            # TODO: Send SMS notification about incorrect PIN
        elif code == "111" or "insufficient" in reason.lower():
            await self.repo.update_status_by_ref(tx_id, "FAILED")
            logger.warning(f"Transaction {tx_id} failed - Insufficient balance")
            # TODO: Send SMS notification about insufficient balance
        elif code == "114" or "cancel" in reason.lower():
            await self.repo.update_status_by_ref(tx_id, "FAILED")
            logger.warning(f"Transaction {tx_id} cancelled by user")
        else:
            await self.repo.update_status_by_ref(tx_id, "FAILED")
            logger.warning(f"Transaction {tx_id} failed - Reason: {reason}")
            
        return True

    async def verify_and_update_payment(self, transaction_id: str):
        """
        Verifies payment status with TheTeller and updates transaction status in DB.
        """
        result = await verify_payment(transaction_id)
        # TheTeller response example:
        # {
        #   "code": "000",
        #   "status": "approved",
        #   "reason": "Transaction Successful",
        #   "transaction_id": "000000000267",
        #   ...
        # }
        status = result.get("status")
        if status is None:
            status = ""
        status = status.lower()
        code = result.get("code", "")
        
        # TheTeller's primary success indicator is code '000'
        if code == "000" or (status in ("approved", "successful", "success", "paid", "completed")):
            await self.repo.update_status_by_ref(transaction_id, "PAID")
        else:
            await self.repo.update_status_by_ref(transaction_id, "FAILED")
        return result
