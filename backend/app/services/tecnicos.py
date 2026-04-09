import pandas as pd


def calculate_tecnicos(filtered: pd.DataFrame) -> list:
    tecnicos_data = []
    ejecutores = filtered[~filtered['Nombre asignado'].str.contains('BOT', na=False)]
    for zona_name in ejecutores['zona'].dropna().unique():
        if zona_name == 'No Asignados':
            continue
        zona_df = ejecutores[ejecutores['zona'] == zona_name]
        for nombre in zona_df['Nombre asignado'].dropna().unique():
            tecnico_df = zona_df[zona_df['Nombre asignado'] == nombre]
            t_resultado = tecnico_df['Resultado visita'].value_counts()
            t_cnr = int(t_resultado.get('CNR', 0))
            t_normal = int(t_resultado.get('Normal', 0))
            t_efectivas = t_cnr + t_normal
            dias_trabajados = tecnico_df['Fecha ejecución'].dt.date.nunique()
            dias_trabajados = max(dias_trabajados, 1)
            tecnicos_data.append({
                "zona": zona_name,
                "nombre": nombre,
                "cnr": t_cnr,
                "promedio_cnr": t_cnr / dias_trabajados,
                "efectivas": t_efectivas,
                "promedio_efectivas": t_efectivas / dias_trabajados,
            })
    tecnicos_data = sorted(tecnicos_data, key=lambda x: x['cnr'], reverse=True)[:50]
    return tecnicos_data
