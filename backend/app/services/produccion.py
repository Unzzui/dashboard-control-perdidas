import pandas as pd
from app.config import META_POR_BRIGADA, brigadas_por_zona


def calculate_produccion(filtered: pd.DataFrame) -> list:
    produccion_data = []
    for zona_name in filtered['zona'].dropna().unique():
        if zona_name == 'No Asignados':
            continue
        zona_df = filtered[filtered['zona'] == zona_name]
        produccion = zona_df['Valor Unitario'].dropna().sum()
        produccion = int(produccion) if not pd.isna(produccion) else 0
        brigadas = brigadas_por_zona.get(zona_name, 1)
        meta = brigadas * META_POR_BRIGADA
        z_cnr = int(zona_df[zona_df['Resultado visita'] == 'CNR'].shape[0])
        monto_cnr = produccion
        produccion_data.append({
            "zona": zona_name,
            "brigadas_activas": brigadas,
            "meta_produccion": meta,
            "produccion": produccion,
            "pct_produccion": (produccion / meta * 100) if meta > 0 else 0,
            "cnr": z_cnr,
            "monto_cnr": monto_cnr,
            "promedio_monto_cnr": (monto_cnr / z_cnr) if z_cnr > 0 else 0,
        })
    produccion_data = sorted(produccion_data, key=lambda x: x['produccion'], reverse=True)
    return produccion_data
