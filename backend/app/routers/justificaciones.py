# backend/app/routers/justificaciones.py
# Stub creado en Task 8 para que el conftest del test_router pueda importar.
# Task 9 reescribe este archivo con los endpoints reales.
import sqlite3

from fastapi import APIRouter
from app.services.justificaciones.db import get_conn

router = APIRouter()


def get_conn_dep() -> sqlite3.Connection:
    conn = get_conn()
    try:
        yield conn
    finally:
        conn.close()
