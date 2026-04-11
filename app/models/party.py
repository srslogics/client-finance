# models/party.py
from sqlalchemy import Column, Integer, String, Float
from app.db import Base

class Party(Base):
    __tablename__ = "parties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String)
    type = Column(String)  # dealer / vendor
    balance = Column(Float, default=0)
