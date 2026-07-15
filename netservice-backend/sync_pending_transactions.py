# sync_pending_transactions.py
import asyncio
import os
import sys
from datetime import datetime, timedelta
from sqlalchemy import select

# Add parent directory to path so app modules can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import AsyncSessionLocal
from app.models.orm_models import Transaction
from app.clients.theteller_client import verify_payment

async def main():
    print("=== Starting Transaction Status Synchronization ===")
    print("==================================================")
    
    async with AsyncSessionLocal() as session:
        # Fetch PENDING transactions from the last 3 days
        three_days_ago = datetime.utcnow() - timedelta(days=3)
        query = select(Transaction).where(
            Transaction.status == "PENDING",
            Transaction.created_at >= three_days_ago
        )
        
        result = await session.execute(query)
        pending_txs = result.scalars().all()
        
        if not pending_txs:
            print("INFO: No PENDING transactions found in the last 3 days.")
            return
            
        print(f"INFO: Found {len(pending_txs)} pending transactions to verify.\n")
        
        success_count = 0
        failed_count = 0
        still_pending_count = 0
        
        for tx in pending_txs:
            ref = tx.payment_reference
            if not ref:
                print(f"WARN: Tx ID {tx.id} has no payment_reference. Skipping.")
                continue
                
            print(f"Checking Tx ID: {tx.id} | Ref: {ref} | Recipient: {tx.recipient} | Amount: GHS {tx.amount} | Network: {tx.network}")
            try:
                resp = await verify_payment(ref)
                
                status_lower = resp.get("status", "").lower() if resp.get("status") else ""
                code = resp.get("code")
                
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
                    await session.commit()
                    success_count += 1
                    print(f"   -> [PAID] Status updated successfully in DB.")
                elif is_failed:
                    tx.status = "FAILED"
                    await session.commit()
                    failed_count += 1
                    print(f"   -> [FAILED] Status updated in DB.")
                else:
                    still_pending_count += 1
                    print(f"   -> [PENDING] Still pending on TheTeller (Reason: {resp.get('reason', 'N/A')}).")
                    
            except Exception as e:
                print(f"   -> ERROR checking status: {e}")
                
        print("\n==================================================")
        print("Synchronization Summary:")
        print(f"   - Total Checked: {len(pending_txs)}")
        print(f"   - Updated to PAID: {success_count}")
        print(f"   - Updated to FAILED: {failed_count}")
        print(f"   - Remaining PENDING: {still_pending_count}")
        print("==================================================")

if __name__ == "__main__":
    asyncio.run(main())
