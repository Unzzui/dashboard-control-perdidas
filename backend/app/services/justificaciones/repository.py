"""
CRUD puro sobre SQLite. Sin lógica de negocio.
Cada función recibe la conexión por parámetro (inyectable para tests).
"""
import json
import sqlite3
from datetime import datetime
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

def create_analista(
    conn: sqlite3.Connection,
    *,
    nombre: str,
    apellido: Optional[str] = None,
    cargo: Optional[str] = None,
    correo: Optional[str] = None,
) -> sqlite3.Row:
    try:
        cur = conn.execute(
            "INSERT INTO analistas (nombre, apellido, cargo, correo) "
            "VALUES (?, ?, ?, ?)",
            (nombre, apellido, cargo, correo),
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
        "UPDATE analistas SET activo = ?, updated_at = ? WHERE id = ?",
        (1 if activo else 0, datetime.utcnow().isoformat(timespec="seconds"), analista_id),
    )
    if cur.rowcount == 0:
        raise AnalistaNoExisteError(analista_id)
    conn.commit()
    return _get_analista_by_id(conn, analista_id)


def update_analista_perfil(
    conn: sqlite3.Connection,
    *,
    analista_id: int,
    apellido: Optional[str] = None,
    cargo: Optional[str] = None,
    correo: Optional[str] = None,
) -> sqlite3.Row:
    """
    Actualiza campos de perfil (no nombre, no activo).
    Pasa None para dejar un campo intacto. Para borrar, pasar string vacío.
    """
    actual = _get_analista_by_id(conn, analista_id)
    if actual is None:
        raise AnalistaNoExisteError(analista_id)

    sets = []
    params: list = []
    for campo, valor in (("apellido", apellido), ("cargo", cargo), ("correo", correo)):
        if valor is not None:
            sets.append(f"{campo} = ?")
            params.append(valor if valor != "" else None)
    if not sets:
        return actual

    sets.append("updated_at = ?")
    params.append(datetime.utcnow().isoformat(timespec="seconds"))
    params.append(analista_id)
    conn.execute(
        f"UPDATE analistas SET {', '.join(sets)} WHERE id = ?", params,
    )
    conn.commit()
    return _get_analista_by_id(conn, analista_id)


def delete_analista(conn: sqlite3.Connection, analista_id: int) -> None:
    """
    Borra un analista. Las justificaciones existentes conservan el handle
    en `usuario_registro` como string histórico (no hay FK).
    """
    actual = _get_analista_by_id(conn, analista_id)
    if actual is None:
        raise AnalistaNoExisteError(analista_id)
    conn.execute("DELETE FROM analistas WHERE id = ?", (analista_id,))
    conn.commit()


def count_justificaciones_por_analista(
    conn: sqlite3.Connection, nombre: str
) -> int:
    """Cuenta justificaciones registradas por un analista (por handle)."""
    row = conn.execute(
        "SELECT COUNT(*) AS n FROM justificaciones WHERE usuario_registro = ?",
        (nombre,),
    ).fetchone()
    return int(row["n"])


def _get_analista_by_id(conn: sqlite3.Connection, analista_id: int) -> sqlite3.Row:
    return conn.execute(
        "SELECT * FROM analistas WHERE id = ?", (analista_id,)
    ).fetchone()


# ============================================================================
# Excepciones del dominio — Justificaciones
# ============================================================================

class JustificacionDuplicadaError(Exception):
    """Ya existe justificación para (tecnico, fecha)."""
    def __init__(self, id_existente: int):
        super().__init__(f"Ya existe justificacion id={id_existente}")
        self.id_existente = id_existente


class JustificacionNoExisteError(Exception):
    """No existe justificación con ese id."""


# ============================================================================
# Justificaciones
# ============================================================================

def create_justificacion(
    conn: sqlite3.Connection,
    *,
    fecha: str,
    tecnico_nombre: str,
    zona_origen: Optional[str],
    tipo_evento: str,
    motivo: str,
    comentario: Optional[str],
    produccion_real: int,
    meta_diaria: int,
    estado_antes: str,
    estado_despues: str = "justificado",
    es_futuro: bool = False,
    usuario_registro: str,
) -> sqlite3.Row:
    try:
        cur = conn.execute(
            """
            INSERT INTO justificaciones
            (fecha, tecnico_nombre, zona_origen, tipo_evento, motivo, comentario,
             produccion_real, meta_diaria, estado_antes, estado_despues, es_futuro,
             usuario_registro)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (fecha, tecnico_nombre, zona_origen, tipo_evento, motivo, comentario,
             produccion_real, meta_diaria, estado_antes, estado_despues,
             1 if es_futuro else 0, usuario_registro),
        )
        new_id = cur.lastrowid
        row = _get_justificacion_by_id(conn, new_id)
        _write_audit(conn, justificacion_id=new_id, accion="create",
                     snapshot=_row_to_dict(row), diff=None,
                     usuario=usuario_registro)
        conn.commit()
        return row
    except sqlite3.IntegrityError as exc:
        if "UNIQUE" in str(exc):
            existente = conn.execute(
                "SELECT id FROM justificaciones WHERE tecnico_nombre = ? AND fecha = ?",
                (tecnico_nombre, fecha),
            ).fetchone()
            raise JustificacionDuplicadaError(id_existente=existente["id"]) from exc
        raise


def update_justificacion(
    conn: sqlite3.Connection,
    *,
    justificacion_id: int,
    cambios: dict,
    usuario_registro: str,
) -> sqlite3.Row:
    actual = _get_justificacion_by_id(conn, justificacion_id)
    if actual is None:
        raise JustificacionNoExisteError(justificacion_id)

    actualizables = {"motivo", "comentario"}
    cambios_validos = {k: v for k, v in cambios.items() if k in actualizables}
    if not cambios_validos:
        return actual

    diff = {}
    for k, nuevo in cambios_validos.items():
        antes = actual[k]
        if antes != nuevo:
            diff[k] = {"antes": antes, "despues": nuevo}

    set_sql = ", ".join(f"{k} = ?" for k in cambios_validos)
    params = list(cambios_validos.values()) + [
        datetime.utcnow().isoformat(timespec="seconds"),
        justificacion_id,
    ]
    conn.execute(
        f"UPDATE justificaciones SET {set_sql}, updated_at = ? WHERE id = ?",
        params,
    )
    nuevo_row = _get_justificacion_by_id(conn, justificacion_id)
    _write_audit(conn, justificacion_id=justificacion_id, accion="update",
                 snapshot=_row_to_dict(nuevo_row), diff=diff,
                 usuario=usuario_registro)
    conn.commit()
    return nuevo_row


def delete_justificacion(
    conn: sqlite3.Connection,
    *,
    justificacion_id: int,
    usuario_registro: str,
) -> None:
    actual = _get_justificacion_by_id(conn, justificacion_id)
    if actual is None:
        raise JustificacionNoExisteError(justificacion_id)

    snapshot = _row_to_dict(actual)
    conn.execute("DELETE FROM justificaciones WHERE id = ?", (justificacion_id,))
    _write_audit(conn, justificacion_id=justificacion_id, accion="delete",
                 snapshot=snapshot, diff=None, usuario=usuario_registro)
    conn.commit()


def get_justificaciones_by_persona_mes(
    conn: sqlite3.Connection, *, tecnico_nombre: str, mes: str
) -> list[sqlite3.Row]:
    """mes: 'YYYY-MM'. Devuelve filas cuya fecha cae en ese mes."""
    rows = conn.execute(
        """
        SELECT * FROM justificaciones
        WHERE tecnico_nombre = ?
          AND substr(fecha, 1, 7) = ?
        ORDER BY fecha
        """,
        (tecnico_nombre, mes),
    ).fetchall()
    return list(rows)


def get_justificacion_by_id(
    conn: sqlite3.Connection, justificacion_id: int
) -> Optional[sqlite3.Row]:
    return _get_justificacion_by_id(conn, justificacion_id)


def get_audit_by_justificacion_id(
    conn: sqlite3.Connection, justificacion_id: int
) -> list[sqlite3.Row]:
    rows = conn.execute(
        "SELECT * FROM justificaciones_audit WHERE justificacion_id = ? "
        "ORDER BY created_at, id",
        (justificacion_id,),
    ).fetchall()
    return list(rows)


# ----------------------------------------------------------------------------
# Helpers internos — Justificaciones
# ----------------------------------------------------------------------------

def _get_justificacion_by_id(
    conn: sqlite3.Connection, justificacion_id: int
) -> Optional[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM justificaciones WHERE id = ?", (justificacion_id,)
    ).fetchone()


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}


def _write_audit(
    conn: sqlite3.Connection,
    *,
    justificacion_id: int,
    accion: str,
    snapshot: dict,
    diff: Optional[dict],
    usuario: str,
) -> None:
    conn.execute(
        "INSERT INTO justificaciones_audit "
        "(justificacion_id, accion, snapshot_json, diff_json, usuario) "
        "VALUES (?, ?, ?, ?, ?)",
        (justificacion_id, accion, json.dumps(snapshot, default=str),
         json.dumps(diff, default=str) if diff is not None else None,
         usuario),
    )
