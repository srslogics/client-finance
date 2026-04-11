from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
import csv
from fastapi.responses import StreamingResponse
from io import StringIO
from app.db import SessionLocal
from app.models.transaction import Transaction
from app.models.party import Party
from app.models.stock import Stock
from app.services.ledger_service import update_balance, generate_ledger

router = APIRouter(prefix="/txn")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------- SALE ---------------- #

@router.post("/sale")
def create_sale(party_id: int, quantity: int, weight: float, rate: float, db: Session = Depends(get_db)):

    if quantity <= 0 or weight <= 0 or rate <= 0:
        raise HTTPException(400, "Invalid input")

    party = db.get(Party, party_id)
    if not party or party.type != "dealer":
        raise HTTPException(400, "Invalid dealer")

    stock = db.query(Stock).filter(Stock.date == date.today()).first()
    if not stock:
        raise HTTPException(400, "Start the day first")

    if stock.closing_qty < weight:
        raise HTTPException(400, "Insufficient stock")

    total = weight * rate

    try:
        txn = Transaction(
            type="sale",
            party_id=party_id,
            quantity=quantity,
            weight=weight,
            rate=rate,
            total=total,
            date=date.today()
        )

        stock.sales_qty += weight
        stock.closing_qty -= weight

        update_balance(party, "sale", total)

        db.add(txn)
        db.flush()  # get txn.id

        log_action(db, "CREATE", "SALE", txn.id)

        db.commit()

    except:
        db.rollback()
        raise HTTPException(500, "Failed")

    return {"msg": "sale added"}

    

# ---------------- PURCHASE ---------------- #

@router.post("/purchase")
def create_purchase(party_id: int, weight: float, rate: float, db: Session = Depends(get_db)):

    if weight <= 0 or rate <= 0:
        raise HTTPException(status_code=400, detail="Invalid weight or rate")

    party = db.get(Party, party_id)
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")

    if party.type != "vendor":
        raise HTTPException(status_code=400, detail="Purchase only from vendors")

    stock = db.query(Stock).order_by(Stock.date.desc()).first()
    if not stock:
        raise HTTPException(status_code=400, detail="Stock not initialized")

    total = weight * rate

    try:
        txn = Transaction(
            type="purchase",
            party_id=party_id,
            weight=weight,
            rate=rate,
            total=total,
            date=date.today()
        )

        # update stock
        stock.purchase_qty += weight
        stock.closing_qty += weight

        # update balance
        update_balance(party, "purchase", total)

        db.add(txn)
        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Transaction failed")

    return {"msg": "purchase added"}


# ---------------- PAYMENT ---------------- #

@router.post("/payment")
def payment(party_id: int, amount: float, db: Session = Depends(get_db)):

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    party = db.get(Party, party_id)
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")

    try:
        txn = Transaction(
            type="payment",
            party_id=party_id,
            total=amount,
            date=date.today()
        )

        update_balance(party, "payment", amount)

        db.add(txn)
        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Payment failed")

    return {"msg": "payment recorded"}


# ---------------- LEDGER ---------------- #

@router.get("/ledger/{party_id}")
def get_ledger(party_id: int, db: Session = Depends(get_db)):

    party = db.get(Party, party_id)
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")

    txns = db.query(Transaction)\
        .filter(Transaction.party_id == party_id)\
        .order_by(Transaction.date)\
        .all()

    ledger = generate_ledger(txns)

    return {
        "party": party.name,
        "ledger": ledger
    }


# ---------------- STOCK INIT ---------------- #

@router.post("/stock/init")
def init_stock(opening_qty: float, db: Session = Depends(get_db)):

    if opening_qty < 0:
        raise HTTPException(status_code=400, detail="Invalid opening stock")

    stock = Stock(
        date=date.today(),
        opening_qty=opening_qty,
        purchase_qty=0,
        sales_qty=0,
        closing_qty=opening_qty
    )

    db.add(stock)
    db.commit()

    return {"msg": "stock initialized"}


# ---------------- STOCK VERIFY ---------------- #

@router.post("/stock/verify")
def verify_stock(actual_qty: float, db: Session = Depends(get_db)):

    stock = db.query(Stock).order_by(Stock.date.desc()).first()

    if not stock:
        raise HTTPException(status_code=400, detail="Stock not initialized")

    stock.actual_qty = actual_qty
    stock.difference = actual_qty - stock.closing_qty

    db.commit()

    return {
        "system_stock": stock.closing_qty,
        "actual_stock": actual_qty,
        "difference": stock.difference
    }

@router.post("/stock/start-day")
def start_day(db: Session = Depends(get_db)):

    today = date.today()

    existing = db.query(Stock).filter(Stock.date == today).first()
    if existing:
        raise HTTPException(400, "Day already started")

    yesterday = db.query(Stock)\
        .order_by(Stock.date.desc())\
        .first()

    opening = yesterday.closing_qty if yesterday else 0

    stock = Stock(
        date=today,
        opening_qty=opening,
        closing_qty=opening
    )

    db.add(stock)
    db.commit()

    return {"msg": "day started", "opening_stock": opening}

@router.get("/report/daily")
def daily_report(db: Session = Depends(get_db)):

    today = date.today()

    txns = db.query(Transaction).filter(Transaction.date == today).all()
    expenses = db.query(Expense).filter(Expense.date == today).all()
    stock = db.query(Stock).filter(Stock.date == today).first()

    sales = sum(t.total for t in txns if t.type == "sale")
    purchase = sum(t.total for t in txns if t.type == "purchase")
    expense_total = sum(e.amount for e in expenses)

    stock_loss = stock.difference if stock else 0

    profit = sales - purchase - expense_total - stock_loss

    return {
        "date": today,
        "sales": sales,
        "purchase": purchase,
        "expenses": expense_total,
        "stock_loss": stock_loss,
        "profit": profit
    }

@router.get("/report/outstanding")
def outstanding_report(db: Session = Depends(get_db)):

    dealers = db.query(Party).filter(Party.type == "dealer").all()

    data = []

    for d in dealers:
        data.append({
            "name": d.name,
            "phone": d.phone,
            "balance": d.balance
        })

    return data

@router.get("/report/outstanding/csv")
def export_outstanding(db: Session = Depends(get_db)):

    dealers = db.query(Party).filter(Party.type == "dealer").all()

    output = StringIO()
    writer = csv.writer(output)

    writer.writerow(["Name", "Phone", "Balance"])

    for d in dealers:
        writer.writerow([d.name, d.phone, d.balance])

    output.seek(0)

    return StreamingResponse(output, media_type="text/csv")
