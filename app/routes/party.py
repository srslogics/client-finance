# routes/party.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models.party import Party

router = APIRouter(prefix="/party")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/")
def create_party(name: str, phone: str, type: str, db: Session = Depends(get_db)):
    party = Party(name=name, phone=phone, type=type)
    db.add(party)
    db.commit()
    db.refresh(party)
    return party

@router.get("/")
def get_all_parties(db: Session = Depends(get_db)):
    return db.query(Party).all()
