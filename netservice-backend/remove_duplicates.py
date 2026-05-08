"""
Efficient Duplicate Removal Script
===================================
Uses a single SQL query to remove duplicates efficiently without lock timeouts
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


async def remove_duplicates_efficiently():
    """Remove duplicates using a single efficient SQL query"""
    
    print("\n" + "="*70)
    print("🧹 EFFICIENT DUPLICATE REMOVAL")
    print("="*70 + "\n")
    
    async with AsyncSessionLocal() as db:
        # Step 1: Check current state
        print("📊 Checking current state...")
        count_query = text("""
            SELECT COUNT(*) as total,
                   COUNT(DISTINCT user_msisdn) as unique_users
            FROM served_requests 
            WHERE processed_by = 'SYSTEM_WHITELIST_IMPORT'
        """)
        
        result = await db.execute(count_query)
        row = result.first()
        total_before = row.total
        unique_users = row.unique_users
        
        print(f"   Total entries: {total_before}")
        print(f"   Unique users: {unique_users}")
        print(f"   Duplicates to remove: {total_before - unique_users}\n")
        
        if total_before == unique_users:
            print("✅ No duplicates found!")
            return
        
        # Step 2: Delete duplicates using efficient SQL
        # Keep only the record with the minimum ID for each user_msisdn
        print("⏳ Removing duplicates (this may take a moment)...")
        
        delete_query = text("""
            DELETE FROM served_requests
            WHERE processed_by = 'SYSTEM_WHITELIST_IMPORT'
            AND id NOT IN (
                SELECT MIN(id)
                FROM (
                    SELECT id, user_msisdn
                    FROM served_requests
                    WHERE processed_by = 'SYSTEM_WHITELIST_IMPORT'
                ) AS subquery
                GROUP BY user_msisdn
            )
        """)
        
        # Execute the delete
        result = await db.execute(delete_query)
        await db.commit()
        
        deleted_count = result.rowcount
        print(f"✅ Removed {deleted_count} duplicate entries\n")
        
        # Step 3: Verify final state
        print("📊 Verifying final state...")
        verify_result = await db.execute(count_query)
        verify_row = verify_result.first()
        total_after = verify_row.total
        unique_after = verify_row.unique_users
        
        print(f"   Total entries: {total_after}")
        print(f"   Unique users: {unique_after}")
        
        if total_after == unique_after:
            print("\n✅ All duplicates successfully removed!")
            print(f"📝 Final count: {total_after} unique whitelisted users")
        else:
            print(f"\n⚠️  Warning: Still have {total_after - unique_after} duplicates")


async def main():
    try:
        await remove_duplicates_efficiently()
        
        print("\n💡 To verify, run:")
        print("   SELECT COUNT(*) FROM served_requests WHERE processed_by = 'SYSTEM_WHITELIST_IMPORT';")
        print("\n💡 To check unique users:")
        print("   SELECT COUNT(DISTINCT user_msisdn) FROM served_requests WHERE processed_by = 'SYSTEM_WHITELIST_IMPORT';")
        
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
