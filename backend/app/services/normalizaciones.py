import pandas as pd


def calculate_normalizaciones(filtered: pd.DataFrame) -> list:
    normalizaciones_data = []
    cnr_df = filtered[filtered['Resultado visita'] == 'CNR']
    for zona_name in cnr_df['zona'].dropna().unique():
        if zona_name == 'No Asignados':
            continue
        zona_df = cnr_df[cnr_df['zona'] == zona_name]
        trat_counts = zona_df['Tratamiento'].value_counts()
        normalizado = int(trat_counts.get('Normalizado', 0))
        no_normalizado = int(trat_counts.get('No normalizado', 0))
        total_trat = normalizado + no_normalizado
        if total_trat == 0:
            continue
        normalizaciones_data.append({
            "zona": zona_name,
            "no_normalizado": no_normalizado,
            "pct_no_normalizado": (no_normalizado / total_trat * 100) if total_trat > 0 else 0,
            "normalizado": normalizado,
            "pct_normalizado": (normalizado / total_trat * 100) if total_trat > 0 else 0,
            "total": total_trat,
        })
    normalizaciones_data = sorted(normalizaciones_data, key=lambda x: x['total'], reverse=True)
    return normalizaciones_data
