import pandas as pd
from functools import lru_cache
from hashlib import md5
from app.config import DATA_PATH, MESES_MAP
from app.models.filters import FilterParams

df_global: pd.DataFrame = None


def get_dataframe() -> pd.DataFrame:
    global df_global
    if df_global is None:
        df_global = pd.read_parquet(DATA_PATH)

        # Convertir fechas
        df_global['Fecha ejecución'] = pd.to_datetime(df_global['Fecha ejecución'], errors='coerce')
        df_global['año'] = df_global['Fecha ejecución'].dt.year.astype('Int16')
        df_global['mes'] = df_global['Fecha ejecución'].dt.month.astype('Int8')
        df_global['mes_nombre'] = df_global['mes'].map(MESES_MAP)
        df_global['dia'] = df_global['Fecha ejecución'].dt.day.astype('Int8')

        # Pre-computar fecha como date para filtros más rápidos
        df_global['fecha_date'] = df_global['Fecha ejecución'].dt.date

        # Pre-computar máscara de fechas válidas
        df_global['tiene_fecha'] = df_global['Fecha ejecución'].notna()

        # Pre-computar lowercase para filtros más rápidos
        df_global['mes_nombre_lower'] = df_global['mes_nombre'].str.lower()

        # Pre-computar si es BOT
        df_global['es_bot'] = df_global['Nombre asignado'].str.contains('BOT', na=False)

        # Validar horas de forma vectorizada (para control diario)
        if 'Hora inicio' in df_global.columns:
            df_global['hora_inicio_valida'] = df_global['Hora inicio'].str.match(r'^\d{1,2}:\d{2}$', na=False)
        if 'Hora fin' in df_global.columns:
            df_global['hora_fin_valida'] = df_global['Hora fin'].str.match(r'^\d{1,2}:\d{2}$', na=False)

        # Clasificación de resultados usando map (más rápido que apply)
        resultado_map = {
            'Normal': 'Normal',
            'CNR': 'CNR',
            'Visita fallida': 'Visita fallida'
        }
        df_global['resultado_clasificado'] = df_global['Resultado visita'].map(resultado_map).fillna('Otro')

        # Convertir columnas de texto a categorías para menor uso de memoria
        cat_columns = ['zona', 'Regional', 'Supervisor', 'Estado', 'Tratamiento',
                       'Tipo de Campaña', 'Resultado visita', 'resultado_clasificado']
        for col in cat_columns:
            if col in df_global.columns:
                df_global[col] = df_global[col].astype('category')

    return df_global


def _parse_list_param(value: str) -> tuple:
    """Convierte un parámetro separado por comas en una tupla (hasheable para caché)."""
    if not value:
        return ()
    return tuple(v.strip() for v in value.split(',') if v.strip())


def _get_filter_key(params: FilterParams) -> str:
    """Genera una clave única para los filtros (para caché)."""
    key_parts = [
        str(params.año or ''),
        params.mes or '',
        str(params.dia or ''),
        params.zona or '',
        params.regional or '',
        params.supervisor or '',
        params.estado or '',
        params.tratamiento or '',
        params.tipo_campana or '',
        params.nombre_asignado or '',
    ]
    return md5('|'.join(key_parts).encode()).hexdigest()


# Caché de filtros (máximo 32 combinaciones)
_filter_cache: dict = {}
_cache_max_size = 32


def apply_filters(df: pd.DataFrame, params: FilterParams) -> pd.DataFrame:
    global _filter_cache

    # Verificar caché
    cache_key = _get_filter_key(params)
    if cache_key in _filter_cache:
        return _filter_cache[cache_key]

    # Construir máscara booleana (más eficiente que filtrar secuencialmente)
    mask = pd.Series([True] * len(df), index=df.index)

    if params.año:
        mask &= (df['año'] == params.año)

    if params.mes:
        meses = _parse_list_param(params.mes)
        if meses:
            meses_lower = tuple(m.lower() for m in meses)
            mask &= df['mes_nombre_lower'].isin(meses_lower)

    if params.dia:
        mask &= (df['dia'] == params.dia)

    if params.zona:
        zonas = _parse_list_param(params.zona)
        if zonas:
            mask &= df['zona'].isin(zonas)

    if params.regional:
        regionales = _parse_list_param(params.regional)
        if regionales:
            mask &= df['Regional'].isin(regionales)

    if params.supervisor:
        supervisores = _parse_list_param(params.supervisor)
        if supervisores:
            mask &= df['Supervisor'].isin(supervisores)

    if params.estado:
        estados = _parse_list_param(params.estado)
        if estados:
            mask &= df['Estado'].isin(estados)

    if params.tratamiento:
        tratamientos = _parse_list_param(params.tratamiento)
        if tratamientos:
            mask &= df['Tratamiento'].isin(tratamientos)

    if params.tipo_campana:
        tipos = _parse_list_param(params.tipo_campana)
        if tipos:
            mask &= df['Tipo de Campaña'].isin(tipos)

    if params.nombre_asignado:
        nombres = _parse_list_param(params.nombre_asignado)
        if nombres:
            mask &= df['Nombre asignado'].isin(nombres)

    # Aplicar máscara (sin copy - usa vista)
    filtered = df.loc[mask]

    # Guardar en caché (limpiar si es muy grande)
    if len(_filter_cache) >= _cache_max_size:
        # Eliminar la mitad más antigua
        keys_to_remove = list(_filter_cache.keys())[:_cache_max_size // 2]
        for k in keys_to_remove:
            del _filter_cache[k]

    _filter_cache[cache_key] = filtered

    return filtered


def clear_filter_cache():
    """Limpia el caché de filtros."""
    global _filter_cache
    _filter_cache = {}
