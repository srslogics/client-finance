from fastapi import FastAPI
from app.db import engine, Base
from fastapi import UploadFile, File, Depends
import pandas as pd
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app import models
from datetime import datetime
from sqlalchemy import func
from datetime import date
from decimal import Decimal
import uvicorn

app = FastAPI()

# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def root():
    return {"message": "Backend running"}

@app.post("/upload/vendor")
def upload_vendor(file: UploadFile = File(...), db: Session = Depends(get_db)):

    import io
    import hashlib

    filename = file.filename.lower()
    contents = file.file.read()

    # --- File hash (duplicate file protection) ---
    file_hash = hashlib.md5(contents).hexdigest()

    existing_file = db.query(models.UploadedFile).filter_by(file_hash=file_hash).first()
    if existing_file:
        return {"error": "File already uploaded"}

    # --- Read file ---
    try:
        if filename.endswith(".xlsx"):
            df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")

        elif filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(contents), engine="xlrd")

        elif filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents), encoding="utf-8")

        else:
            return {"error": "Unsupported file format"}

    except Exception as e:
        return {"error": f"File read failed: {str(e)}"}

    # --- Validation ---
    if df.empty:
        return {"error": "File is empty"}

    df.columns = df.columns.str.strip().str.upper()

    required_cols = ["DATE", "VENDOR", "WEIGHT", "RATE"]

    for col in required_cols:
        if col not in df.columns:
            return {"error": f"Missing column: {col}"}

    # --- Numeric validation ---
    try:
        df["WEIGHT"] = df["WEIGHT"].astype(float)
        df["RATE"] = df["RATE"].astype(float)
    except:
        return {"error": "Invalid numeric values"}

    inserted = 0
    errors = []

    # --- Process rows ---
    for _, row in df.iterrows():
        try:
            if pd.isna(row["VENDOR"]) or pd.isna(row["WEIGHT"]) or pd.isna(row["RATE"]):
                continue

            party_name = str(row["VENDOR"]).strip()
            weight = float(row["WEIGHT"])
            rate = float(row["RATE"])
            date = pd.to_datetime(row["DATE"], dayfirst=True).date()

            if weight <= 0 or rate <= 0:
                continue

            normalized = party_name.lower().replace(" ", "")

            # --- Party mapping ---
            alias = db.query(models.PartyAlias).filter_by(
                normalized_alias=normalized
            ).first()

            if alias:
                party_id = alias.party_id
            else:
                party = models.Party(
                    name=party_name,
                    normalized_name=normalized,
                    type="VENDOR"
                )
                db.add(party)
                db.flush()

                alias = models.PartyAlias(
                    alias=party_name,
                    normalized_alias=normalized,
                    party_id=party.id
                )
                db.add(alias)

                party_id = party.id

            # --- Duplicate check ---
            existing_txn = db.query(models.Transaction).filter_by(
                date=date,
                party_id=party_id,
                weight=weight,
                rate=rate,
                type="PURCHASE"
            ).first()

            if existing_txn:
                continue

            # --- Create transaction ---
            txn = models.Transaction(
                date=date,
                party_id=party_id,
                type="PURCHASE",
                weight=weight,
                rate=rate,
                amount=weight * rate,
                payment_mode="NA"
            )

            db.add(txn)
            inserted += 1

        except Exception as e:
            errors.append(str(e))
            continue

    # --- Final commit (ONLY ONCE) ---
    try:
        db.commit()

        file_record = models.UploadedFile(
            file_hash=file_hash,
            file_type="vendor"
        )
        db.add(file_record)
        db.commit()

    except Exception as e:
        db.rollback()
        return {"error": "Transaction failed", "details": str(e)}

    return {
        "status": "success",
        "rows_inserted": inserted,
        "errors": errors[:10]
    }

@app.post("/upload/dealer")
def upload_dealer(file: UploadFile = File(...), db: Session = Depends(get_db)):

    import io
    import hashlib

    filename = file.filename.lower()
    contents = file.file.read()

    # --- File hash protection ---
    file_hash = hashlib.md5(contents).hexdigest()

    existing_file = db.query(models.UploadedFile).filter_by(file_hash=file_hash).first()
    if existing_file:
        return {"error": "File already uploaded"}

    # --- Read file ---
    try:
        if filename.endswith(".xlsx"):
            df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")

        elif filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(contents), engine="xlrd")

        elif filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents), encoding="utf-8")

        else:
            return {"error": "Unsupported file format"}

    except Exception as e:
        return {"error": f"File read failed: {str(e)}"}

    # --- Validation ---
    if df.empty:
        return {"error": "File is empty"}

    df.columns = df.columns.str.strip().str.upper()

    required_cols = ["DATE", "DEALER", "WEIGHT", "RATE"]

    for col in required_cols:
        if col not in df.columns:
            return {"error": f"Missing column: {col}"}

    # --- Numeric validation ---
    try:
        df["WEIGHT"] = df["WEIGHT"].astype(float)
        df["RATE"] = df["RATE"].astype(float)
    except:
        return {"error": "Invalid numeric values"}

    inserted = 0
    errors = []

    # --- Process rows ---
    for _, row in df.iterrows():
        try:
            if pd.isna(row["DEALER"]) or pd.isna(row["WEIGHT"]) or pd.isna(row["RATE"]):
                continue

            party_name = str(row["DEALER"]).strip()
            weight = float(row["WEIGHT"])
            rate = float(row["RATE"])
            date = pd.to_datetime(row["DATE"], dayfirst=True).date()

            payment_mode = (
                str(row["PAYMENT_MODE"]).strip()
                if "PAYMENT_MODE" in df.columns and not pd.isna(row["PAYMENT_MODE"])
                else "NA"
            )

            if weight <= 0 or rate <= 0:
                continue

            normalized = party_name.lower().replace(" ", "")

            # --- Party mapping ---
            alias = db.query(models.PartyAlias).filter_by(
                normalized_alias=normalized
            ).first()

            if alias:
                party_id = alias.party_id
            else:
                party = models.Party(
                    name=party_name,
                    normalized_name=normalized,
                    type="DEALER"
                )
                db.add(party)
                db.flush()

                alias = models.PartyAlias(
                    alias=party_name,
                    normalized_alias=normalized,
                    party_id=party.id
                )
                db.add(alias)

                party_id = party.id

            # --- Duplicate check (CORRECT TYPE) ---
            existing_txn = db.query(models.Transaction).filter_by(
                date=date,
                party_id=party_id,
                weight=weight,
                rate=rate,
                type="SALE"
            ).first()

            if existing_txn:
                continue

            # --- Create SALE transaction ---
            txn = models.Transaction(
                date=date,
                party_id=party_id,
                type="SALE",
                weight=weight,
                rate=rate,
                amount=weight * rate,
                payment_mode=payment_mode
            )

            db.add(txn)
            inserted += 1

        except Exception as e:
            errors.append(str(e))
            continue

    # --- Final commit ---
    try:
        db.commit()

        file_record = models.UploadedFile(
            file_hash=file_hash,
            file_type="dealer"
        )
        db.add(file_record)
        db.commit()

    except Exception as e:
        db.rollback()
        return {"error": "Transaction failed", "details": str(e)}

    return {
        "status": "success",
        "rows_inserted": inserted,
        "errors": errors[:10]
    }


@app.post("/process-day")
def process_day(input_date: str, actual_stock: float, db: Session = Depends(get_db)):

    try:
        # --- Parse date ---
        target_date = pd.to_datetime(input_date).date()
    except:
        return {"error": "Invalid date format"}

    # --- Validate stock ---
    if actual_stock is None or actual_stock < 0:
        return {"error": "Invalid actual stock"}

    # --- Prevent duplicate processing ---
    existing = db.query(models.DailyStock).filter_by(date=target_date).first()
    if existing:
        return {"error": "Day already processed"}

    try:
        # --- Get previous day's closing ---
        prev_stock = db.query(models.DailyStock).filter(
            models.DailyStock.date < target_date
        ).order_by(models.DailyStock.date.desc()).first()

        opening_stock = Decimal(str(prev_stock.actual_closing_weight)) if prev_stock else Decimal("0")

        # --- Total purchases ---
        purchase_weight = db.query(func.sum(models.Transaction.weight)).filter(
            models.Transaction.date == target_date,
            models.Transaction.type == "PURCHASE"
        ).scalar() or 0

        # --- Total sales ---
        sales_weight = db.query(func.sum(models.Transaction.weight)).filter(
            models.Transaction.date == target_date,
            models.Transaction.type == "SALE"
        ).scalar() or 0

        purchase_weight = Decimal(str(purchase_weight))
        sales_weight = Decimal(str(sales_weight))

        # --- Expected stock ---
        expected_stock = opening_stock + purchase_weight - sales_weight

        # --- Leakage ---
        actual_stock_dec = Decimal(str(actual_stock))
        leakage = expected_stock - actual_stock_dec

        # --- Save ---
        daily = models.DailyStock(
            date=target_date,
            opening_weight=opening_stock,
            purchase_weight=purchase_weight,
            sales_weight=sales_weight,
            expected_closing_weight=expected_stock,
            actual_closing_weight=actual_stock_dec,
            leakage=leakage
        )

        db.add(daily)
        db.commit()

    except Exception as e:
        db.rollback()
        return {"error": "Processing failed", "details": str(e)}

    return {
        "date": str(target_date),
        "opening_stock": float(opening_stock),
        "purchase": float(purchase_weight),
        "sales": float(sales_weight),
        "expected_stock": float(expected_stock),
        "actual_stock": float(actual_stock_dec),
        "leakage": float(leakage)
    }


@app.get("/party/{party_id}/ledger")
def get_party_ledger(party_id: str, db: Session = Depends(get_db)):

    from decimal import Decimal

    # --- Validate party ---
    party = db.query(models.Party).filter_by(id=party_id).first()
    if not party:
        return {"error": "Party not found"}

    # --- Fetch transactions ---
    txns = db.query(models.Transaction).filter(
        models.Transaction.party_id == party_id
    ).order_by(models.Transaction.date.asc()).all()

    if not txns:
        return {
            "party_id": party_id,
            "party_name": party.name,
            "total_balance": 0,
            "ledger": []
        }

    balance = Decimal("0")
    ledger = []

    for txn in txns:
        amount = Decimal(txn.amount or 0)

        if txn.type in ["SALE", "PURCHASE"]:
            balance += amount
        elif txn.type == "PAYMENT":
            balance -= amount

        ledger.append({
            "date": str(txn.date),
            "type": txn.type,
            "amount": float(amount),
            "balance": float(balance)
        })

    return {
        "party_id": party_id,
        "party_name": party.name,
        "total_balance": float(balance),
        "ledger": ledger
    }

@app.get("/party/search")
def search_party(name: str, db: Session = Depends(get_db)):

    if not name or len(name.strip()) < 2:
        return {"results": []}

    normalized = name.lower().replace(" ", "").replace(".", "")

    # --- Search aliases (limited for performance) ---
    aliases = db.query(models.PartyAlias).filter(
        models.PartyAlias.normalized_alias.contains(normalized)
    ).limit(10).all()

    if not aliases:
        return {"results": []}

    party_ids = list(set([a.party_id for a in aliases]))

    parties = db.query(models.Party).filter(
        models.Party.id.in_(party_ids)
    ).all()

    # --- Sort by name (better UX) ---
    parties = sorted(parties, key=lambda x: x.name)

    return {
        "results": [
            {
                "id": str(p.id),
                "name": p.name,
                "type": p.type
            }
            for p in parties
        ]
    }


@app.get("/party/ledger")
def get_ledger_by_name(name: str, db: Session = Depends(get_db)):

    from decimal import Decimal

    if not name or len(name.strip()) < 2:
        return {"error": "Invalid party name"}

    normalized = name.lower().replace(" ", "").replace(".", "")

    # --- Step 1: Try EXACT match first (important) ---
    alias = db.query(models.PartyAlias).filter(
        models.PartyAlias.normalized_alias == normalized
    ).first()

    if alias:
        party_ids = [alias.party_id]
    else:
        # --- Step 2: Fuzzy match (limited results) ---
        aliases = db.query(models.PartyAlias).filter(
            models.PartyAlias.normalized_alias.contains(normalized)
        ).limit(10).all()

        if not aliases:
            return {"error": "Party not found"}

        party_ids = list(set([a.party_id for a in aliases]))

    # --- Step 3: Multiple matches ---
    if len(party_ids) > 1:
        parties = db.query(models.Party).filter(
            models.Party.id.in_(party_ids)
        ).all()

        return {
            "multiple_matches": True,
            "results": [
                {
                    "id": str(p.id),
                    "name": p.name,
                    "type": p.type
                }
                for p in parties
            ]
        }

    # --- Step 4: Single match → ledger ---
    party_id = party_ids[0]

    txns = db.query(models.Transaction).filter(
        models.Transaction.party_id == party_id
    ).order_by(models.Transaction.date.asc()).all()

    if not txns:
        return {
            "party_name": name,
            "total_balance": 0,
            "ledger": []
        }

    balance = Decimal("0")
    ledger = []

    for txn in txns:
        amount = Decimal(txn.amount or 0)

        if txn.type in ["SALE", "PURCHASE"]:
            balance += amount
        elif txn.type == "PAYMENT":
            balance -= amount

        ledger.append({
            "date": str(txn.date),
            "type": txn.type,
            "amount": float(amount),
            "balance": float(balance)
        })

    return {
        "party_name": name,
        "total_balance": float(balance),
        "ledger": ledger
    }


@app.get("/dashboard")
def get_dashboard(date: str, db: Session = Depends(get_db)):

    try:
        # --- Parse date ---
        target_date = pd.to_datetime(date).date()
    except:
        return {"error": "Invalid date format"}

    try:
        # --- Purchase ---
        purchase = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.date == target_date,
            models.Transaction.type == "PURCHASE"
        ).scalar() or 0

        # --- Sales ---
        sales = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.date == target_date,
            models.Transaction.type == "SALE"
        ).scalar() or 0

        # --- Stock ---
        stock = db.query(models.DailyStock).filter(
            models.DailyStock.date == target_date
        ).first()

        # --- Total outstanding ---
        from sqlalchemy import case

        total_outstanding = db.query(
            func.sum(
                case(
                    (models.Transaction.type.in_(["SALE", "PURCHASE"]), models.Transaction.amount),
                    (models.Transaction.type == "PAYMENT", -models.Transaction.amount),
                    else_=0
                )
            )
        ).scalar() or 0

        # --- Profit (simple approximation) ---
        profit = float(sales or 0) - float(purchase or 0)

    except Exception as e:
        return {"error": "Dashboard calculation failed", "details": str(e)}

    return {
        "date": str(target_date),

        "purchase": float(purchase or 0),
        "sales": float(sales or 0),
        "profit": profit,

        "expected_stock": float(stock.expected_closing_weight) if stock else 0,
        "actual_stock": float(stock.actual_closing_weight) if stock else 0,
        "leakage": float(stock.leakage) if stock else 0,

        "total_outstanding": float(total_outstanding or 0)
    }


@app.get("/top-debtors")
def top_debtors(db: Session = Depends(get_db)):

    from sqlalchemy import case

    # --- DB aggregation (efficient) ---
    results = db.query(
        models.Transaction.party_id,
        func.sum(
            case(
                (models.Transaction.type.in_(["SALE", "PURCHASE"]), models.Transaction.amount),
                (models.Transaction.type == "PAYMENT", -models.Transaction.amount),
                else_=0
            )
        ).label("balance")
    ).group_by(models.Transaction.party_id).order_by(
        func.sum(
            case(
                (models.Transaction.type.in_(["SALE", "PURCHASE"]), models.Transaction.amount),
                (models.Transaction.type == "PAYMENT", -models.Transaction.amount),
                else_=0
            )
        ).desc()
    ).limit(5).all()

    result = []

    for row in results:
        party = db.query(models.Party).filter_by(id=row.party_id).first()

        result.append({
            "party_name": party.name if party else "Unknown",
            "balance": float(row.balance or 0)
        })

    return {"top_debtors": result}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=10000)