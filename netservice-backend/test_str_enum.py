import enum
class TransactionStatus(str, enum.Enum):
    PAID = "PAID"
print(str(TransactionStatus.PAID))
