"""
Check and Remove Duplicate Whitelist Entries
=============================================
Analyzes and removes duplicate user_msisdn entries from served_requests table
where processed_by = 'SYSTEM_WHITELIST_IMPORT'
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime

# Fix Windows console encoding
if sys.platform == 'win32':
    os.system('chcp 65001 >nul 2>&1')
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import select, func, delete
from app.db.session import AsyncSessionLocal
from app.models.orm_models import ServedRequest

async def analyze_duplicates():
    """Analyze duplicate whitelist entries"""
    print("\n" + "="*70)
    print("🔍 ANALYZING WHITELIST DUPLICATE ENTRIES")
    print("="*70 + "\n")
    
    async with AsyncSessionLocal() as db:
        # Count total whitelist entries
        total_result = await db.execute(
            select(func.count(ServedRequest.id))
            .where(ServedRequest.processed_by == 'SYSTEM_WHITELIST_IMPORT')
        )
        total_count = total_result.scalar()
        
        print(f"📊 Total whitelist entries: {total_count}")
        
        # Find duplicates by user_msisdn
        duplicates_query = select(
            ServedRequest.user_msisdn,
            func.count(ServedRequest.id).label('count')
        ).where(
            ServedRequest.processed_by == 'SYSTEM_WHITELIST_IMPORT'
        ).group_by(
            ServedRequest.user_msisdn
        ).having(
            func.count(ServedRequest.id) > 1
        )
        
        duplicates_result = await db.execute(duplicates_query)
        duplicates = duplicates_result.all()
        
        if duplicates:
            print(f"\n⚠️  Found {len(duplicates)} users with duplicate entries:")
            print("\nUser MSISDN               | Count")
            print("-" * 40)
            
            total_duplicate_count = 0
            for msisdn, count in duplicates[:20]:  # Show first 20
                print(f"{msisdn:24} | {count}")
                total_duplicate_count += count
            
            if len(duplicates) > 20:
                print(f"... and {len(duplicates) - 20} more")
            
            extra_entries = total_duplicate_count - len(duplicates)
            print(f"\n📈 Statistics:")
            print(f"   Unique users with duplicates: {len(duplicates)}")
            print(f"   Total entries for these users: {total_duplicate_count}")
            print(f"   Extra entries to remove: {extra_entries}")
            
            # Calculate what should remain
            unique_result = await db.execute(
                select(func.count(func.distinct(ServedRequest.user_msisdn)))
                .where(ServedRequest.processed_by == 'SYSTEM_WHITELIST_IMPORT')
            )
            unique_count = unique_result.scalar()
            
            print(f"\n✅ After cleanup:")
            print(f"   Unique users: {unique_count}")
            print(f"   Entries to keep: {unique_count} (one per user)")
            print(f"   Entries to remove: {total_count - unique_count}")
            
        else:
            print("\n✅ No duplicates found! All entries are unique.")


async def remove_duplicates():
    """Remove duplicate whitelist entries, keeping only the oldest one per user"""
    print("\n" + "="*70)
    print("🧹 REMOVING DUPLICATE WHITELIST ENTRIES")
    print("="*70 + "\n")
    
    async with AsyncSessionLocal() as db:
        # Find all user_msisdns with duplicates
        duplicates_query = select(
            ServedRequest.user_msisdn
        ).where(
            ServedRequest.processed_by == 'SYSTEM_WHITELIST_IMPORT'
        ).group_by(
            ServedRequest.user_msisdn
        ).having(
            func.count(ServedRequest.id) > 1
        )
        
        duplicates_result = await db.execute(duplicates_query)
        duplicate_msisdns = [row[0] for row in duplicates_result.all()]
        
        if not duplicate_msisdns:
            print("✅ No duplicates to remove!")
            return
        
        print(f"Found {len(duplicate_msisdns)} users with duplicates")
        print("Processing...\n")
        
        removed_count = 0
        
        # For each duplicate user, keep the oldest entry and remove the rest
        for msisdn in duplicate_msisdns:
            # Get all entries for this user, ordered by id (oldest first)
            entries_result = await db.execute(
                select(ServedRequest)
                .where(ServedRequest.user_msisdn == msisdn)
                .where(ServedRequest.processed_by == 'SYSTEM_WHITELIST_IMPORT')
                .order_by(ServedRequest.id.asc())
            )
            entries = entries_result.scalars().all()
            
            # Keep the first (oldest) entry, delete the rest
            if len(entries) > 1:
                for entry in entries[1:]:  # Skip first, delete rest
                    await db.delete(entry)
                    removed_count += 1
        
        # Commit all deletions
        await db.commit()
        
        print(f"✅ Removed {removed_count} duplicate entries")
        
        # Verify final count
        final_result = await db.execute(
            select(func.count(ServedRequest.id))
            .where(ServedRequest.processed_by == 'SYSTEM_WHITELIST_IMPORT')
        )
        final_count = final_result.scalar()
        
        print(f"📊 Final whitelist entries: {final_count}")


async def main():
    """Main entry point"""
    try:
        # Step 1: Analyze
        await analyze_duplicates()
        
        # Step 2: Ask for confirmation
        print("\n" + "="*70)
        response = input("\n🤔 Do you want to remove duplicate entries? (yes/no): ").strip().lower()
        
        if response in ['yes', 'y']:
            await remove_duplicates()
            print("\n✅ Cleanup completed successfully!")
        else:
            print("\n❌ Cleanup cancelled by user.")
        
        print("\n💡 To verify the count, run:")
        print("   SELECT COUNT(*) FROM served_requests WHERE processed_by = 'SYSTEM_WHITELIST_IMPORT';")
        print("\n💡 To see unique users:")
        print("   SELECT COUNT(DISTINCT user_msisdn) FROM served_requests WHERE processed_by = 'SYSTEM_WHITELIST_IMPORT';")
        
    except KeyboardInterrupt:
        print("\n\n❌ Operation cancelled by user (Ctrl+C)")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
