# routes/dashboard.py

@router.get("/dashboard")
def dashboard(db: Session = Depends(SessionLocal)):
    txns = db.query(Transaction).all()

    sales = sum(t.total for t in txns if t.type == "sale")
    purchase = sum(t.total for t in txns if t.type == "purchase")
    expenses = db.query(Expense).all()
    total_expense = sum(e.amount for e in expenses)

    stock_loss = sum(s.difference for s in db.query(Stock).all())

    profit = sales - purchase - total_expense - stock_loss


    return {
        "sales": sales,
        "purchase": purchase,
        "profit": sales - purchase
    }
