from uuid import UUID

from fastapi import FastAPI
from app.db import engine, Base
from fastapi import UploadFile, File, Depends
import pandas as pd
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app import models
from sqlalchemy import case, func, text
from decimal import Decimal
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

app = FastAPI()

# Create tables
Base.metadata.create_all(bind=engine)


def ensure_database_schema():
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS item_type VARCHAR"))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS item_opening_stock (
                id UUID PRIMARY KEY,
                date DATE NOT NULL,
                item_type VARCHAR NOT NULL,
                opening_weight NUMERIC,
                created_at TIMESTAMP DEFAULT now(),
                CONSTRAINT unique_item_opening_stock UNIQUE (date, item_type)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS daily_item_stock (
                id UUID PRIMARY KEY,
                date DATE NOT NULL,
                item_type VARCHAR NOT NULL,
                opening_weight NUMERIC,
                purchase_weight NUMERIC,
                sales_weight NUMERIC,
                expected_closing_weight NUMERIC,
                actual_closing_weight NUMERIC,
                leakage NUMERIC,
                created_at TIMESTAMP DEFAULT now(),
                CONSTRAINT unique_daily_item_stock UNIQUE (date, item_type)
            )
        """))


ensure_database_schema()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for now
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Backend running"}


TEMPLATES = {
    "dealer": "DATE,DEALER,CATEGORY,HEN_TYPE,KGS,RATE_PER_KG,PAYMENT_MODE\n2026-04-21,ABC Supplier,Dealer,Broiler,100,120,Bank\n",
    "vendor": "DATE,VENDOR,HEN_TYPE,KGS,RATE_PER_KG,PAYMENT_MODE\n2026-04-21,XYZ Hotel,Broiler,40,150,Cash\n",
    "payment": "DATE,PARTY,AMOUNT,PAYMENT_MODE,DIRECTION\n2026-04-21,XYZ Hotel,5000,Online,RECEIVED\n",
    "opening-balance": "DATE,PARTY,OPENING_BALANCE,BALANCE_TYPE\n2026-04-01,XYZ Hotel,25000,RECEIVABLE\n",
    "opening-stock": "DATE,HEN_TYPE,OPENING_KGS\n2026-04-01,Broiler,500\n"
}


@app.get("/templates/{template_type}")
def download_template(template_type: str):
    template = TEMPLATES.get(template_type)
    if not template:
        return {"error": "Template not found"}

    return Response(
        content=template,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={template_type}_template.csv"}
    )


def normalize_party_name(name: str) -> str:
    return name.lower().replace(" ", "").replace(".", "")


def parse_input_date(value: str):
    try:
        return pd.to_datetime(value).date()
    except Exception:
        return None


def build_ledger(txns):
    balance = Decimal("0")
    ledger = []

    for txn in txns:
        amount = Decimal(txn.amount or 0)
        delta = ledger_delta(txn)
        balance += delta

        txn_type = txn.type
        if txn.type == "PAYMENT" and txn.category:
            txn_type = f"PAYMENT {txn.category}"
        elif txn.type == "OPENING" and txn.category:
            txn_type = f"OPENING {txn.category}"

        ledger.append({
            "date": str(txn.date),
            "type": txn_type,
            "category": txn.category or "",
            "item": txn.item_type or "",
            "payment_mode": txn.payment_mode or "NA",
            "amount": float(amount),
            "delta": float(delta),
            "balance": float(balance)
        })

    return balance, ledger


def ledger_delta(txn):
    amount = Decimal(txn.amount or 0)

    if txn.type in ["SALE", "PURCHASE", "OPENING"]:
        return amount

    if txn.type == "PAYMENT":
        return -amount

    return Decimal("0")


def receivable_delta(txn):
    amount = Decimal(txn.amount or 0)

    if txn.type == "SALE" or (txn.type == "OPENING" and txn.category == "RECEIVABLE"):
        return amount

    if txn.type == "PAYMENT" and txn.category == "RECEIVED":
        return -amount

    return Decimal("0")


def payable_delta(txn):
    amount = Decimal(txn.amount or 0)

    if txn.type == "PURCHASE" or (txn.type == "OPENING" and txn.category == "PAYABLE"):
        return amount

    if txn.type == "PAYMENT" and txn.category == "PAID":
        return -amount

    return Decimal("0")


def row_error(errors, row_number, message):
    errors.append({"row": row_number, "error": message})


def upload_result(inserted, skipped, errors, extra=None):
    result = {
        "status": "success",
        "rows_inserted": inserted,
        "rows_skipped": skipped,
        "errors": errors[:25],
        "preview": {
            "inserted": inserted,
            "skipped": skipped,
            "errors": len(errors)
        }
    }

    if extra:
        result.update(extra)

    return result


def get_or_create_party(db: Session, party_name: str, party_type: str, seen_aliases: dict):
    normalized = normalize_party_name(party_name)

    if normalized in seen_aliases:
        return seen_aliases[normalized]

    alias = db.query(models.PartyAlias).filter_by(
        normalized_alias=normalized
    ).first()

    if alias:
        party_id = alias.party_id
    else:
        party = models.Party(
            name=party_name,
            normalized_name=normalized,
            type=party_type
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

    seen_aliases[normalized] = party_id
    return party_id


def normalize_payment_direction(value: str):
    normalized = str(value).strip().upper()

    if normalized in ["RECEIVED", "RECEIVE", "FROM", "IN", "INCOMING", "CREDIT"]:
        return "RECEIVED"

    if normalized in ["PAID", "PAY", "TO", "OUT", "OUTGOING", "DEBIT"]:
        return "PAID"

    return None


def get_first_existing_column(df, candidates):
    for col in candidates:
        if col in df.columns:
            return col

    return None


def require_column(df, candidates, label):
    col = get_first_existing_column(df, candidates)
    if not col:
        return None, {"error": f"Missing column: {label}"}

    return col, None


def get_optional_row_value(row, candidates):
    for col in candidates:
        if col in row.index and not pd.isna(row[col]):
            value = str(row[col]).strip()
            if value:
                return value

    return None


@app.post("/upload/vendor")
def upload_vendor(file: UploadFile = File(...), preview: bool = False, db: Session = Depends(get_db)):

    import io
    import hashlib

    filename = (file.filename or "").lower()
    contents = file.file.read()

    # --- File hash (duplicate file protection) ---
    file_hash = hashlib.sha256(contents).hexdigest()

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

    date_col, error = require_column(df, ["DATE"], "DATE")
    if error:
        return error

    party_col, error = require_column(df, ["VENDOR", "PARTY", "NAME"], "VENDOR")
    if error:
        return error

    weight_col, error = require_column(df, ["KGS", "KG", "WEIGHT"], "KGS")
    if error:
        return error

    rate_col, error = require_column(df, ["RATE_PER_KG", "RATE PER KG", "RATE/KG", "RATE"], "RATE PER KG")
    if error:
        return error

    item_col, error = require_column(df, ["HEN_TYPE", "HEN TYPE", "ITEM", "TYPE"], "HEN TYPE")
    if error:
        return error

    # --- Numeric validation ---
    try:
        df[weight_col] = df[weight_col].astype(float)
        df[rate_col] = df[rate_col].astype(float)
    except:
        return {"error": "Invalid numeric values"}

    inserted = 0
    skipped = 0
    errors = []
    seen_aliases = {}
    seen_transactions = set()

    # --- Process rows ---
    for index, row in df.iterrows():
        row_number = int(index) + 2
        try:
            if pd.isna(row[party_col]) or pd.isna(row[weight_col]) or pd.isna(row[rate_col]) or pd.isna(row[item_col]):
                skipped += 1
                row_error(errors, row_number, "Missing vendor, hen type, kg, or rate")
                continue

            party_name = str(row[party_col]).strip()
            weight = float(row[weight_col])
            rate = float(row[rate_col])
            date = pd.to_datetime(row[date_col], dayfirst=True).date()
            item_type = str(row[item_col]).strip()
            category = get_optional_row_value(row, ["CATEGORY"])
            payment_mode = (
                str(row["PAYMENT_MODE"]).strip()
                if "PAYMENT_MODE" in df.columns and not pd.isna(row["PAYMENT_MODE"])
                else "NA"
            )

            if weight <= 0 or rate <= 0:
                skipped += 1
                row_error(errors, row_number, "KG and rate must be greater than zero")
                continue

            # --- Party mapping ---
            party_id = get_or_create_party(db, party_name, "VENDOR", seen_aliases)

            # --- Duplicate check ---
            existing_txn = db.query(models.Transaction).filter_by(
                date=date,
                party_id=party_id,
                weight=weight,
                rate=rate,
                type="SALE",
                category=category,
                item_type=item_type
            ).first()

            txn_key = (date, party_id, weight, rate, "SALE", category, item_type)

            if existing_txn or txn_key in seen_transactions:
                skipped += 1
                continue

            # --- Create sale transaction ---
            txn = models.Transaction(
                date=date,
                party_id=party_id,
                type="SALE",
                category=category,
                item_type=item_type,
                weight=weight,
                rate=rate,
                amount=weight * rate,
                payment_mode=payment_mode
            )

            db.add(txn)
            seen_transactions.add(txn_key)
            inserted += 1

        except Exception as e:
            skipped += 1
            row_error(errors, row_number, str(e))
            continue

    # --- Final commit (ONLY ONCE) ---
    try:
        if preview:
            db.rollback()
            return upload_result(inserted, skipped, errors, {"preview_mode": True})

        file_record = models.UploadedFile(
            file_hash=file_hash,
            file_type="vendor"
        )
        db.add(file_record)
        db.commit()

    except Exception as e:
        db.rollback()
        return {"error": "Transaction failed", "details": str(e)}

    return upload_result(inserted, skipped, errors)

@app.post("/upload/dealer")
def upload_dealer(file: UploadFile = File(...), preview: bool = False, db: Session = Depends(get_db)):

    import io
    import hashlib

    filename = (file.filename or "").lower()
    contents = file.file.read()

    # --- File hash protection ---
    file_hash = hashlib.sha256(contents).hexdigest()

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

    date_col, error = require_column(df, ["DATE"], "DATE")
    if error:
        return error

    party_col, error = require_column(df, ["DEALER", "PARTY", "NAME"], "DEALER")
    if error:
        return error

    category_col, error = require_column(df, ["CATEGORY"], "CATEGORY")
    if error:
        return error

    item_col, error = require_column(df, ["HEN_TYPE", "HEN TYPE", "ITEM", "TYPE"], "HEN TYPE")
    if error:
        return error

    weight_col, error = require_column(df, ["KGS", "KG", "WEIGHT"], "KGS")
    if error:
        return error

    rate_col, error = require_column(df, ["RATE_PER_KG", "RATE PER KG", "RATE/KG", "RATE"], "RATE PER KG")
    if error:
        return error

    # --- Numeric validation ---
    try:
        df[weight_col] = df[weight_col].astype(float)
        df[rate_col] = df[rate_col].astype(float)
    except:
        return {"error": "Invalid numeric values"}

    inserted = 0
    skipped = 0
    errors = []
    seen_aliases = {}
    seen_transactions = set()

    # --- Process rows ---
    for index, row in df.iterrows():
        row_number = int(index) + 2
        try:
            if (
                pd.isna(row[party_col]) or
                pd.isna(row[category_col]) or
                pd.isna(row[item_col]) or
                pd.isna(row[weight_col]) or
                pd.isna(row[rate_col])
            ):
                skipped += 1
                row_error(errors, row_number, "Missing dealer, category, hen type, kg, or rate")
                continue

            party_name = str(row[party_col]).strip()
            category = str(row[category_col]).strip()
            item_type = str(row[item_col]).strip()
            weight = float(row[weight_col])
            rate = float(row[rate_col])
            date = pd.to_datetime(row[date_col], dayfirst=True).date()

            payment_mode = (
                str(row["PAYMENT_MODE"]).strip()
                if "PAYMENT_MODE" in df.columns and not pd.isna(row["PAYMENT_MODE"])
                else "NA"
            )

            if weight <= 0 or rate <= 0:
                skipped += 1
                row_error(errors, row_number, "KG and rate must be greater than zero")
                continue

            # --- Party mapping ---
            party_id = get_or_create_party(db, party_name, "DEALER", seen_aliases)

            # --- Duplicate check (CORRECT TYPE) ---
            existing_txn = db.query(models.Transaction).filter_by(
                date=date,
                party_id=party_id,
                weight=weight,
                rate=rate,
                type="PURCHASE",
                category=category,
                item_type=item_type
            ).first()

            txn_key = (date, party_id, weight, rate, "PURCHASE", category, item_type)

            if existing_txn or txn_key in seen_transactions:
                skipped += 1
                continue

            # --- Create purchase transaction ---
            txn = models.Transaction(
                date=date,
                party_id=party_id,
                type="PURCHASE",
                category=category,
                item_type=item_type,
                weight=weight,
                rate=rate,
                amount=weight * rate,
                payment_mode=payment_mode
            )

            db.add(txn)
            seen_transactions.add(txn_key)
            inserted += 1

        except Exception as e:
            skipped += 1
            row_error(errors, row_number, str(e))
            continue

    # --- Final commit ---
    try:
        if preview:
            db.rollback()
            return upload_result(inserted, skipped, errors, {"preview_mode": True})

        file_record = models.UploadedFile(
            file_hash=file_hash,
            file_type="dealer"
        )
        db.add(file_record)
        db.commit()

    except Exception as e:
        db.rollback()
        return {"error": "Transaction failed", "details": str(e)}

    return upload_result(inserted, skipped, errors)


@app.post("/upload/payment")
def upload_payment(file: UploadFile = File(...), preview: bool = False, db: Session = Depends(get_db)):

    import io
    import hashlib

    filename = (file.filename or "").lower()
    contents = file.file.read()
    file_hash = hashlib.sha256(contents).hexdigest()

    existing_file = db.query(models.UploadedFile).filter_by(file_hash=file_hash).first()
    if existing_file:
        return {"error": "File already uploaded"}

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

    if df.empty:
        return {"error": "File is empty"}

    df.columns = df.columns.str.strip().str.upper()

    required_cols = ["DATE", "PARTY", "AMOUNT", "PAYMENT_MODE", "DIRECTION"]
    for col in required_cols:
        if col not in df.columns:
            return {"error": f"Missing column: {col}"}

    try:
        df["AMOUNT"] = df["AMOUNT"].astype(float)
    except Exception:
        return {"error": "Invalid amount values"}

    inserted = 0
    skipped = 0
    errors = []
    seen_aliases = {}
    seen_payments = set()

    for index, row in df.iterrows():
        row_number = int(index) + 2
        try:
            if pd.isna(row["PARTY"]) or pd.isna(row["AMOUNT"]) or pd.isna(row["DIRECTION"]):
                skipped += 1
                row_error(errors, row_number, "Missing party, amount, or direction")
                continue

            party_name = str(row["PARTY"]).strip()
            amount = Decimal(str(float(row["AMOUNT"])))
            target_date = pd.to_datetime(row["DATE"], dayfirst=True).date()
            payment_mode = str(row["PAYMENT_MODE"]).strip() if not pd.isna(row["PAYMENT_MODE"]) else "NA"
            direction = normalize_payment_direction(row["DIRECTION"])

            if not party_name or amount <= 0 or not direction:
                skipped += 1
                row_error(errors, row_number, "Invalid party, amount, or payment direction")
                continue

            party_id = get_or_create_party(db, party_name, "BOTH", seen_aliases)

            existing_payment = db.query(models.Transaction).filter_by(
                date=target_date,
                party_id=party_id,
                type="PAYMENT",
                amount=amount,
                payment_mode=payment_mode,
                category=direction
            ).first()

            payment_key = (target_date, party_id, amount, payment_mode, direction)
            if existing_payment or payment_key in seen_payments:
                skipped += 1
                continue

            txn = models.Transaction(
                date=target_date,
                party_id=party_id,
                type="PAYMENT",
                category=direction,
                amount=amount,
                payment_mode=payment_mode
            )

            db.add(txn)
            seen_payments.add(payment_key)
            inserted += 1

        except Exception as e:
            skipped += 1
            row_error(errors, row_number, str(e))
            continue

    try:
        if preview:
            db.rollback()
            return upload_result(inserted, skipped, errors, {"preview_mode": True})

        file_record = models.UploadedFile(
            file_hash=file_hash,
            file_type="payment"
        )
        db.add(file_record)
        db.commit()

    except Exception as e:
        db.rollback()
        return {"error": "Transaction failed", "details": str(e)}

    return upload_result(inserted, skipped, errors)


@app.post("/upload/opening-balance")
def upload_opening_balance(file: UploadFile = File(...), preview: bool = False, db: Session = Depends(get_db)):

    import io
    import hashlib

    filename = (file.filename or "").lower()
    contents = file.file.read()
    file_hash = hashlib.sha256(contents).hexdigest()

    existing_file = db.query(models.UploadedFile).filter_by(file_hash=file_hash).first()
    if existing_file:
        return {"error": "File already uploaded"}

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

    if df.empty:
        return {"error": "File is empty"}

    df.columns = df.columns.str.strip().str.upper()

    date_col, error = require_column(df, ["DATE"], "DATE")
    if error:
        return error

    party_col, error = require_column(df, ["PARTY", "NAME", "VENDOR", "DEALER"], "PARTY")
    if error:
        return error

    amount_col, error = require_column(df, ["OPENING_BALANCE", "OPENING BALANCE", "AMOUNT", "BALANCE"], "OPENING BALANCE")
    if error:
        return error

    balance_type_col, error = require_column(df, ["BALANCE_TYPE", "BALANCE TYPE", "TYPE"], "BALANCE TYPE")
    if error:
        return error

    try:
        df[amount_col] = df[amount_col].astype(float)
    except Exception:
        return {"error": "Invalid opening balance values"}

    inserted = 0
    skipped = 0
    errors = []
    seen_aliases = {}
    seen_opening = set()

    for index, row in df.iterrows():
        row_number = int(index) + 2
        try:
            if pd.isna(row[party_col]) or pd.isna(row[amount_col]) or pd.isna(row[balance_type_col]):
                skipped += 1
                row_error(errors, row_number, "Missing party, opening balance, or balance type")
                continue

            party_name = str(row[party_col]).strip()
            amount = Decimal(str(float(row[amount_col])))
            target_date = pd.to_datetime(row[date_col], dayfirst=True).date()
            balance_type = str(row[balance_type_col]).strip().upper()

            if balance_type in ["RECEIVABLE", "RECEIVE", "CUSTOMER", "VENDOR"]:
                balance_type = "RECEIVABLE"
                party_type = "VENDOR"
            elif balance_type in ["PAYABLE", "PAY", "SUPPLIER", "DEALER"]:
                balance_type = "PAYABLE"
                party_type = "DEALER"
            else:
                skipped += 1
                row_error(errors, row_number, "Balance type must be RECEIVABLE or PAYABLE")
                continue

            if not party_name or amount < 0:
                skipped += 1
                row_error(errors, row_number, "Invalid party or opening balance")
                continue

            party_id = get_or_create_party(db, party_name, party_type, seen_aliases)

            existing_opening = db.query(models.Transaction).filter_by(
                date=target_date,
                party_id=party_id,
                type="OPENING",
                category=balance_type
            ).first()

            opening_key = (target_date, party_id, balance_type)
            if existing_opening or opening_key in seen_opening:
                skipped += 1
                continue

            txn = models.Transaction(
                date=target_date,
                party_id=party_id,
                type="OPENING",
                category=balance_type,
                amount=amount,
                payment_mode="NA"
            )

            db.add(txn)
            seen_opening.add(opening_key)
            inserted += 1

        except Exception as e:
            skipped += 1
            row_error(errors, row_number, str(e))
            continue

    try:
        if preview:
            db.rollback()
            return upload_result(inserted, skipped, errors, {"preview_mode": True})

        file_record = models.UploadedFile(
            file_hash=file_hash,
            file_type="opening_balance"
        )
        db.add(file_record)
        db.commit()
    except Exception as e:
        db.rollback()
        return {"error": "Transaction failed", "details": str(e)}

    return upload_result(inserted, skipped, errors)


@app.post("/upload/opening-stock")
def upload_opening_stock(file: UploadFile = File(...), preview: bool = False, db: Session = Depends(get_db)):

    import io
    import hashlib

    filename = (file.filename or "").lower()
    contents = file.file.read()
    file_hash = hashlib.sha256(contents).hexdigest()

    existing_file = db.query(models.UploadedFile).filter_by(file_hash=file_hash).first()
    if existing_file:
        return {"error": "File already uploaded"}

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

    if df.empty:
        return {"error": "File is empty"}

    df.columns = df.columns.str.strip().str.upper()

    date_col, error = require_column(df, ["DATE"], "DATE")
    if error:
        return error

    item_col, error = require_column(df, ["HEN_TYPE", "HEN TYPE", "ITEM", "TYPE"], "HEN TYPE")
    if error:
        return error

    weight_col, error = require_column(df, ["OPENING_KGS", "OPENING KGS", "KGS", "KG", "WEIGHT"], "OPENING KGS")
    if error:
        return error

    try:
        df[weight_col] = df[weight_col].astype(float)
    except Exception:
        return {"error": "Invalid opening stock values"}

    inserted = 0
    skipped = 0
    errors = []
    seen_stock = set()

    for index, row in df.iterrows():
        row_number = int(index) + 2
        try:
            if pd.isna(row[item_col]) or pd.isna(row[weight_col]):
                skipped += 1
                row_error(errors, row_number, "Missing hen type or opening kg")
                continue

            target_date = pd.to_datetime(row[date_col], dayfirst=True).date()
            item_type = str(row[item_col]).strip()
            opening_weight = Decimal(str(float(row[weight_col])))

            if not item_type or opening_weight < 0:
                skipped += 1
                row_error(errors, row_number, "Invalid hen type or opening kg")
                continue

            existing_stock = db.query(models.ItemOpeningStock).filter_by(
                date=target_date,
                item_type=item_type
            ).first()

            stock_key = (target_date, item_type)
            if existing_stock or stock_key in seen_stock:
                skipped += 1
                continue

            db.add(models.ItemOpeningStock(
                date=target_date,
                item_type=item_type,
                opening_weight=opening_weight
            ))
            seen_stock.add(stock_key)
            inserted += 1

        except Exception as e:
            skipped += 1
            row_error(errors, row_number, str(e))
            continue

    try:
        if preview:
            db.rollback()
            return upload_result(inserted, skipped, errors, {"preview_mode": True})

        file_record = models.UploadedFile(
            file_hash=file_hash,
            file_type="opening_stock"
        )
        db.add(file_record)
        db.commit()
    except Exception as e:
        db.rollback()
        return {"error": "Transaction failed", "details": str(e)}

    return upload_result(inserted, skipped, errors)


@app.post("/process-day")
def process_day(input_date: str, actual_stock: float, db: Session = Depends(get_db)):

    target_date = parse_input_date(input_date)
    if not target_date:
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


@app.post("/process-day/items")
def process_day_items(input_date: str, actual_stock: list[dict], db: Session = Depends(get_db)):
    target_date = parse_input_date(input_date)
    if not target_date:
        return {"error": "Invalid date format"}

    if not actual_stock:
        return {"error": "Enter actual stock for at least one hen type"}

    normalized_actuals = {}
    for row in actual_stock:
        item = str(row.get("item_type", "")).strip()
        try:
            actual = Decimal(str(row.get("actual_weight", "")))
        except Exception:
            return {"error": f"Invalid actual stock for {item or 'item'}"}

        if not item or actual < 0:
            return {"error": "Invalid hen type or actual stock"}

        normalized_actuals[item] = actual

    existing = db.query(models.DailyItemStock).filter(
        models.DailyItemStock.date == target_date,
        models.DailyItemStock.item_type.in_(list(normalized_actuals.keys()))
    ).first()
    if existing:
        return {"error": "One or more hen types already processed for this day"}

    results = []

    try:
        for item_type, actual_weight in normalized_actuals.items():
            prev_stock = db.query(models.DailyItemStock).filter(
                models.DailyItemStock.item_type == item_type,
                models.DailyItemStock.date < target_date
            ).order_by(models.DailyItemStock.date.desc()).first()

            if prev_stock:
                opening_weight = Decimal(prev_stock.actual_closing_weight or 0)
            else:
                opening = db.query(models.ItemOpeningStock).filter(
                    models.ItemOpeningStock.item_type == item_type,
                    models.ItemOpeningStock.date <= target_date
                ).order_by(models.ItemOpeningStock.date.desc()).first()
                opening_weight = Decimal(opening.opening_weight or 0) if opening else Decimal("0")

            purchase_weight = db.query(func.sum(models.Transaction.weight)).filter(
                models.Transaction.date == target_date,
                models.Transaction.item_type == item_type,
                models.Transaction.type == "PURCHASE"
            ).scalar() or 0

            sales_weight = db.query(func.sum(models.Transaction.weight)).filter(
                models.Transaction.date == target_date,
                models.Transaction.item_type == item_type,
                models.Transaction.type == "SALE"
            ).scalar() or 0

            purchase_weight = Decimal(str(purchase_weight))
            sales_weight = Decimal(str(sales_weight))
            expected_stock = opening_weight + purchase_weight - sales_weight
            leakage = expected_stock - actual_weight

            daily = models.DailyItemStock(
                date=target_date,
                item_type=item_type,
                opening_weight=opening_weight,
                purchase_weight=purchase_weight,
                sales_weight=sales_weight,
                expected_closing_weight=expected_stock,
                actual_closing_weight=actual_weight,
                leakage=leakage
            )
            db.add(daily)

            results.append({
                "date": str(target_date),
                "item": item_type,
                "opening_stock": float(opening_weight),
                "purchase": float(purchase_weight),
                "sales": float(sales_weight),
                "expected_stock": float(expected_stock),
                "actual_stock": float(actual_weight),
                "leakage": float(leakage)
            })

        db.commit()

    except Exception as e:
        db.rollback()
        return {"error": "Processing failed", "details": str(e)}

    return {
        "status": "success",
        "date": str(target_date),
        "items": results,
        "total_expected_stock": sum(row["expected_stock"] for row in results),
        "total_actual_stock": sum(row["actual_stock"] for row in results),
        "total_leakage": sum(row["leakage"] for row in results)
    }


@app.get("/party/{party_id}/ledger")
def get_party_ledger(
    party_id: UUID,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db)
):

    # --- Validate party ---
    party = db.query(models.Party).filter_by(id=party_id).first()
    if not party:
        return {"error": "Party not found"}

    query = db.query(models.Transaction).filter_by(party_id=party_id)

    if start_date:
        start = parse_input_date(start_date)
        if not start:
            return {"error": "Invalid start date"}
        query = query.filter(models.Transaction.date >= start)

    if end_date:
        end = parse_input_date(end_date)
        if not end:
            return {"error": "Invalid end date"}
        query = query.filter(models.Transaction.date <= end)

    # --- Fetch transactions ---
    txns = query.order_by(models.Transaction.date.asc()).all()

    if not txns:
        return {
            "party_id": party_id,
            "party_name": party.name,
            "total_balance": 0,
            "ledger": []
        }

    balance, ledger = build_ledger(txns)

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

    normalized = normalize_party_name(name)

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
def get_ledger_by_name(
    name: str,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db)
):
    if not name or len(name.strip()) < 2:
        return {"error": "Invalid party name"}

    normalized = normalize_party_name(name)

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

    query = db.query(models.Transaction).filter(
        models.Transaction.party_id == party_id
    )

    if start_date:
        start = parse_input_date(start_date)
        if not start:
            return {"error": "Invalid start date"}
        query = query.filter(models.Transaction.date >= start)

    if end_date:
        end = parse_input_date(end_date)
        if not end:
            return {"error": "Invalid end date"}
        query = query.filter(models.Transaction.date <= end)

    txns = query.order_by(models.Transaction.date.asc()).all()

    if not txns:
        return {
            "party_name": name,
            "total_balance": 0,
            "ledger": []
        }

    balance, ledger = build_ledger(txns)

    return {
        "party_name": name,
        "total_balance": float(balance),
        "ledger": ledger
    }


@app.get("/party/detail")
def get_party_detail(name: str, db: Session = Depends(get_db)):
    if not name or len(name.strip()) < 2:
        return {"error": "Invalid party name"}

    normalized = normalize_party_name(name)
    alias = db.query(models.PartyAlias).filter(
        models.PartyAlias.normalized_alias == normalized
    ).first()

    if not alias:
        alias = db.query(models.PartyAlias).filter(
            models.PartyAlias.normalized_alias.contains(normalized)
        ).first()

    if not alias:
        return {"error": "Party not found"}

    party = db.query(models.Party).filter_by(id=alias.party_id).first()
    if not party:
        return {"error": "Party not found"}

    txns = db.query(models.Transaction).filter_by(
        party_id=party.id
    ).order_by(models.Transaction.date.asc()).all()

    balance, ledger = build_ledger(txns)
    total_sales = sum(Decimal(t.amount or 0) for t in txns if t.type == "SALE")
    total_purchase = sum(Decimal(t.amount or 0) for t in txns if t.type == "PURCHASE")
    total_received = sum(Decimal(t.amount or 0) for t in txns if t.type == "PAYMENT" and t.category == "RECEIVED")
    total_paid = sum(Decimal(t.amount or 0) for t in txns if t.type == "PAYMENT" and t.category == "PAID")
    opening_balance = sum(Decimal(t.amount or 0) for t in txns if t.type == "OPENING")
    last_txn = txns[-1] if txns else None

    return {
        "party": {
            "id": str(party.id),
            "name": party.name,
            "type": party.type
        },
        "summary": {
            "opening_balance": float(opening_balance),
            "total_sales": float(total_sales),
            "total_purchase": float(total_purchase),
            "total_received": float(total_received),
            "total_paid": float(total_paid),
            "current_balance": float(balance),
            "last_transaction_date": str(last_txn.date) if last_txn else None
        },
        "ledger": ledger
    }


@app.get("/dashboard")
def get_dashboard(date: str, db: Session = Depends(get_db)):

    target_date = parse_input_date(date)
    if not target_date:
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

        txns = db.query(models.Transaction).all()
        receivable = sum(receivable_delta(t) for t in txns)
        payable = sum(payable_delta(t) for t in txns)

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

        "receivable": float(receivable),
        "payable": float(payable),
        "total_outstanding": float(receivable + payable)
    }


@app.get("/top-debtors")
def top_debtors(db: Session = Depends(get_db)):
    result = []
    parties = db.query(models.Party).all()

    for party in parties:
        txns = db.query(models.Transaction).filter_by(party_id=party.id).all()
        balance = sum(receivable_delta(t) for t in txns)
        if balance > 0:
            result.append({
                "party_name": party.name,
                "balance": float(balance)
            })

    result = sorted(result, key=lambda row: row["balance"], reverse=True)[:5]

    return {"top_debtors": result}


@app.get("/top-payables")
def top_payables(db: Session = Depends(get_db)):
    result = []
    parties = db.query(models.Party).all()

    for party in parties:
        txns = db.query(models.Transaction).filter_by(party_id=party.id).all()
        balance = sum(payable_delta(t) for t in txns)
        if balance > 0:
            result.append({
                "party_name": party.name,
                "balance": float(balance)
            })

    result = sorted(result, key=lambda row: row["balance"], reverse=True)[:5]

    return {"top_payables": result}


@app.get("/analytics/trend")
def get_trend(start_date: str, end_date: str, db: Session = Depends(get_db)):

    start = parse_input_date(start_date)
    end = parse_input_date(end_date)
    if not start or not end:
        return {"error": "Invalid date format"}

    results = db.query(
        models.Transaction.date,
        func.sum(
            case(
                (models.Transaction.type == "SALE", models.Transaction.amount),
                else_=0
            )
        ).label("sales"),
        func.sum(
            case(
                (models.Transaction.type == "PURCHASE", models.Transaction.amount),
                else_=0
            )
        ).label("purchase")
    ).filter(
        models.Transaction.date.between(start, end)
    ).group_by(models.Transaction.date).order_by(models.Transaction.date).all()

    return [
        {
            "date": str(r.date),
            "sales": float(r.sales or 0),
            "purchase": float(r.purchase or 0)
        }
        for r in results
    ]

@app.get("/analytics/leakage")
def leakage_trend(start_date: str, end_date: str, db: Session = Depends(get_db)):

    start = parse_input_date(start_date)
    end = parse_input_date(end_date)
    if not start or not end:
        return {"error": "Invalid date format"}

    rows = db.query(models.DailyStock).filter(
        models.DailyStock.date.between(start, end)
    ).order_by(models.DailyStock.date).all()

    return [
        {
            "date": str(r.date),
            "leakage": float(r.leakage or 0)
        }
        for r in rows
    ]


@app.get("/inventory/by-item")
def inventory_by_item(date: str, db: Session = Depends(get_db)):
    target_date = parse_input_date(date)
    if not target_date:
        return {"error": "Invalid date format"}

    items = set()
    for row in db.query(models.Transaction.item_type).filter(models.Transaction.item_type.isnot(None)).distinct().all():
        if row.item_type:
            items.add(row.item_type)
    for row in db.query(models.ItemOpeningStock.item_type).distinct().all():
        if row.item_type:
            items.add(row.item_type)

    result = []

    for item in sorted(items):
        processed = db.query(models.DailyItemStock).filter_by(
            date=target_date,
            item_type=item
        ).first()

        if processed:
            result.append({
                "item": item,
                "opening_date": str(target_date),
                "opening_weight": float(processed.opening_weight or 0),
                "purchase_weight": float(processed.purchase_weight or 0),
                "sales_weight": float(processed.sales_weight or 0),
                "expected_closing_weight": float(processed.expected_closing_weight or 0),
                "actual_closing_weight": float(processed.actual_closing_weight or 0),
                "leakage": float(processed.leakage or 0),
                "closing_weight": float(processed.actual_closing_weight or 0)
            })
            continue

        opening = db.query(models.ItemOpeningStock).filter(
            models.ItemOpeningStock.item_type == item,
            models.ItemOpeningStock.date <= target_date
        ).order_by(models.ItemOpeningStock.date.desc()).first()

        opening_date = opening.date if opening else None
        opening_weight = Decimal(opening.opening_weight or 0) if opening else Decimal("0")

        query = db.query(models.Transaction).filter(
            models.Transaction.item_type == item,
            models.Transaction.date <= target_date
        )

        if opening_date:
            query = query.filter(models.Transaction.date >= opening_date)

        txns = query.all()
        purchase_weight = sum(Decimal(t.weight or 0) for t in txns if t.type == "PURCHASE")
        sales_weight = sum(Decimal(t.weight or 0) for t in txns if t.type == "SALE")
        closing_weight = opening_weight + purchase_weight - sales_weight

        result.append({
            "item": item,
            "opening_date": str(opening_date) if opening_date else None,
            "opening_weight": float(opening_weight),
            "purchase_weight": float(purchase_weight),
            "sales_weight": float(sales_weight),
            "expected_closing_weight": float(closing_weight),
            "actual_closing_weight": None,
            "leakage": None,
            "closing_weight": float(closing_weight)
        })

    return {"inventory": result}


@app.get("/items/search")
def search_items(q: str = "", db: Session = Depends(get_db)):
    normalized_query = q.strip().lower()
    items = set()

    for row in db.query(models.Transaction.item_type).filter(models.Transaction.item_type.isnot(None)).distinct().all():
        if row.item_type:
            items.add(row.item_type)

    for row in db.query(models.ItemOpeningStock.item_type).distinct().all():
        if row.item_type:
            items.add(row.item_type)

    results = sorted(
        item for item in items
        if not normalized_query or normalized_query in item.lower()
    )[:20]

    return {"results": results}


@app.get("/analytics/profit-by-item")
def profit_by_item(start_date: str, end_date: str, db: Session = Depends(get_db)):
    start = parse_input_date(start_date)
    end = parse_input_date(end_date)
    if not start or not end:
        return {"error": "Invalid date format"}

    txns = db.query(models.Transaction).filter(
        models.Transaction.date.between(start, end),
        models.Transaction.item_type.isnot(None)
    ).all()

    by_item = {}
    for txn in txns:
        item = txn.item_type or "Unknown"
        by_item.setdefault(item, {"item": item, "sales": Decimal("0"), "purchase": Decimal("0")})

        if txn.type == "SALE":
            by_item[item]["sales"] += Decimal(txn.amount or 0)
        elif txn.type == "PURCHASE":
            by_item[item]["purchase"] += Decimal(txn.amount or 0)

    return [
        {
            "item": row["item"],
            "sales": float(row["sales"]),
            "purchase": float(row["purchase"]),
            "profit": float(row["sales"] - row["purchase"])
        }
        for row in by_item.values()
    ]

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=10000)
