from enum import Enum

class PartyType(str, Enum):
    DEALER = "dealer"
    VENDOR = "vendor"

class TransactionType(str, Enum):
    SALE = "sale"
    PURCHASE = "purchase"
    PAYMENT = "payment"
