import uuid
from sqlalchemy import Column, String, Date, Numeric, ForeignKey, TIMESTAMP, UniqueConstraint, Integer
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
    source_ref = Column(String, nullable=False, default="", server_default="")
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("date", "party_id", "weight", "rate", "type", "category", "item_type", "source_ref", name="unique_txn"),
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


class RetailBill(Base):
    __tablename__ = "retail_bills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bill_number = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    party_id = Column(UUID(as_uuid=True), ForeignKey("parties.id"))
    customer_name = Column(String)
    customer_phone = Column(String)
    customer_address = Column(String)
    cashier_name = Column(String)
    payment_mode = Column(String)
    total_quantity = Column(Numeric)
    total_weight = Column(Numeric)
    total_amount = Column(Numeric)
    paid_amount = Column(Numeric)
    outstanding_amount = Column(Numeric)
    notes = Column(String)
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("date", "bill_number", name="unique_retail_bill_number_per_day"),
    )


class RetailBillItem(Base):
    __tablename__ = "retail_bill_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bill_id = Column(UUID(as_uuid=True), ForeignKey("retail_bills.id"), nullable=False)
    line_order = Column(Integer, nullable=False, default=1)
    item_name = Column(String, nullable=False)
    line_type = Column(String, nullable=False, default="STANDARD")
    quantity = Column(Numeric)
    unit = Column(String)
    weight = Column(Numeric)
    rate = Column(Numeric)
    amount = Column(Numeric)
    created_at = Column(TIMESTAMP, server_default=func.now())
