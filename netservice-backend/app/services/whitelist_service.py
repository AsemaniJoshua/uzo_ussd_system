"""
Whitelist Service - NetService USSD
====================================
Service for processing Excel file uploads containing phone numbers
for whitelist import with batch processing and statistics.
"""

from datetime import datetime
from decimal import Decimal
from io import BytesIO
from typing import Dict, List, Tuple
import openpyxl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm_models import ServedRequest, Transaction


class WhitelistService:
    """Handles whitelist import from Excel files"""
    
    def __init__(self, batch_size: int = 500):
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
    
    def clean_phone_number(self, number: str) -> str:
        """Clean and validate phone number"""
        # Remove whitespace and special characters
        cleaned = ''.join(filter(str.isdigit, str(number)))
        return cleaned
    
    def validate_number(self, number: str) -> Tuple[bool, str]:
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
    
    def read_excel(self, file_bytes: bytes, filename: str = "") -> List[str]:
        """Read and extract phone numbers from Excel (.xlsx) or CSV file without NumPy/pandas dependencies"""
        try:
            filename_lower = filename.lower()
            numbers = []

            # 1. CSV format (zero dependencies)
            if filename_lower.endswith('.csv'):
                import csv
                import io
                text_content = file_bytes.decode('utf-8-sig', errors='ignore')
                reader = csv.reader(io.StringIO(text_content))
                for row in reader:
                    if row and str(row[0]).strip():
                        numbers.append(str(row[0]).strip())

            # 2. Excel format via openpyxl (pure Python, zero NumPy/CPU optimization dependencies)
            else:
                wb = openpyxl.load_workbook(BytesIO(file_bytes), read_only=True, data_only=True)
                sheet = wb.active
                if sheet:
                    for row in sheet.iter_rows(values_only=True):
                        if row and row[0] is not None:
                            val = row[0]
                            if isinstance(val, float):
                                val_str = str(int(val))
                            else:
                                val_str = str(val).strip()
                            if val_str:
                                numbers.append(val_str)
                wb.close()
            
            self.stats['total'] = len(numbers)
            return numbers
        except Exception as e:
            raise ValueError(f"Error reading file: {str(e)}")
    
    def categorize_numbers(self, numbers: List[str]) -> Dict:
        """Validate and categorize phone numbers by country"""
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
                
                self.stats['valid'] += 1
                self.stats['by_country'][country_code] = \
                    self.stats['by_country'].get(country_code, 0) + 1
            else:
                reason = 'Invalid format or length'
                if not cleaned:
                    reason = 'Empty or blank value'
                elif not cleaned.isdigit():
                    reason = 'Contains non-numeric characters'
                elif len(cleaned) < 10:
                    reason = f'Too short ({len(cleaned)} digits, need 10-15)'
                elif len(cleaned) > 15:
                    reason = f'Too long ({len(cleaned)} digits, max 15)'
                
                categorized['invalid'].append({
                    'original': raw_number,
                    'cleaned': cleaned,
                    'reason': reason
                })
                self.stats['invalid'] += 1
                self.invalid_numbers.append(f"{raw_number} ({reason})")
        
        return categorized
    
    async def check_duplicates(self, db: AsyncSession, valid_numbers: List[dict]) -> Tuple[List[dict], List[dict]]:
        """Check which numbers already exist in database using chunks to avoid query limits"""
        msisdns = [n['msisdn'] for n in valid_numbers]
        served_existing = set()
        tx_existing = set()
        
        chunk_size = 500
        for i in range(0, len(msisdns), chunk_size):
            chunk = msisdns[i:i + chunk_size]
            
            try:
                # Check in served_requests table
                served_result = await db.execute(
                    select(ServedRequest.user_msisdn)
                    .where(ServedRequest.user_msisdn.in_(chunk))
                    .where(ServedRequest.status == "PAID")
                )
                served_existing.update(row[0] for row in served_result.all() if row[0])
            except Exception as e:
                print(f"Warning: could not query served_requests duplicates for chunk: {e}")
            
            try:
                # Check in transactions table
                tx_result = await db.execute(
                    select(Transaction.user_msisdn)
                    .where(Transaction.user_msisdn.in_(chunk))
                    .where(Transaction.status == "PAID")
                )
                tx_existing.update(row[0] for row in tx_result.all() if row[0])
            except Exception as e:
                print(f"Warning: could not query transactions duplicates for chunk: {e}")
        
        all_existing = served_existing | tx_existing
        new_numbers = [n for n in valid_numbers if n['msisdn'] not in all_existing]
        duplicate_numbers = [n for n in valid_numbers if n['msisdn'] in all_existing]
        
        self.stats['duplicates'] = len(duplicate_numbers)
        return new_numbers, duplicate_numbers
    
    async def insert_batch(self, db: AsyncSession, batch: List[dict], batch_num: int) -> int:
        """Insert a batch of numbers into served_requests table
        
        Returns:
            Number of successfully inserted records
        """
        timestamp = datetime.now()
        inserted = 0
        
        try:
            for idx, number_data in enumerate(batch):
                msisdn = number_data['msisdn']
                served_request = ServedRequest(
                    transaction_id=0,
                    network="MTN",
                    package_name=f"Whitelisted User - Import {timestamp.strftime('%Y-%m-%d')}",
                    amount=Decimal("0.00"),
                    recipient=msisdn,
                    processed_by="SYSTEM_WHITELIST_IMPORT",
                    payment_reference=f"WHITELIST_{timestamp.strftime('%Y%m%d%H%M%S')}_{batch_num}_{idx}",
                    status="PAID",
                    session_id=f"whitelist_session_{batch_num}_{idx}",
                    user_msisdn=msisdn,
                    served_at=timestamp
                )
                db.add(served_request)
                inserted += 1
            
            await db.commit()
            return inserted
            
        except Exception as e:
            await db.rollback()
            self.stats['failed'] += len(batch)
            print(f"Error in batch {batch_num}: {e}")
            raise Exception(f"Database insert error in batch {batch_num}: {str(e)}")
    
    async def process_excel_upload(self, file_bytes: bytes, db: AsyncSession, filename: str = "") -> Dict:
        """Main processing function for file upload
        
        Returns:
            Statistics dictionary
        """
        # Step 1: Read file
        raw_numbers = self.read_excel(file_bytes, filename=filename)
        
        # Step 2: Validate and categorize
        categorized = self.categorize_numbers(raw_numbers)
        
        if self.stats['valid'] == 0:
            return {
                **self.stats,
                'error': 'No valid numbers found in the uploaded file'
            }
        
        # Step 3: Check duplicates
        new_numbers, duplicates = await self.check_duplicates(db, categorized['valid'])
        
        # Step 4: Import in batches
        last_error = None
        if new_numbers:
            for i in range(0, len(new_numbers), self.batch_size):
                batch = new_numbers[i:i + self.batch_size]
                batch_num = (i // self.batch_size) + 1
                
                try:
                    inserted = await self.insert_batch(db, batch, batch_num)
                    self.stats['inserted'] += inserted
                except Exception as e:
                    last_error = str(e)
                    print(f"Batch {batch_num} failed: {e}")
        
        if new_numbers and self.stats['inserted'] == 0 and last_error:
            return {
                **self.stats,
                'error': f"Failed to insert numbers: {last_error}"
            }
        
        # Return statistics
        return {
            **self.stats,
            'invalid_sample': self.invalid_numbers[:10]
        }
