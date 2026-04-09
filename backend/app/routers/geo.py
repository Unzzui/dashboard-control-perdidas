from fastapi import APIRouter, Query
from typing import Optional
from app.dependencies import get_dataframe, apply_filters
from app.models.filters import FilterParams
from app.services.geo import calculate_geo

router = APIRouter()


@router.get("/api/v1/geo")
def get_geo_data(
    año: Optional[int] = Query(None),
    mes: Optional[str] = Query(None),
    zona: Optional[str] = Query(None),
    limit: int = Query(1000),
):
    df = get_dataframe()
    params = FilterParams(año=año, mes=mes, zona=zona)
    filtered = apply_filters(df, params)
    return {"points": calculate_geo(filtered, limit)}
