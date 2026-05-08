"""
Whitelist Import Script - NetService USSD
==========================================
Safely imports phone numbers from Excel file into served_requests table
to bypass USSD restriction for trusted users.

Author: System
Date: 2025-12-27
"""

import asyncio
import sys
import os
from datetime import datetime
from decimal import Decimal
from pathlib import Path
import pandas as pd
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

# Fix Windows console encoding for emojis
if sys.platform == 'win32':
    os.system('chcp 65001 >nul 2>&1')  # Set console to UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app.db.session import AsyncSessionLocal
from app.models.orm_models import ServedRequest, Transaction

# Configuration
EXCEL_FILE = "contacts-2025.xlsx"
BATCH_SIZE = 500
DRY_RUN = False  # Set to True to preview without inserting
AUTO_CONFIRM = True  # Set to True to skip manual confirmation


class WhitelistImporter:
    """Handles the import of whitelisted phone numbers"""
    
    def __init__(self, excel_file: str, batch_size: int = 500):
        self.excel_file = excel_file
        self.batch_size = batch_size
        self.stats = {
            'total': 0,
            'valid': 0,
            'invalid': 0,
            'duplicates': 0,
            'inserted': 0,
            'failed': 0,
            'by_country': {}
        }
        self.invalid_numbers = []
        
    def print_header(self):
        """Print script header"""
        print("\n" + "="*70)
        print("🔐 WHITELIST IMPORT SCRIPT - NetService USSD")
        print("="*70)
        print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📁 Excel File: {self.excel_file}")
        print(f"📊 Batch Size: {self.batch_size}")
        print("="*70 + "\n")
    
    def read_excel(self) -> list:
        """Read and extract phone numbers from Excel file"""
        print("📖 Reading Excel file...")
        try:
            df = pd.read_excel(self.excel_file)
            # Get first column (phone numbers)
            numbers = df.iloc[:, 0].astype(str).tolist()
            self.stats['total'] = len(numbers)
            print(f"✅ Found {len(numbers)} phone numbers in Excel\n")
            return numbers
        except Exception as e:
            print(f"❌ Error reading Excel file: {e}")
            sys.exit(1)
    
    def clean_phone_number(self, number: str) -> str:
        """Clean and validate phone number"""
        # Remove whitespace and special characters
        cleaned = ''.join(filter(str.isdigit, str(number)))
        return cleaned
    
    def validate_number(self, number: str) -> tuple[bool, str]:
        """Validate phone number format
        
        Returns:
            (is_valid, country_code)
        """
        if not number:
            return False, None
            
        # Must be numeric and between 10-15 digits (international standard)
        if not number.isdigit():
            return False, None
            
        if len(number) < 10 or len(number) > 15:
            return False, None
        
        # Determine country code (first 3 digits)
        country_code = number[:3]
        
        return True, country_code
    
    def categorize_numbers(self, numbers: list) -> dict:
        """Validate and categorize phone numbers by country"""
        print("🔍 Validating and categorizing phone numbers...")
        
        categorized = {
            'valid': [],
            'invalid': []
        }
        
        country_names = {
            '233': '🇬🇭 Ghana',
            '234': '🇳🇬 Nigeria',
            '225': '🇨🇮 Ivory Coast',
            '254': '🇰🇪 Kenya',
            '256': '🇺🇬 Uganda',
        }
        
        for raw_number in numbers:
            cleaned = self.clean_phone_number(raw_number)
            is_valid, country_code = self.validate_number(cleaned)
            
            if is_valid:
                categorized['valid'].append({
                    'msisdn': cleaned,
                    'country_code': country_code,
                    'country': country_names.get(country_code, f'Other ({country_code})')
                })
                
                # Update stats
                self.stats['valid'] += 1
                self.stats['by_country'][country_code] = \
                    self.stats['by_country'].get(country_code, 0) + 1
            else:
                categorized['invalid'].append({
                    'original': raw_number,
                    'cleaned': cleaned,
                    'reason': 'Invalid format or length'
                })
                self.stats['invalid'] += 1
                self.invalid_numbers.append(raw_number)
        
        print(f"✅ Valid numbers: {self.stats['valid']}")
        print(f"❌ Invalid numbers: {self.stats['invalid']}\n")
        
        return categorized
    
    def print_summary(self, categorized: dict):
        """Print summary of numbers to be imported"""
        print("\n" + "="*70)
        print("📊 IMPORT SUMMARY")
        print("="*70)
        print(f"Total numbers in Excel: {self.stats['total']}")
        print(f"Valid numbers: {self.stats['valid']}")
        print(f"Invalid numbers: {self.stats['invalid']}")
        
        if self.stats['by_country']:
            print("\n📍 Country Distribution:")
            country_names = {
                '233': '🇬🇭 Ghana',
                '234': '🇳🇬 Nigeria',
                '225': '🇨🇮 Ivory Coast',
                '254': '🇰🇪 Kenya',
                '256': '🇺🇬 Uganda',
            }
            for code, count in sorted(self.stats['by_country'].items(), key=lambda x: x[1], reverse=True):
                country = country_names.get(code, f'Other ({code})')
                print(f"  {country}: {count}")
        
        if self.invalid_numbers:
            print(f"\n⚠️  Invalid numbers (first 10):")
            for num in self.invalid_numbers[:10]:
                print(f"  - {num}")
            if len(self.invalid_numbers) > 10:
                print(f"  ... and {len(self.invalid_numbers) - 10} more")
        
        print("="*70 + "\n")
    
    async def check_duplicates(self, db: AsyncSession, valid_numbers: list) -> tuple[list, list]:
        """Check which numbers already exist in database
        
        Returns:
            (new_numbers, duplicate_numbers)
        """
        print("🔄 Checking for existing entries in database...")
        
        msisdns = [n['msisdn'] for n in valid_numbers]
        
        # Check in served_requests table
        served_result = await db.execute(
            select(ServedRequest.user_msisdn)
            .where(ServedRequest.user_msisdn.in_(msisdns))
            .where(ServedRequest.status == "PAID")
        )
        served_existing = {row[0] for row in served_result.all()}
        
        # Check in transactions table
        tx_result = await db.execute(
            select(Transaction.user_msisdn)
            .where(Transaction.user_msisdn.in_(msisdns))
            .where(Transaction.status == "PAID")
        )
        tx_existing = {row[0] for row in tx_result.all()}
        
        # Combine both
        all_existing = served_existing | tx_existing
        
        new_numbers = [n for n in valid_numbers if n['msisdn'] not in all_existing]
        duplicate_numbers = [n for n in valid_numbers if n['msisdn'] in all_existing]
        
        self.stats['duplicates'] = len(duplicate_numbers)
        
        print(f"📝 Found {len(duplicate_numbers)} duplicates (already have PAID status)")
        print(f"➕ New numbers to add: {len(new_numbers)}\n")
        
        return new_numbers, duplicate_numbers
    
    async def insert_batch(self, db: AsyncSession, batch: list, batch_num: int) -> int:
        """Insert a batch of numbers into served_requests table
        
        Returns:
            Number of successfully inserted records
        """
        timestamp = datetime.now()
        inserted = 0
        
        try:
            for idx, number_data in enumerate(batch):
                # Create served request entry
                served_request = ServedRequest(
                    transaction_id=0,  # Special marker for whitelist
                    network="MTN",  # Default network (doesn't affect restriction bypass)
                    package_name=f"Whitelisted User - Import {timestamp.strftime('%Y-%m-%d')}",
                    amount=Decimal("0.00"),
                    recipient=number_data['msisdn'],
                    processed_by="SYSTEM_WHITELIST_IMPORT",
                    payment_reference=f"WHITELIST_{timestamp.strftime('%Y%m%d%H%M%S')}_{batch_num}_{idx}",
                    status="PAID",  # KEY: This enables restriction bypass
                    session_id=f"whitelist_session_{batch_num}_{idx}",
                    user_msisdn=number_data['msisdn'],
                    served_at=timestamp
                )
                
                db.add(served_request)
                inserted += 1
            
            # Commit the batch
            await db.commit()
            return inserted
            
        except Exception as e:
            print(f"❌ Error in batch {batch_num}: {e}")
            await db.rollback()
            self.stats['failed'] += len(batch)
            return 0
    
    async def import_numbers(self, numbers_to_import: list):
        """Import numbers in batches"""
        if not numbers_to_import:
            print("ℹ️  No new numbers to import.")
            return
        
        print(f"\n🚀 Starting import of {len(numbers_to_import)} numbers...")
        print(f"📦 Processing in batches of {self.batch_size}\n")
        
        async with AsyncSessionLocal() as db:
            # Process in batches
            total_batches = (len(numbers_to_import) + self.batch_size - 1) // self.batch_size
            
            for i in range(0, len(numbers_to_import), self.batch_size):
                batch = numbers_to_import[i:i + self.batch_size]
                batch_num = (i // self.batch_size) + 1
                
                print(f"⏳ Processing batch {batch_num}/{total_batches} ({len(batch)} numbers)...", end=" ")
                
                inserted = await self.insert_batch(db, batch, batch_num)
                self.stats['inserted'] += inserted
                
                print(f"✅ {inserted} inserted")
        
        print(f"\n✨ Import completed!")
    
    def print_final_report(self):
        """Print final import report"""
        print("\n" + "="*70)
        print("📈 FINAL REPORT")
        print("="*70)
        print(f"Total numbers processed: {self.stats['total']}")
        print(f"Valid numbers: {self.stats['valid']}")
        print(f"Invalid numbers: {self.stats['invalid']}")
        print(f"Duplicates (skipped): {self.stats['duplicates']}")
        print(f"Successfully inserted: {self.stats['inserted']}")
        print(f"Failed: {self.stats['failed']}")
        print("="*70)
        
        if self.stats['inserted'] > 0:
            print("\n✅ Whitelist import completed successfully!")
            print(f"📝 {self.stats['inserted']} users can now bypass USSD restriction")
        
        print("\n💡 To verify, run:")
        print("   SELECT COUNT(*) FROM served_requests WHERE processed_by = 'SYSTEM_WHITELIST_IMPORT';")
        
        print("\n🔄 To rollback (if needed), run:")
        print("   DELETE FROM served_requests WHERE processed_by = 'SYSTEM_WHITELIST_IMPORT';")
        print()
    
    async def run(self):
        """Main execution flow"""
        self.print_header()
        
        # Step 1: Read Excel
        raw_numbers = self.read_excel()
        
        # Step 2: Validate and categorize
        categorized = self.categorize_numbers(raw_numbers)
        
        # Step 3: Print summary
        self.print_summary(categorized)
        
        if self.stats['valid'] == 0:
            print("❌ No valid numbers to import. Exiting.")
            return
        
        # Step 4: Check duplicates
        async with AsyncSessionLocal() as db:
            new_numbers, duplicates = await self.check_duplicates(db, categorized['valid'])
        
        # Step 5: Confirmation
        if new_numbers:
            print(f"\n⚠️  You are about to insert {len(new_numbers)} new whitelisted numbers.")
            print("   These users will be able to bypass USSD restriction.\n")
            
            if DRY_RUN:
                print("🔍 DRY RUN MODE - No actual changes will be made")
                response = 'y'
            elif AUTO_CONFIRM:
                print("✅ AUTO-CONFIRM MODE - Proceeding with import...")
                response = 'y'
            else:
                response = input("   Proceed with insertion? (yes/no): ").strip().lower()
            
            if response in ['yes', 'y']:
                if not DRY_RUN:
                    # Step 6: Import
                    await self.import_numbers(new_numbers)
                else:
                    print("\n✅ Dry run completed. No changes made to database.")
                    self.stats['inserted'] = len(new_numbers)  # For preview
            else:
                print("\n❌ Import cancelled by user.")
                return
        
        # Step 7: Final report
        self.print_final_report()


async def main():
    """Main entry point"""
    try:
        importer = WhitelistImporter(EXCEL_FILE, BATCH_SIZE)
        await importer.run()
    except KeyboardInterrupt:
        print("\n\n❌ Import cancelled by user (Ctrl+C)")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())
