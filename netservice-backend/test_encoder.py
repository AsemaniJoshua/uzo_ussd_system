import enum
from fastapi.encoders import jsonable_encoder
from datetime import datetime

class AdminRole(str, enum.Enum):
    superadmin = "superadmin"
    staff = "staff"

data = {
    "role": AdminRole.superadmin,
    "created_at": datetime.now()
}

try:
    res = jsonable_encoder(data)
    print("Success:", res)
except Exception as e:
    print("Error:", e)
