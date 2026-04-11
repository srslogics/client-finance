# models/transaction.py
from sqlalchemy import Column, Integer, Float, String, Date, ForeignKey
from app.db import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)

    type = Column(String)  # sale / purchase / payment

    party_id = Column(Integer, ForeignKey("parties.id"), nullable=True)

    quantity = Column(Integer, nullable=True)
    weight = Column(Float, nullable=True)
    rate = Column(Float)
    total = Column(Float)

    date = Column(Date)
