"""
Debug script to check if header row is the issue
"""
import pandas as pd
from io import BytesIO

# Test 1: Excel WITH header
print("Test 1: Excel WITH header row")
df_with_header = pd.DataFrame({'Phone Number': [233257581661]})
buffer1 = BytesIO()
df_with_header.to_excel(buffer1, index=False)
buffer1.seek(0)

df_read1 = pd.read_excel(buffer1)
print(f"  Columns: {df_read1.columns.tolist()}")
print(f"  First column data: {df_read1.iloc[:, 0].tolist()}")
print(f"  First value: {df_read1.iloc[0, 0]}")
print(f"  Type: {type(df_read1.iloc[0, 0])}")
print()

# Test 2: Excel WITHOUT header (just data)
print("Test 2: Excel WITHOUT header (if user has header in row 1)")
buffer1.seek(0)
df_read2 = pd.read_excel(buffer1, header=None)
print(f"  First column data: {df_read2.iloc[:, 0].tolist()}")
print(f"  First value (row 0): {df_read2.iloc[0, 0]}")
print(f"  Second value (row 1): {df_read2.iloc[1, 0]}")
print()

# Test 3: What if "Phone Number" text is in first cell?
print("Test 3: What if header text is being read as data?")
from app.services.whitelist_service import WhitelistService

service = WhitelistService()

# Simulate reading with header as first row
numbers = df_read2.iloc[:, 0].tolist()
print(f"  All values: {numbers}")

for val in numbers:
    if isinstance(val, (int, float)):
        string_val = str(int(val))
    else:
        string_val = str(val)
    
    cleaned = service.clean_phone_number(string_val)
    is_valid, country_code = service.validate_number(cleaned)
    print(f"  Value: '{val}' -> Cleaned: '{cleaned}' -> Valid: {is_valid}")
