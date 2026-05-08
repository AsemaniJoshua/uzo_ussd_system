"""
Quick debug script for the specific number
"""
import pandas as pd
from io import BytesIO

# Create Excel with the exact number
df = pd.DataFrame({'Phone': [233257581661]})
buffer = BytesIO()
df.to_excel(buffer, index=False)
buffer.seek(0)

# Test old way (broken)
print("Testing OLD method (broken):")
df_old = pd.read_excel(buffer)
buffer.seek(0)
old_result = df_old.iloc[:, 0].astype(str).tolist()
print(f"  Result: {old_result}")
print(f"  First value: '{old_result[0]}'")
print(f"  Type: {type(df_old.iloc[0, 0])}")
print()

# Test new way (fixed)
print("Testing NEW method (fixed):")
df_new = pd.read_excel(buffer)
first_column = df_new.iloc[:, 0]

numbers = []
for value in first_column:
    if pd.isna(value):
        numbers.append('')
        continue
    
    if isinstance(value, (int, float)):
        numbers.append(str(int(value)))
    else:
        numbers.append(str(value))

print(f"  Result: {numbers}")
print(f"  First value: '{numbers[0]}'")
print()

# Test validation
from app.services.whitelist_service import WhitelistService

service = WhitelistService()
cleaned = service.clean_phone_number(numbers[0])
is_valid, country_code = service.validate_number(cleaned)

print(f"Testing validation:")
print(f"  Cleaned: '{cleaned}'")
print(f"  Is valid: {is_valid}")
print(f"  Country code: {country_code}")
print(f"  Length: {len(cleaned)}")
