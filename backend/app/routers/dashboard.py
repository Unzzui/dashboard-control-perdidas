from typing import Optional
import pandas as pd
from fastapi import APIRouter, Depends, Query
from app.dependencies import get_dataframe, apply_filters
from app.models.filters import FilterParams
from app.services.kpis import calculate_kpis
from app.services.zonas import calculate_zonas
from app.services.daily import calculate_daily, calculate_daily_por_zona
from app.services.mensual import calculate_mensual
from app.services.tecnicos import calculate_tecnicos
from app.services.campanas import calculate_campanas
from app.services.normalizaciones import calculate_normalizaciones
from app.services.visitas_fallidas import calculate_visitas_fallidas
from app.services.produccion import calculate_produccion
from app.services.pago_tecnicos import calculate_pago_tecnicos
from app.services.resultados_fallidos import calculate_resultados_fallidos, calculate_resultados_fallidos_por_zona
from app.services.analisis_comparativo import calculate_analisis_comparativo
from app.services.alertas_operativas import calculate_alertas_operativas
from app.services.calendario_mes import build_calendario_mes
from app.services.promedio_efectivas import calculate_promedio_efectivas

router = APIRouter()


@router.get("/api/v1/dashboard")
def get_dashboard(params: FilterParams = Depends()):
    df = get_dataframe()
    filtered = apply_filters(df, params)

    kpis = calculate_kpis(filtered)
    tecnicos = calculate_tecnicos(filtered)

    # Single source of truth para "promedio efectivas/día" (alineado con Control Metas).
    # Se inyecta dentro de kpis para que cualquier vista lo consuma desde un solo lugar.
    kpis.update(
        calculate_promedio_efectivas(tecnicos, kpis.get("total_visita_fallida_cge", 0))
    )

    return {
        "kpis": kpis,
        "zonas": calculate_zonas(filtered),
        "daily": calculate_daily(filtered),
        "daily_por_zona": calculate_daily_por_zona(filtered),
        "mensual": calculate_mensual(filtered),
        "tecnicos": tecnicos,
        "campanas": calculate_campanas(filtered),
        "normalizaciones": calculate_normalizaciones(filtered),
        "visitas_fallidas_responsabilidad": calculate_visitas_fallidas(filtered),
        "produccion": calculate_produccion(filtered),
        "pago_tecnicos": calculate_pago_tecnicos(filtered),
        "calendario_mes": build_calendario_mes(filtered),
        "resultados_fallidos": calculate_resultados_fallidos(filtered),
        "resultados_fallidos_por_zona": calculate_resultados_fallidos_por_zona(filtered),
    }


@router.get("/api/v1/produccion/pago-tecnicos")
def get_pago_tecnicos(
    dia_max: Optional[int] = Query(
        None,
        ge=1,
        le=31,
        description="Si se entrega, recorta el dataframe a inspecciones con día <= dia_max "
                    "(útil para ver el cierre EDP CGE del 25).",
    ),
    params: FilterParams = Depends(),
):
    """Cálculo de pago mensual por técnico (OCA GLOBAL / 1F)."""
    df = get_dataframe()
    filtered = apply_filters(df, params)
    if dia_max is not None and "Fecha ejecución" in filtered.columns:
        filtered = filtered[filtered["Fecha ejecución"].dt.day <= dia_max]
    return calculate_pago_tecnicos(filtered)


@router.get("/api/v1/produccion/raw")
def get_pago_raw(
    dia_max: Optional[int] = Query(
        None,
        ge=1,
        le=31,
        description="Recorta el dataframe a inspecciones con día <= dia_max.",
    ),
    params: FilterParams = Depends(),
):
    """
    Devuelve las filas crudas del parquet correspondientes al filtro actual
    (con columnas relevantes para auditoría). Pensado para volcar a una
    hoja Raw del Excel y permitir cruces manuales.
    """
    df = get_dataframe()
    filtered = apply_filters(df, params)
    if dia_max is not None and "Fecha ejecución" in filtered.columns:
        filtered = filtered[filtered["Fecha ejecución"].dt.day <= dia_max]

    cols = [
        "Fecha ejecución", "Nombre asignado",
        "zona_tecnico", "regional_tecnico",
        "zona_inspeccion", "regional_inspeccion",
        "Comuna", "Dirección Servicio",
        "Aviso", "ID Medida",
        "Resultado visita", "Resultado final", "Tipo_CNR.Tipo de CNR",
        "Hora inicio", "Hora fin",
        "kWh CNR",
        "Supervisor", "Estado", "Tratamiento", "Tipo de Campaña",
    ]
    cols_present = [c for c in cols if c in filtered.columns]
    out = filtered[cols_present].copy()

    if "Fecha ejecución" in out.columns:
        out["Fecha ejecución"] = pd.to_datetime(
            out["Fecha ejecución"], errors="coerce"
        ).dt.strftime("%Y-%m-%d")

    out = out.where(pd.notna(out), None)
    return {
        "total": len(out),
        "dia_max": dia_max,
        "columnas": cols_present,
        "rows": out.to_dict(orient="records"),
    }


@router.get("/api/v1/analisis-comparativo")
def get_analisis_comparativo(params: FilterParams = Depends()):
    """
    Endpoint para análisis comparativo real entre dos períodos.
    Compara métricas de zonas y técnicos entre período actual y anterior.
    """
    df = get_dataframe()
    filtered = apply_filters(df, params)

    # Extraer año y meses de los parámetros
    año = params.año if params.año else 2026
    meses = params.mes if params.mes else []

    return calculate_analisis_comparativo(filtered, año, meses)


@router.get("/api/v1/alertas-operativas")
def get_alertas_operativas(params: FilterParams = Depends()):
    """
    Endpoint para alertas operativas diarias.
    Identifica técnicos inactivos, metas no cumplidas, problemas de jornada, etc.
    """
    df = get_dataframe()
    filtered = apply_filters(df, params)

    # Extraer año y meses de los parámetros
    año = params.año if params.año else 2026
    meses = params.mes if params.mes else []

    return calculate_alertas_operativas(filtered, año, meses)
