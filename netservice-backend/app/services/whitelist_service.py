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
import pandas as pd
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
    
    def read_excel(self, file_bytes: bytes) -> List[str]:
        """Read and extract phone numbers from Excel file"""
        try:
            df = pd.read_excel(BytesIO(file_bytes))
            # Get first column (phone numbers)
            first_column = df.iloc[:, 0]
            
            # Convert to string, handling numeric values properly
            numbers = []
            for value in first_column:
                # Skip NaN/None values
                if pd.isna(value):
                    numbers.append('')
                    continue
                
                # If it's a number, convert to int first to avoid scientific notation
                if isinstance(value, (int, float)):
                    # Remove decimal part if it's a float
                    numbers.append(str(int(value)))
                else:
                    # It's already a string
                    numbers.append(str(value))
            
            self.stats['total'] = len(numbers)
            return numbers
        except Exception as e:
            raise ValueError(f"Error reading Excel file: {str(e)}")
    
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
                
                # Update stats
                self.stats['valid'] += 1
                self.stats['by_country'][country_code] = \
                    self.stats['by_country'].get(country_code, 0) + 1
            else:
                # Determine specific reason for invalidity
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
        """Check which numbers already exist in database
        
        Returns:
            (new_numbers, duplicate_numbers)
        """
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
            await db.rollback()
            self.stats['failed'] += len(batch)
            raise Exception(f"Error in batch {batch_num}: {str(e)}")
    
    async def process_excel_upload(self, file_bytes: bytes, db: AsyncSession) -> Dict:
        """Main processing function for Excel upload
        
        Returns:
            Statistics dictionary
        """
        # Step 1: Read Excel
        raw_numbers = self.read_excel(file_bytes)
        
        # Step 2: Validate and categorize
        categorized = self.categorize_numbers(raw_numbers)
        
        if self.stats['valid'] == 0:
            return {
                **self.stats,
                'error': 'No valid numbers found in Excel file'
            }
        
        # Step 3: Check duplicates
        new_numbers, duplicates = await self.check_duplicates(db, categorized['valid'])
        
        # Step 4: Import in batches
        if new_numbers:
            total_batches = (len(new_numbers) + self.batch_size - 1) // self.batch_size
            
            for i in range(0, len(new_numbers), self.batch_size):
                batch = new_numbers[i:i + self.batch_size]
                batch_num = (i // self.batch_size) + 1
                
                try:
                    inserted = await self.insert_batch(db, batch, batch_num)
                    self.stats['inserted'] += inserted
                except Exception as e:
                    # Log error but continue with next batch
                    print(f"Batch {batch_num} failed: {e}")
        
        # Return statistics
        return {
            **self.stats,
            'invalid_sample': self.invalid_numbers[:10]  # First 10 invalid numbers
        }
