import pandas as pd
from app.config import META_POR_BRIGADA, brigadas_por_zona


def calculate_produccion(filtered: pd.DataFrame) -> list:
    produccion_data = []
    for zona_name in filtered['zona'].dropna().unique():
        if zona_name == 'No Asignados':
            continue
        zona_df = filtered[filtered['zona'] == zona_name]

        # Producción total (suma de Valor Unitario)
        produccion = zona_df['Valor Unitario'].dropna().sum()
        produccion = int(produccion) if not pd.isna(produccion) else 0

        # Configuración de brigadas y meta
        brigadas = brigadas_por_zona.get(zona_name, 1)
        meta = brigadas * META_POR_BRIGADA

        # CNR: cantidad y monto
        cnr_df = zona_df[zona_df['Resultado visita'] == 'CNR']
        z_cnr = int(cnr_df.shape[0])
        monto_cnr = cnr_df['Valor Unitario'].dropna().sum()
        monto_cnr = int(monto_cnr) if not pd.isna(monto_cnr) else 0

        produccion_data.append({
            "zona": zona_name,
            "brigadas_activas": brigadas,
            "meta_produccion": meta,
            "produccion": produccion,
            "pct_produccion": round((produccion / meta * 100) if meta > 0 else 0, 1),
            "cnr": z_cnr,
            "monto_cnr": monto_cnr,
            "promedio_monto_cnr": int(monto_cnr / z_cnr) if z_cnr > 0 else 0,
        })
    produccion_data = sorted(produccion_data, key=lambda x: x['produccion'], reverse=True)
    return produccion_data
