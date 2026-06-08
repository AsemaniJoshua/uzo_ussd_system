import enum
class AdminRole(str, enum.Enum):
    superadmin = 'superadmin'

print(AdminRole.superadmin == 'superadmin')
print(type(AdminRole.superadmin))
print(AdminRole.superadmin.value)
