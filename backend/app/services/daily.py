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
