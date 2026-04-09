from fastapi import APIRouter, Depends
from app.dependencies import get_dataframe, apply_filters
from app.models.filters import FilterParams
from app.services.retiro_medidores import calculate_retiro_medidores

router = APIRouter()


@router.get("/api/v1/retiro-medidores")
def get_retiro_medidores(params: FilterParams = Depends()):
    df = get_dataframe()
    filtered = apply_filters(df, params)
    return calculate_retiro_medidores(filtered)
