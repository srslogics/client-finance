# services/whatsapp_service.py

from twilio.rest import Client

ACCOUNT_SID = "your_sid"
AUTH_TOKEN = "your_token"

client = Client(ACCOUNT_SID, AUTH_TOKEN)

def send_whatsapp(to, message):
    client.messages.create(
        body=message,
        from_='whatsapp:+14155238886',
        to=f'whatsapp:{to}'
    )

from app.services.whatsapp_service import send_whatsapp

def send_daily_report(phone, report):

    msg = f"""
📊 Daily Report

Sales: ₹{report['sales']}
Purchase: ₹{report['purchase']}
Expenses: ₹{report['expenses']}
Stock Loss: ₹{report['stock_loss']}

💰 Profit: ₹{report['profit']}
"""

    send_whatsapp(phone, msg)

def send_payment_reminder(dealer):

    msg = f"""
⚠️ Payment Reminder

{dealer.name}, your outstanding is ₹{dealer.balance}

Please clear dues.
"""

    send_whatsapp(dealer.phone, msg)
