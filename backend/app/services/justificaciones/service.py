"""
Lógica de dominio para justificaciones.
Aplica validaciones, infiere campos derivados, escribe audit a través del repository.
"""
import sqlite3
from datetime import datetime
from typing import Optional

from app.config import (
    EFECTIVAS_POR_DIA,
    FERIADOS_CL,
    MOTIVOS_BAJA_PRODUCCION,
    MOTIVOS_NO_TRABAJADO,
    UMBRAL_BAJA_PRODUCCION,
)
from app.services.justificaciones import repository as repo


# ============================================================================
# Excepciones de validación
# ============================================================================

class JustificacionValidationError(Exception):
    """Base para errores de validación de dominio."""


class MotivoInvalidoError(JustificacionValidationError):
    """El motivo no pertenece al catálogo del tipo_evento."""


class ComentarioRequeridoError(JustificacionValidationError):
    """Comentario obligatorio (>=10 chars) cuando motivo == 'otro'."""


class AnalistaInactivoError(JustificacionValidationError):
    """El analista no existe o está inactivo."""


class FechaNoReportableError(JustificacionValidationError):
    """Fin de semana o feriado: no es día reportable."""


class TipoEventoNoCalculableError(JustificacionValidationError):
    """produccion_real está fuera del rango justificable."""


# ============================================================================
# API pública
# ============================================================================

def crear_justificacion(
    conn: sqlite3.Connection,
    *,
    fecha: str,
    tecnico_nombre: str,
    zona_origen: Optional[str],
    produccion_real: int,
    meta_diaria: int,
    motivo: str,
    comentario: Optional[str],
    usuario_registro: str,
    es_futuro: bool,
) -> sqlite3.Row:
    _validar_fecha_reportable(fecha)
    _validar_analista_activo(conn, usuario_registro)
    tipo_evento = _inferir_tipo_evento(produccion_real, meta_diaria)
    estado_antes = "sin_trabajo" if tipo_evento == "dia_no_trabajado" else "baja_produccion"
    _validar_motivo(motivo, tipo_evento)
    _validar_comentario_si_otro(motivo, comentario)

    return repo.create_justificacion(
        conn,
        fecha=fecha,
        tecnico_nombre=tecnico_nombre,
        zona_origen=zona_origen,
        tipo_evento=tipo_evento,
        motivo=motivo,
        comentario=comentario,
        produccion_real=produccion_real,
        meta_diaria=meta_diaria,
        estado_antes=estado_antes,
        es_futuro=es_futuro,
        usuario_registro=usuario_registro,
    )


def actualizar_justificacion(
    conn: sqlite3.Connection,
    *,
    justificacion_id: int,
    cambios: dict,
    usuario_registro: str,
) -> sqlite3.Row:
    _validar_analista_activo(conn, usuario_registro)
    actual = repo.get_justificacion_by_id(conn, justificacion_id)
    if actual is None:
        raise repo.JustificacionNoExisteError(justificacion_id)

    nuevo_motivo = cambios.get("motivo", actual["motivo"])
    nuevo_comentario = cambios.get("comentario", actual["comentario"])
    _validar_motivo(nuevo_motivo, actual["tipo_evento"])
    _validar_comentario_si_otro(nuevo_motivo, nuevo_comentario)

    return repo.update_justificacion(
        conn,
        justificacion_id=justificacion_id,
        cambios=cambios,
        usuario_registro=usuario_registro,
    )


def eliminar_justificacion(
    conn: sqlite3.Connection,
    *,
    justificacion_id: int,
    usuario_registro: str,
) -> None:
    _validar_analista_activo(conn, usuario_registro)
    repo.delete_justificacion(
        conn, justificacion_id=justificacion_id, usuario_registro=usuario_registro
    )


# ============================================================================
# Validaciones internas
# ============================================================================

def _inferir_tipo_evento(produccion_real: int, meta_diaria: int) -> str:
    umbral = UMBRAL_BAJA_PRODUCCION * meta_diaria
    if produccion_real == 0:
        return "dia_no_trabajado"
    if 0 < produccion_real < umbral:
        return "baja_produccion"
    raise TipoEventoNoCalculableError(
        f"produccion_real={produccion_real} no es justificable "
        f"(meta={meta_diaria}, umbral={umbral})"
    )


def _validar_motivo(motivo: str, tipo_evento: str) -> None:
    catalogo = (
        MOTIVOS_NO_TRABAJADO if tipo_evento == "dia_no_trabajado"
        else MOTIVOS_BAJA_PRODUCCION
    )
    if motivo not in catalogo:
        raise MotivoInvalidoError(
            f"motivo='{motivo}' no aplica a tipo_evento='{tipo_evento}'"
        )


def _validar_comentario_si_otro(motivo: str, comentario: Optional[str]) -> None:
    if motivo != "otro":
        return
    if not comentario or len(comentario.strip()) < 10:
        raise ComentarioRequeridoError(
            "Cuando motivo='otro', el comentario es obligatorio (min 10 chars)"
        )


def _validar_analista_activo(conn: sqlite3.Connection, nombre: str) -> None:
    a = repo.get_analista_by_nombre(conn, nombre)
    if a is None or a["activo"] != 1:
        raise AnalistaInactivoError(f"analista '{nombre}' no existe o esta inactivo")


def _validar_fecha_reportable(fecha_str: str) -> None:
    fecha = datetime.strptime(fecha_str, "%Y-%m-%d").date()
    if fecha.weekday() >= 5:
        raise FechaNoReportableError(f"{fecha_str} es fin de semana")
    feriados_año = FERIADOS_CL.get(fecha.year, set())
    if (fecha.month, fecha.day) in feriados_año:
        raise FechaNoReportableError(f"{fecha_str} es feriado oficial")
