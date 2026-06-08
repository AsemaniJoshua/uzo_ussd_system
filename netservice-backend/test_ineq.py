import enum
class AdminRole(str, enum.Enum):
    superadmin = 'superadmin'

role_from_db = "superadmin"
print(role_from_db != AdminRole.superadmin)
