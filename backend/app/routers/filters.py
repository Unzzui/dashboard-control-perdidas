from fastapi import APIRouter
import pandas as pd
from app.dependencies import get_dataframe

router = APIRouter()


@router.get("/api/v1/filters")
def get_filters():
    df = get_dataframe()
    meses_orden = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    meses_disponibles = df['mes_nombre'].dropna().unique().tolist()
    meses_ordenados = [m for m in meses_orden if m in [x.lower() for x in meses_disponibles]]
    return {
        "años": sorted([int(x) for x in df['año'].dropna().unique() if not pd.isna(x)], reverse=True),
        "meses": meses_ordenados,
        "dias": sorted([int(x) for x in df['dia'].dropna().unique() if not pd.isna(x)]),
        "zonas": sorted([x for x in df['zona'].dropna().unique() if x and x != 'No Asignados']),
        "regionales": sorted([x for x in df['Regional'].dropna().unique() if x]),
        "supervisores": sorted([x for x in df['Supervisor'].dropna().unique() if x]),
        "estados": sorted([x for x in df['Estado'].dropna().unique() if x]),
        "tratamientos": sorted([x for x in df['Tratamiento'].dropna().unique() if x]),
        "tipos_campana": sorted([x for x in df['Tipo de Campaña'].dropna().unique() if x]),
        "nombres_asignados": sorted([x for x in df['Nombre asignado'].dropna().unique() if x and 'BOT' not in x])[:100],
    }
