from fastapi import APIRouter, Query
from typing import Optional, List
from hashlib import md5
import pandas as pd
from app.dependencies import get_dataframe

router = APIRouter()

MESES_ORDEN = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
               'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

# Caché para filtros en cascada (máximo 64 combinaciones)
_cascade_cache: dict = {}
_cascade_cache_max = 64


def _get_cascade_key(año, mes, zona, regional, supervisor) -> str:
    """Genera clave única para caché de cascade."""
    parts = [str(año or ''), mes or '', zona or '', regional or '', supervisor or '']
    return md5('|'.join(parts).encode()).hexdigest()


def _parse_list_param(param: Optional[str]) -> List[str]:
    """Convierte string separado por comas a lista."""
    if not param:
        return []
    return [x.strip() for x in param.split(',') if x.strip()]


def _apply_cascade_filter(df: pd.DataFrame, año: Optional[int], mes: Optional[str],
                          zona: Optional[str], regional: Optional[str]) -> pd.DataFrame:
    """Aplica filtros en cascada para obtener opciones disponibles."""
    mask = pd.Series([True] * len(df), index=df.index)

    if año:
        mask &= (df['año'] == año)

    if mes:
        meses = _parse_list_param(mes)
        if meses:
            meses_lower = tuple(m.lower() for m in meses)
            # Usar columna pre-computada si existe
            if 'mes_nombre_lower' in df.columns:
                mask &= df['mes_nombre_lower'].isin(meses_lower)
            else:
                mask &= df['mes_nombre'].str.lower().isin(meses_lower)

    if zona:
        zonas = _parse_list_param(zona)
        if zonas:
            mask &= df['zona'].isin(zonas)

    if regional:
        regionales = _parse_list_param(regional)
        if regionales:
            mask &= df['Regional'].isin(regionales)

    return df.loc[mask]


def _extract_unique_values(series: pd.Series, exclude: set = None, limit: int = None) -> list:
    """Extrae valores únicos de forma optimizada."""
    exclude = exclude or set()
    values = series.dropna().unique()
    result = sorted([x for x in values if x and x not in exclude])
    if limit:
        return result[:limit]
    return result


@router.get("/api/v1/filters")
def get_filters():
    df = get_dataframe()

    # Usar columna pre-computada si existe
    if 'mes_nombre_lower' in df.columns:
        meses_disponibles = df['mes_nombre_lower'].dropna().unique().tolist()
    else:
        meses_disponibles = [m.lower() for m in df['mes_nombre'].dropna().unique().tolist()]

    meses_ordenados = [m for m in MESES_ORDEN if m in meses_disponibles]

    return {
        "años": sorted([int(x) for x in df['año'].dropna().unique() if not pd.isna(x)], reverse=True),
        "meses": meses_ordenados,
        "dias": sorted([int(x) for x in df['dia'].dropna().unique() if not pd.isna(x)]),
        "zonas": _extract_unique_values(df['zona'], exclude={'No Asignados'}),
        "regionales": _extract_unique_values(df['Regional']),
        "supervisores": _extract_unique_values(df['Supervisor']),
        "estados": _extract_unique_values(df['Estado']),
        "tratamientos": _extract_unique_values(df['Tratamiento']),
        "tipos_campana": _extract_unique_values(df['Tipo de Campaña']),
        "nombres_asignados": [x for x in _extract_unique_values(df['Nombre asignado']) if 'BOT' not in x][:100],
    }


def _apply_partial_filter(df: pd.DataFrame, año: Optional[int], mes: Optional[str],
                           zona: Optional[str], regional: Optional[str],
                           exclude_field: Optional[str] = None) -> pd.DataFrame:
    """Aplica filtros excluyendo un campo específico (para calcular opciones de ese campo)."""
    mask = pd.Series([True] * len(df), index=df.index)

    if año and exclude_field != 'año':
        mask &= (df['año'] == año)

    if mes and exclude_field != 'mes':
        meses = _parse_list_param(mes)
        if meses:
            meses_lower = tuple(m.lower() for m in meses)
            if 'mes_nombre_lower' in df.columns:
                mask &= df['mes_nombre_lower'].isin(meses_lower)
            else:
                mask &= df['mes_nombre'].str.lower().isin(meses_lower)

    if zona and exclude_field != 'zona':
        zonas = _parse_list_param(zona)
        if zonas:
            mask &= df['zona'].isin(zonas)

    if regional and exclude_field != 'regional':
        regionales = _parse_list_param(regional)
        if regionales:
            mask &= df['Regional'].isin(regionales)

    return df.loc[mask]


@router.get("/api/v1/filters/cascade")
def get_cascade_filters(
    año: Optional[int] = Query(None),
    mes: Optional[str] = Query(None),
    zona: Optional[str] = Query(None),
    regional: Optional[str] = Query(None),
    supervisor: Optional[str] = Query(None),
):
    """Devuelve opciones de filtros basadas en las selecciones actuales (filtros en cascada).

    Cada campo de filtro se calcula SIN aplicar su propio filtro, permitiendo
    al usuario seleccionar múltiples valores del mismo campo.
    """
    global _cascade_cache

    # Verificar caché
    cache_key = _get_cascade_key(año, mes, zona, regional, supervisor)
    if cache_key in _cascade_cache:
        return _cascade_cache[cache_key]

    df = get_dataframe()

    # Filtro completo (para campos que no necesitan excluirse)
    filtered_df = _apply_cascade_filter(df, año, mes, zona, regional)

    # Filtros parciales para cada campo jerárquico
    # Las zonas se calculan SIN filtrar por zona (solo por año, mes, regional)
    df_for_zonas = _apply_partial_filter(df, año, mes, zona, regional, exclude_field='zona')

    # Las regionales se calculan SIN filtrar por regional (solo por año, mes, zona)
    df_for_regionales = _apply_partial_filter(df, año, mes, zona, regional, exclude_field='regional')

    # Los supervisores se calculan SIN filtrar por supervisor
    df_for_supervisores = filtered_df  # Ya no filtramos por supervisor en cascade

    # Filtrar por supervisor para técnicos
    if supervisor:
        supervisores = _parse_list_param(supervisor)
        if supervisores:
            filtered_for_tecnicos = filtered_df[filtered_df['Supervisor'].isin(supervisores)]
        else:
            filtered_for_tecnicos = filtered_df
    else:
        filtered_for_tecnicos = filtered_df

    # Meses disponibles (filtrados solo por año)
    df_for_meses = df[df['año'] == año] if año else df
    if 'mes_nombre_lower' in df_for_meses.columns:
        meses_disponibles = df_for_meses['mes_nombre_lower'].dropna().unique().tolist()
    else:
        meses_disponibles = [m.lower() for m in df_for_meses['mes_nombre'].dropna().unique().tolist()]

    meses_ordenados = [m for m in MESES_ORDEN if m in meses_disponibles]

    # Meses globales (sin filtrar por año)
    if 'mes_nombre_lower' in df.columns:
        meses_globales = df['mes_nombre_lower'].dropna().unique().tolist()
    else:
        meses_globales = [m.lower() for m in df['mes_nombre'].dropna().unique().tolist()]

    result = {
        "años": sorted([int(x) for x in df['año'].dropna().unique() if not pd.isna(x)], reverse=True),
        "meses": meses_ordenados if año else [m for m in MESES_ORDEN if m in meses_globales],
        "dias": sorted([int(x) for x in filtered_df['dia'].dropna().unique() if not pd.isna(x)]),
        "zonas": _extract_unique_values(df_for_zonas['zona'], exclude={'No Asignados'}),
        "regionales": _extract_unique_values(df_for_regionales['Regional']),
        "supervisores": _extract_unique_values(df_for_supervisores['Supervisor']),
        "estados": _extract_unique_values(filtered_df['Estado']),
        "tratamientos": _extract_unique_values(filtered_df['Tratamiento']),
        "tipos_campana": _extract_unique_values(filtered_df['Tipo de Campaña']),
        "nombres_asignados": [x for x in _extract_unique_values(filtered_for_tecnicos['Nombre asignado']) if 'BOT' not in x][:200],
    }

    # Guardar en caché
    if len(_cascade_cache) >= _cascade_cache_max:
        # Eliminar la mitad más antigua
        keys_to_remove = list(_cascade_cache.keys())[:_cascade_cache_max // 2]
        for k in keys_to_remove:
            del _cascade_cache[k]

    _cascade_cache[cache_key] = result
    return result


def clear_cascade_cache():
    """Limpia el caché de filtros en cascada."""
    global _cascade_cache
    _cascade_cache = {}
