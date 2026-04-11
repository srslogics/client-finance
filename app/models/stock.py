# models/stock.py

from sqlalchemy import Column, Integer, Float, Date
from app.db import Base

class Stock(Base):
    __tablename__ = "stock"

    id = Column(Integer, primary_key=True)
    date = Column(Date, unique=True)  # ONE ENTRY PER DAY

    opening_qty = Column(Float, default=0)
    purchase_qty = Column(Float, default=0)
    sales_qty = Column(Float, default=0)

    closing_qty = Column(Float, default=0)
    actual_qty = Column(Float, default=0)

    difference = Column(Float, default=0)
