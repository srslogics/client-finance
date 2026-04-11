# services/stock_service.py

def calculate_closing(opening, purchase, sales):
    return opening + purchase - sales

def calculate_difference(system, actual):
    return actual - system
