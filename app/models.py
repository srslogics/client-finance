import uuid
from sqlalchemy import Column, String, Date, Numeric, ForeignKey, TIMESTAMP, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db import Base


class Party(Base):
    __tablename__ = "parties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    normalized_name = Column(String)
    type = Column(String)  # VENDOR / DEALER / BOTH
    phone = Column(String)
    created_at = Column(TIMESTAMP, server_default=func.now())


class PartyAlias(Base):
    __tablename__ = "party_aliases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alias = Column(String)
    normalized_alias = Column(String)
    party_id = Column(UUID(as_uuid=True), ForeignKey("parties.id"))


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False)
    party_id = Column(UUID(as_uuid=True), ForeignKey("parties.id"))
    type = Column(String)
    category = Column(String)
    item_type = Column(String)
    weight = Column(Numeric)
    rate = Column(Numeric)
    amount = Column(Numeric)
    payment_mode = Column(String)
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("date", "party_id", "weight", "rate", "type", "category", "item_type", name="unique_txn"),
    )


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_hash = Column(String, unique=True)
    file_type = Column(String)  # vendor / dealer / payment
    created_at = Column(TIMESTAMP, server_default=func.now())


class ItemOpeningStock(Base):
    __tablename__ = "item_opening_stock"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False)
    item_type = Column(String, nullable=False)
    opening_weight = Column(Numeric)
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("date", "item_type", name="unique_item_opening_stock"),
    )


class DailyStock(Base):
    __tablename__ = "daily_stock"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, unique=True)
    opening_weight = Column(Numeric)
    purchase_weight = Column(Numeric)
    sales_weight = Column(Numeric)
    expected_closing_weight = Column(Numeric)
    actual_closing_weight = Column(Numeric)
    leakage = Column(Numeric)


class DailyItemStock(Base):
    __tablename__ = "daily_item_stock"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False)
    item_type = Column(String, nullable=False)
    opening_weight = Column(Numeric)
    purchase_weight = Column(Numeric)
    sales_weight = Column(Numeric)
    expected_closing_weight = Column(Numeric)
    actual_closing_weight = Column(Numeric)
    leakage = Column(Numeric)
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("date", "item_type", name="unique_daily_item_stock"),
    )
