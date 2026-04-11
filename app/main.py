from fastapi import FastAPI
from app.db import Base, engine

from app.routes import party, transaction, dashboard

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(party.router)
app.include_router(transaction.router)
app.include_router(dashboard.router)
