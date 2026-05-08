"""
Batched Deletion Script - Deletes in small chunks to avoid lock timeouts
"""

import asyncio
import sys
import os
from pathlib import Path
from sqlalchemy import text

# Fix Windows console encoding
if sys.platform == 'win32':
    os.system('chcp 65001 >nul 2>&1')
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app.db.session import AsyncSessionLocal


async def delete_in_batches(batch_size=500):
    """Delete whitelist entries in small batches"""
    
    print("\n" + "="*70)
    print("🗑️  BATCHED DELETION - WHITELIST ENTRIES")
    print("="*70 + "\n")
    
    async with AsyncSessionLocal() as db:
        # Check initial count
        count_query = text("""
            SELECT COUNT(*) as total
            FROM served_requests 
            WHERE processed_by = 'SYSTEM_WHITELIST_IMPORT'
        """)
        
        result = await db.execute(count_query)
        initial_count = result.scalar()
        
        print(f"📊 Initial count: {initial_count} entries")
        print(f"📦 Batch size: {batch_size} records per batch\n")
        
        if initial_count == 0:
            print("✅ No entries to delete!")
            return
        
        total_deleted = 0
        batch_number = 1
        
        while True:
            # Delete one batch
            delete_query = text(f"""
                DELETE FROM served_requests 
                WHERE processed_by = 'SYSTEM_WHITELIST_IMPORT'
                LIMIT {batch_size}
            """)
            
            result = await db.execute(delete_query)
            await db.commit()
            
            rows_deleted = result.rowcount
            total_deleted += rows_deleted
            
            print(f"✅ Batch {batch_number}: Deleted {rows_deleted} records (Total: {total_deleted}/{initial_count})")
            
            # Stop if no more rows to delete
            if rows_deleted == 0:
                break
            
            batch_number += 1
            
            # Small delay to reduce database load
            await asyncio.sleep(0.1)
        
        print(f"\n🎉 Deletion complete!")
        print(f"📊 Total deleted: {total_deleted} entries")
        
        # Verify
        final_result = await db.execute(count_query)
        final_count = final_result.scalar()
        
        print(f"📊 Remaining entries: {final_count}")


async def main():
    try:
        await delete_in_batches(batch_size=500)
        
    except KeyboardInterrupt:
        print("\n\n❌ Operation cancelled (Ctrl+C)")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
