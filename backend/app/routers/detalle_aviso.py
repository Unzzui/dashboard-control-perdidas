from fastapi import APIRouter, Depends, Query
from app.dependencies import get_dataframe, apply_filters
from app.models.filters import FilterParams
from app.services.detalle_aviso import calculate_detalle_aviso

router = APIRouter()


@router.get("/api/v1/detalle-aviso")
def get_detalle_aviso(
    params: FilterParams = Depends(),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=200),
):
    df = get_dataframe()
    filtered = apply_filters(df, params)
    return calculate_detalle_aviso(filtered, page=page, page_size=page_size)
