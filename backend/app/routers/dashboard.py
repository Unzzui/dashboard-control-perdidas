from fastapi import APIRouter, Depends
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

router = APIRouter()


@router.get("/api/v1/dashboard")
def get_dashboard(params: FilterParams = Depends()):
    df = get_dataframe()
    filtered = apply_filters(df, params)

    return {
        "kpis": calculate_kpis(filtered),
        "zonas": calculate_zonas(filtered),
        "daily": calculate_daily(filtered),
        "daily_por_zona": calculate_daily_por_zona(filtered),
        "mensual": calculate_mensual(filtered),
        "tecnicos": calculate_tecnicos(filtered),
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
def get_pago_tecnicos(params: FilterParams = Depends()):
    """Cálculo de pago mensual por técnico (OCA GLOBAL / 1F)."""
    df = get_dataframe()
    filtered = apply_filters(df, params)
    return calculate_pago_tecnicos(filtered)


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
