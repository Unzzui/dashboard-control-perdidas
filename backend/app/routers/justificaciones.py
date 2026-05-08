# backend/app/routers/justificaciones.py
import json
import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.dependencies import apply_filters, get_dataframe
from app.models.filters import FilterParams
from app.services.detalle_tecnico import calculate_detalle_tecnico_diario
from app.services.justificaciones import repository as repo
from app.services.justificaciones import service
from app.services.justificaciones.catalogos import get_catalogos
from app.services.justificaciones.db import get_conn
from app.config import EFECTIVAS_POR_DIA, FERIADOS_CL, MESES_MAP

router = APIRouter()


def get_conn_dep() -> sqlite3.Connection:
    conn = get_conn()
    try:
        yield conn
    finally:
        conn.close()


# ============================================================================
# Schemas
# ============================================================================

class JustificacionCreate(BaseModel):
    fecha: str
    tecnico_nombre: str
    zona_origen: Optional[str] = None
    motivo: str
    comentario: Optional[str] = None
    produccion_real: int = Field(..., ge=0)
    meta_diaria: int = Field(..., gt=0)
    es_futuro: bool = False
    usuario_registro: str


class JustificacionUpdate(BaseModel):
    motivo: Optional[str] = None
    comentario: Optional[str] = None
    usuario_registro: str


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}


# ============================================================================
# Endpoints CRUD
# ============================================================================

@router.get("/api/v1/justificaciones/catalogos")
def catalogos():
    return get_catalogos()


@router.post("/api/v1/justificaciones", status_code=201)
def create_justificacion(
    payload: JustificacionCreate,
    conn: sqlite3.Connection = Depends(get_conn_dep),
):
    try:
        row = service.crear_justificacion(
            conn,
            fecha=payload.fecha,
            tecnico_nombre=payload.tecnico_nombre,
            zona_origen=payload.zona_origen,
            produccion_real=payload.produccion_real,
            meta_diaria=payload.meta_diaria,
            motivo=payload.motivo,
            comentario=payload.comentario,
            usuario_registro=payload.usuario_registro,
            es_futuro=payload.es_futuro,
        )
    except repo.JustificacionDuplicadaError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Ya existe justificación para esa fecha",
                "id_existente": exc.id_existente,
            },
        )
    except service.JustificacionValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return _row_to_dict(row)


@router.patch("/api/v1/justificaciones/{jid}")
def update_justificacion(
    jid: int,
    payload: JustificacionUpdate,
    conn: sqlite3.Connection = Depends(get_conn_dep),
):
    cambios = {k: v for k, v in payload.model_dump(exclude={"usuario_registro"}).items()
               if v is not None}
    try:
        row = service.actualizar_justificacion(
            conn, justificacion_id=jid, cambios=cambios,
            usuario_registro=payload.usuario_registro,
        )
    except repo.JustificacionNoExisteError:
        raise HTTPException(status_code=404, detail="Justificación no existe")
    except service.JustificacionValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return _row_to_dict(row)


@router.delete("/api/v1/justificaciones/{jid}", status_code=204)
def delete_justificacion(
    jid: int,
    usuario_registro: str = Query(..., min_length=1),
    conn: sqlite3.Connection = Depends(get_conn_dep),
):
    try:
        service.eliminar_justificacion(
            conn, justificacion_id=jid, usuario_registro=usuario_registro
        )
    except repo.JustificacionNoExisteError:
        raise HTTPException(status_code=404, detail="Justificación no existe")
    except service.AnalistaInactivoError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/api/v1/justificaciones/persona/{tecnico_nombre}")
def get_justificaciones_persona(
    tecnico_nombre: str,
    mes: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    conn: sqlite3.Connection = Depends(get_conn_dep),
):
    rows = repo.get_justificaciones_by_persona_mes(
        conn, tecnico_nombre=tecnico_nombre, mes=mes
    )
    return {
        "tecnico_nombre": tecnico_nombre,
        "mes": mes,
        "justificaciones": [_row_to_dict(r) for r in rows],
    }


@router.get("/api/v1/justificaciones/persona/{tecnico_nombre}/resumen")
def get_resumen_persona(
    tecnico_nombre: str,
    mes: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    params: FilterParams = Depends(),
    conn: sqlite3.Connection = Depends(get_conn_dep),
):
    año, mes_num = (int(x) for x in mes.split("-"))
    # El período del resumen lo define el path `mes` (YYYY-MM). Sobrescribimos los
    # filtros temporales globales para que apply_filters use el mes correcto y no
    # colisione con el query param `mes` que comparte nombre con el path.
    params.año = año
    params.mes = MESES_MAP[mes_num]
    params.dia = None

    df = get_dataframe()
    filtered = apply_filters(df, params)
    cal = calculate_detalle_tecnico_diario(filtered, tecnico_nombre, None)

    feriados = FERIADOS_CL.get(año, set())
    import calendar as cal_mod
    _, dias_en_mes = cal_mod.monthrange(año, mes_num)
    dias_habiles = sum(
        1 for d in range(1, dias_en_mes + 1)
        if cal_mod.weekday(año, mes_num, d) < 5 and (mes_num, d) not in feriados
    )

    return service.calcular_resumen(
        conn,
        tecnico_nombre=tecnico_nombre,
        mes=mes,
        calendario_data=cal,
        meta_diaria=EFECTIVAS_POR_DIA,
        dias_habiles_mes=dias_habiles,
    )


@router.get("/api/v1/justificaciones/{jid}/audit")
def get_audit(jid: int, conn: sqlite3.Connection = Depends(get_conn_dep)):
    rows = repo.get_audit_by_justificacion_id(conn, jid)
    return {
        "justificacion_id": jid,
        "audit": [
            {
                "accion": r["accion"],
                "snapshot_json": json.loads(r["snapshot_json"]),
                "diff_json": json.loads(r["diff_json"]) if r["diff_json"] else None,
                "usuario": r["usuario"],
                "created_at": r["created_at"],
            }
            for r in rows
        ],
    }
