from fastapi import APIRouter, Depends
from app.dependencies import get_dataframe, apply_filters
from app.models.filters import FilterParams
from app.services.kpis import calculate_kpis
from app.services.zonas import calculate_zonas
from app.services.daily import calculate_daily
from app.services.mensual import calculate_mensual
from app.services.tecnicos import calculate_tecnicos
from app.services.campanas import calculate_campanas
from app.services.normalizaciones import calculate_normalizaciones
from app.services.visitas_fallidas import calculate_visitas_fallidas
from app.services.produccion import calculate_produccion
from app.services.resultados_fallidos import calculate_resultados_fallidos

router = APIRouter()


@router.get("/api/v1/dashboard")
def get_dashboard(params: FilterParams = Depends()):
    df = get_dataframe()
    filtered = apply_filters(df, params)

    return {
        "kpis": calculate_kpis(filtered),
        "zonas": calculate_zonas(filtered),
        "daily": calculate_daily(filtered),
        "mensual": calculate_mensual(filtered),
        "tecnicos": calculate_tecnicos(filtered),
        "campanas": calculate_campanas(filtered),
        "normalizaciones": calculate_normalizaciones(filtered),
        "visitas_fallidas_responsabilidad": calculate_visitas_fallidas(filtered),
        "produccion": calculate_produccion(filtered),
        "resultados_fallidos": calculate_resultados_fallidos(filtered),
    }
