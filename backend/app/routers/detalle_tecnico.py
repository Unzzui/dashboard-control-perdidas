from fastapi import APIRouter, Depends, Query
from app.dependencies import get_dataframe, apply_filters
from app.models.filters import FilterParams
from app.services.detalle_tecnico import calculate_detalle_tecnico_diario, get_inspecciones_dia

router = APIRouter()


@router.get("/api/v1/tecnicos/detalle-diario")
def get_detalle_tecnico_diario(
    nombre: str = Query(..., description="Nombre del técnico"),
    zona: str = Query(None, description="Zona donde trabajó (zona_inspeccion). Si es None o 'TODAS', muestra consolidado de todas las zonas"),
    params: FilterParams = Depends()
):
    """
    Obtiene el detalle diario de un técnico específico.

    - Si zona=None o zona="TODAS": Muestra el CONSOLIDADO de todo el trabajo del técnico
      en todas las zonas, incluyendo un desglose por zona.
    - Si zona es específica: Muestra solo el trabajo realizado en esa zona.

    El response incluye:
    - dias: Detalle diario consolidado o filtrado
    - desglose_zonas: Tabla con métricas por cada zona donde trabajó
    - calendario: Vista mensual de asistencia
    - es_consolidado: True si muestra todas las zonas
    """
    df = get_dataframe()
    filtered = apply_filters(df, params)
    return calculate_detalle_tecnico_diario(filtered, nombre, zona)


@router.get("/api/v1/tecnicos/inspecciones-dia")
def get_inspecciones_dia_endpoint(
    nombre: str = Query(..., description="Nombre del técnico"),
    zona: str = Query(None, description="Zona donde trabajó (zona_inspeccion). Si es None o 'TODAS', busca en todas las zonas."),
    fecha: str = Query(..., description="Fecha en formato YYYY-MM-DD"),
    params: FilterParams = Depends()
):
    """
    Obtiene el detalle de todas las inspecciones de un técnico en un día específico.

    - Si zona=None o "TODAS": Busca inspecciones en TODAS las zonas donde trabajó
    - Si zona es específica: Busca solo en esa zona

    Útil para técnicos multi-zona donde el consolidado muestra trabajo en varias zonas.
    """
    df = get_dataframe()
    filtered = apply_filters(df, params)
    return get_inspecciones_dia(filtered, nombre, zona, fecha)
