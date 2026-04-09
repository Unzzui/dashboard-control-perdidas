import pandas as pd


def calculate_zonas(filtered: pd.DataFrame) -> list:
    zonas_data = []
    zonas_filtered = filtered[filtered['zona'] != 'No Asignados']
    for zona_name in zonas_filtered['zona'].dropna().unique():
        zona_df = zonas_filtered[zonas_filtered['zona'] == zona_name]
        z_resultado = zona_df['Resultado visita'].value_counts()
        z_normal = int(z_resultado.get('Normal', 0))
        z_cnr = int(z_resultado.get('CNR', 0))
        z_vf = int(z_resultado.get('Visita fallida', 0))
        z_efectivas = z_normal + z_cnr
        z_total = z_efectivas + z_vf
        zonas_data.append({
            "zona": zona_name,
            "normal": z_normal,
            "cnr": z_cnr,
            "pct_cnr": (z_cnr / z_efectivas * 100) if z_efectivas > 0 else 0,
            "visita_fallida": z_vf,
            "pct_visita_fallida": (z_vf / z_total * 100) if z_total > 0 else 0,
            "efectivas": z_efectivas,
            "pct_efectivas": (z_efectivas / z_total * 100) if z_total > 0 else 0,
        })
    zonas_data = sorted(zonas_data, key=lambda x: x['efectivas'], reverse=True)
    return zonas_data
