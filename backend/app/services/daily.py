import pandas as pd


def calculate_daily(filtered: pd.DataFrame) -> list:
    daily_data = []
    if 'Fecha ejecución' in filtered.columns:
        daily_df = filtered.dropna(subset=['Fecha ejecución']).copy()
        daily_df['fecha_str'] = daily_df['Fecha ejecución'].dt.strftime('%Y-%m-%d')
        for fecha in daily_df['fecha_str'].unique():
            fecha_df = daily_df[daily_df['fecha_str'] == fecha]
            d_resultado = fecha_df['Resultado visita'].value_counts()
            daily_data.append({
                "fecha": fecha,
                "dia": int(pd.to_datetime(fecha).day),
                "cnr": int(d_resultado.get('CNR', 0)),
                "normal": int(d_resultado.get('Normal', 0)),
                "visita_fallida": int(d_resultado.get('Visita fallida', 0)),
            })
        daily_data = sorted(daily_data, key=lambda x: x['fecha'])[-30:]
    return daily_data


def calculate_daily_por_zona(filtered: pd.DataFrame) -> dict:
    """
    Calcula estadísticas diarias agrupadas por zona.
    Retorna un diccionario donde cada clave es una zona y el valor es una lista de días.
    """
    result = {}

    if 'Fecha ejecución' not in filtered.columns or 'zona' not in filtered.columns:
        return result

    daily_df = filtered.dropna(subset=['Fecha ejecución']).copy()

    # Excluir "No Asignados"
    daily_df = daily_df[daily_df['zona'] != 'No Asignados']

    if daily_df.empty:
        return result

    daily_df['fecha_str'] = daily_df['Fecha ejecución'].dt.strftime('%Y-%m-%d')

    # Agrupar por zona y fecha
    for zona in daily_df['zona'].unique():
        zona_df = daily_df[daily_df['zona'] == zona]
        zona_data = []

        for fecha in zona_df['fecha_str'].unique():
            fecha_df = zona_df[zona_df['fecha_str'] == fecha]
            d_resultado = fecha_df['Resultado visita'].value_counts()
            zona_data.append({
                "fecha": fecha,
                "dia": int(pd.to_datetime(fecha).day),
                "cnr": int(d_resultado.get('CNR', 0)),
                "normal": int(d_resultado.get('Normal', 0)),
                "visita_fallida": int(d_resultado.get('Visita fallida', 0)),
            })

        # Ordenar por fecha y tomar últimos 30 días
        zona_data = sorted(zona_data, key=lambda x: x['fecha'])[-30:]
        result[zona] = zona_data

    return result
