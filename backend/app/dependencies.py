import pandas as pd
from app.config import DATA_PATH, MESES_MAP
from app.models.filters import FilterParams

df_global: pd.DataFrame = None


def get_dataframe() -> pd.DataFrame:
    global df_global
    if df_global is None:
        df_global = pd.read_parquet(DATA_PATH)
        df_global['Fecha ejecución'] = pd.to_datetime(df_global['Fecha ejecución'], errors='coerce')
        df_global['año'] = df_global['Fecha ejecución'].dt.year
        df_global['mes'] = df_global['Fecha ejecución'].dt.month
        df_global['mes_nombre'] = df_global['mes'].map(MESES_MAP)
        df_global['dia'] = df_global['Fecha ejecución'].dt.day
        df_global['resultado_clasificado'] = df_global['Resultado visita'].apply(
            lambda x: 'Normal' if x == 'Normal' else (
                'CNR' if x == 'CNR' else (
                    'Visita fallida' if x == 'Visita fallida' else 'Otro'
                )
            )
        )
    return df_global


def apply_filters(df: pd.DataFrame, params: FilterParams) -> pd.DataFrame:
    filtered = df.copy()
    if params.año:
        filtered = filtered[filtered['año'] == params.año]
    if params.mes:
        filtered = filtered[filtered['mes_nombre'].str.lower() == params.mes.lower()]
    if params.dia:
        filtered = filtered[filtered['dia'] == params.dia]
    if params.zona:
        filtered = filtered[filtered['zona'] == params.zona]
    if params.regional:
        filtered = filtered[filtered['Regional'] == params.regional]
    if params.supervisor:
        filtered = filtered[filtered['Supervisor'] == params.supervisor]
    if params.estado:
        filtered = filtered[filtered['Estado'] == params.estado]
    if params.tratamiento:
        filtered = filtered[filtered['Tratamiento'] == params.tratamiento]
    if params.tipo_campana:
        filtered = filtered[filtered['Tipo de Campaña'] == params.tipo_campana]
    if params.nombre_asignado:
        filtered = filtered[filtered['Nombre asignado'] == params.nombre_asignado]
    return filtered
