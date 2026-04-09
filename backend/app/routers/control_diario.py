from fastapi import APIRouter, Depends
from app.dependencies import get_dataframe, apply_filters
from app.models.filters import FilterParams
from app.services.control_diario import calculate_control_diario

router = APIRouter()


@router.get("/api/v1/control-diario")
def get_control_diario(params: FilterParams = Depends()):
    df = get_dataframe()
    filtered = apply_filters(df, params)
    # Pasar el día específico si está en los filtros
    return calculate_control_diario(filtered, dia_especifico=params.dia)
