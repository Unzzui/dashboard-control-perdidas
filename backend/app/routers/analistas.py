# backend/app/routers/analistas.py
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.services.justificaciones import repository as repo
from app.services.justificaciones.db import get_conn

router = APIRouter()


def get_conn_dep() -> sqlite3.Connection:
    """Dependency para abrir/cerrar conexión por request."""
    conn = get_conn()
    try:
        yield conn
    finally:
        conn.close()


class AnalistaCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)


class AnalistaUpdate(BaseModel):
    activo: int = Field(..., ge=0, le=1)


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}


@router.get("/api/v1/analistas")
def list_analistas(
    activos: bool = False, conn: sqlite3.Connection = Depends(get_conn_dep)
):
    rows = repo.list_analistas(conn, solo_activos=activos)
    return [_row_to_dict(r) for r in rows]


@router.post("/api/v1/analistas", status_code=201)
def create_analista(
    payload: AnalistaCreate, conn: sqlite3.Connection = Depends(get_conn_dep)
):
    try:
        row = repo.create_analista(conn, nombre=payload.nombre)
    except repo.AnalistaDuplicadoError:
        raise HTTPException(status_code=409, detail="Analista ya existe")
    return _row_to_dict(row)


@router.patch("/api/v1/analistas/{analista_id}")
def update_analista(
    analista_id: int,
    payload: AnalistaUpdate,
    conn: sqlite3.Connection = Depends(get_conn_dep),
):
    try:
        row = repo.update_analista_activo(
            conn, analista_id=analista_id, activo=bool(payload.activo)
        )
    except repo.AnalistaNoExisteError:
        raise HTTPException(status_code=404, detail="Analista no existe")
    return _row_to_dict(row)
