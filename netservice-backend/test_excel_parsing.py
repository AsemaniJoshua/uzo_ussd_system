"""
Test script to verify Excel parsing fix for phone numbers
"""
import sys
from pathlib import Path
import pandas as pd
from io import BytesIO

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.whitelist_service import WhitelistService


def create_test_excel():
    """Create a test Excel file with phone numbers"""
    # Test data with various formats
    test_numbers = [
        233244123456,  # Numeric (will be stored as 2.33244e+11 in Excel)
        233501234567,  # Numeric
        '0244987654',  # String with leading zero
        233551112222,  # Numeric
        '233261234567',  # String
        12345,  # Too short - invalid
        '   233244555666   ',  # With whitespace
        '',  # Empty
        'not-a-number',  # Invalid
        2339999999999999999,  # Too long - invalid
    ]
    
    df = pd.DataFrame({'Phone': test_numbers})
    
    # Save to bytes
    buffer = BytesIO()
    df.to_excel(buffer, index=False)
    buffer.seek(0)
    
    return buffer.getvalue()


def test_excel_parsing():
    """Test the Excel parsing functionality"""
    print("=" * 70)
    print("Testing Excel Parsing Fix")
    print("=" * 70)
    
    # Create test Excel file
    print("\n1. Creating test Excel file...")
    excel_bytes = create_test_excel()
    print(f"   ✓ Created test Excel file ({len(excel_bytes)} bytes)")
    
    # Initialize service
    print("\n2. Initializing WhitelistService...")
    service = WhitelistService(batch_size=500)
    print("   ✓ Service initialized")
    
    # Test reading Excel
    print("\n3. Reading Excel file...")
    try:
        numbers = service.read_excel(excel_bytes)
        print(f"   ✓ Successfully read {len(numbers)} numbers from Excel")
        print(f"\n   Raw numbers:")
        for i, num in enumerate(numbers, 1):
            print(f"     {i}. '{num}' (type: {type(num).__name__})")
    except Exception as e:
        print(f"   ✗ Error reading Excel: {e}")
        return False
    
    # Test categorization
    print("\n4. Categorizing numbers...")
    try:
        categorized = service.categorize_numbers(numbers)
        print(f"   ✓ Categorization complete")
        print(f"\n   Statistics:")
        print(f"     - Total: {service.stats['total']}")
        print(f"     - Valid: {service.stats['valid']}")
        print(f"     - Invalid: {service.stats['invalid']}")
        
        if categorized['valid']:
            print(f"\n   Valid numbers:")
            for num in categorized['valid']:
                print(f"     - {num['msisdn']} ({num['country']})")
        
        if categorized['invalid']:
            print(f"\n   Invalid numbers:")
            for num in categorized['invalid']:
                print(f"     - Original: '{num['original']}', Cleaned: '{num['cleaned']}', Reason: {num['reason']}")
                
    except Exception as e:
        print(f"   ✗ Error categorizing: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 70)
    print("✅ Test completed successfully!")
    print("=" * 70)
    return True


if __name__ == "__main__":
    success = test_excel_parsing()
    sys.exit(0 if success else 1)
