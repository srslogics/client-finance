# models/expense.py
from sqlalchemy import Column, Integer, Float, String, Date
from app.db import Base

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True)
    amount = Column(Float)
    reason = Column(String)
    date = Column(Date)
