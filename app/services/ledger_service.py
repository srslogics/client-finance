# services/ledger_service.py

def update_balance(party, txn_type, amount):
    if txn_type == "sale":
        party.balance += amount
    elif txn_type == "payment":
        party.balance -= amount
    elif txn_type == "purchase":
        party.balance -= amount

def generate_ledger(txns):
    balance = 0
    ledger = []

    for t in txns:
        if t.type == "sale":
            balance += t.total
        elif t.type == "payment":
            balance -= t.total
        elif t.type == "purchase":
            balance -= t.total

        ledger.append({
            "date": t.date,
            "type": t.type,
            "amount": t.total,
            "running_balance": balance
        })

    return ledger
