# app/models/orm_models.py
from sqlalchemy import Column, Integer, String, DateTime, Enum, Numeric, Text, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base
import enum

class NetworkEnum(str, enum.Enum):
    MTN = "MTN"
    AT = "AT"
    TELECEL = "TELECEL"

class TransactionStatus(str, enum.Enum):
    PENDING = "PENDING"
    UNPAID = "UNPAID"
    PAID = "PAID"
    FAILED = "FAILED"

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(128), nullable=False, index=True)
    user_msisdn = Column(String(64), nullable=False, index=True)   # the dialer (self)
    network = Column(Enum(NetworkEnum), nullable=False)
    package_id = Column(Integer, nullable=True)
    package_name = Column(String(64), nullable=False)
    amount = Column(Numeric(10,2), nullable=False)
    recipient = Column(String(64), nullable=False)   # stored as typed (starting with 0 if entered)
    payment_method = Column(String(64), nullable=True)
    payment_reference = Column(String(128), nullable=True, index=True)
    profit_amount = Column(Numeric(10,2), nullable=True)
    status = Column(Enum(TransactionStatus), default=TransactionStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ServedRequest(Base):
    __tablename__ = "served_requests"
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, nullable=False, index=True)
    network = Column(String(32))
    package_name = Column(String(64))
    amount = Column(Numeric(10,2))
    recipient = Column(String(64))
    processed_by = Column(String(128), nullable=True)
    payment_reference = Column(String(128), nullable=True)
    profit_amount = Column(Numeric(10,2), nullable=True)
    status = Column(String(32), nullable=True)  # Store original status (PAID, etc.)
    session_id = Column(String(128), nullable=True)  # Store original session_id
    user_msisdn = Column(String(64), nullable=True)  # Store original user_msisdn
    served_at = Column(DateTime(timezone=True), server_default=func.now())

class Package(Base):
    __tablename__ = "packages"
    id = Column(Integer, primary_key=True, index=True)
    network = Column(Enum(NetworkEnum), nullable=False)
    package_name = Column(String(64), nullable=False)
    amount = Column(Numeric(10,2), nullable=False)
    profit_amount = Column(Numeric(10,2), nullable=True)
    active = Column(Integer, default=1)


# AdminUser model for admin authentication
from sqlalchemy import Enum as SqlEnum
import enum

class AdminRole(str, enum.Enum):
    superadmin = "superadmin"
    staff = "staff"

class AdminUser(Base):
    __tablename__ = "admin_users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(128), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    role = Column(SqlEnum(AdminRole), default=AdminRole.staff, nullable=False)


class SystemSettings(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True, index=True)
    setting_key = Column(String(64), unique=True, nullable=False, index=True)
    setting_value = Column(String(255), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
