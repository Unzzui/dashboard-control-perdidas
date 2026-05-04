"""
CRUD puro sobre SQLite. Sin lógica de negocio.
Cada función recibe la conexión por parámetro (inyectable para tests).
"""
import sqlite3
from typing import Optional


# ============================================================================
# Excepciones del dominio del repository
# ============================================================================

class AnalistaDuplicadoError(Exception):
    """Ya existe un analista con ese nombre."""


class AnalistaNoExisteError(Exception):
    """No existe analista con ese id."""


# ============================================================================
# Analistas
# ============================================================================

def create_analista(conn: sqlite3.Connection, nombre: str) -> sqlite3.Row:
    try:
        cur = conn.execute(
            "INSERT INTO analistas (nombre) VALUES (?)",
            (nombre,),
        )
        conn.commit()
        return _get_analista_by_id(conn, cur.lastrowid)
    except sqlite3.IntegrityError as exc:
        if "UNIQUE" in str(exc):
            raise AnalistaDuplicadoError(nombre) from exc
        raise


def get_analista_by_nombre(conn: sqlite3.Connection, nombre: str) -> Optional[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM analistas WHERE nombre = ?", (nombre,)
    ).fetchone()


def list_analistas(conn: sqlite3.Connection, solo_activos: bool = False) -> list[sqlite3.Row]:
    if solo_activos:
        rows = conn.execute(
            "SELECT * FROM analistas WHERE activo = 1 ORDER BY nombre"
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM analistas ORDER BY nombre").fetchall()
    return list(rows)


def update_analista_activo(
    conn: sqlite3.Connection, analista_id: int, activo: bool
) -> sqlite3.Row:
    cur = conn.execute(
        "UPDATE analistas SET activo = ? WHERE id = ?",
        (1 if activo else 0, analista_id),
    )
    if cur.rowcount == 0:
        raise AnalistaNoExisteError(analista_id)
    conn.commit()
    return _get_analista_by_id(conn, analista_id)


def _get_analista_by_id(conn: sqlite3.Connection, analista_id: int) -> sqlite3.Row:
    return conn.execute(
        "SELECT * FROM analistas WHERE id = ?", (analista_id,)
    ).fetchone()
