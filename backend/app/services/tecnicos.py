import pandas as pd
import numpy as np


def calculate_tecnicos(filtered: pd.DataFrame) -> list:
    if filtered.empty:
        return []

    # Filtrar BOTs y No Asignados
    mask = ~filtered['Nombre asignado'].str.contains('BOT', na=False)
    mask &= filtered['zona'].notna()
    mask &= filtered['zona'] != 'No Asignados'
    mask &= filtered['Nombre asignado'].notna()
    ejecutores = filtered.loc[mask]

    if ejecutores.empty:
        return []

    # Crear columnas auxiliares para agregación vectorizada
    ejecutores = ejecutores.copy()
    ejecutores['es_cnr'] = (ejecutores['Resultado visita'] == 'CNR').astype(int)
    ejecutores['es_normal'] = (ejecutores['Resultado visita'] == 'Normal').astype(int)
    ejecutores['es_vf'] = (ejecutores['Resultado visita'] == 'Visita fallida').astype(int)
    ejecutores['es_mant'] = (ejecutores['Resultado visita'] == 'Mantenimiento Medidor').astype(int)
    ejecutores['es_hurto'] = ((ejecutores['Resultado visita'] == 'CNR') &
                               (ejecutores['Tipo_CNR.Tipo de CNR'] == 'CNR Hurto')).astype(int)
    ejecutores['es_falla'] = ((ejecutores['Resultado visita'] == 'CNR') &
                               (ejecutores['Tipo_CNR.Tipo de CNR'] == 'CNR Falla')).astype(int)
    ejecutores['kwh'] = ejecutores['kWh CNR'].fillna(0)
    ejecutores['fecha_date'] = ejecutores['Fecha ejecución'].dt.date

    # Agrupar por zona y técnico - una sola operación
    agg_result = ejecutores.groupby(['zona', 'Nombre asignado'], observed=True).agg({
        'es_cnr': 'sum',
        'es_normal': 'sum',
        'es_vf': 'sum',
        'es_mant': 'sum',
        'es_hurto': 'sum',
        'es_falla': 'sum',
        'kwh': 'sum',
        'fecha_date': 'nunique',
    }).reset_index()

    agg_result.columns = ['zona', 'nombre', 'cnr', 'normal', 'vf', 'mant', 'hurto', 'falla', 'kwh', 'dias']

    # Calcular métricas vectorizadas
    agg_result['dias'] = agg_result['dias'].clip(lower=1)
    agg_result['efectivas'] = agg_result['cnr'] + agg_result['normal']
    agg_result['visitas_totales'] = agg_result['cnr'] + agg_result['normal'] + agg_result['vf'] + agg_result['mant']

    agg_result['acciones_diarias'] = (agg_result['visitas_totales'] / agg_result['dias']).round(1)
    agg_result['pct_efectivas'] = np.where(
        agg_result['visitas_totales'] > 0,
        (agg_result['efectivas'] / agg_result['visitas_totales'] * 100).round(1),
        0
    )
    agg_result['pct_visitas_fallidas'] = np.where(
        agg_result['visitas_totales'] > 0,
        (agg_result['vf'] / agg_result['visitas_totales'] * 100).round(1),
        0
    )
    agg_result['promedio_cnr'] = (agg_result['cnr'] / agg_result['dias']).round(1)
    agg_result['promedio_efectivas'] = (agg_result['efectivas'] / agg_result['dias']).round(1)
    agg_result['pct_hurto'] = np.where(
        agg_result['cnr'] > 0,
        (agg_result['hurto'] / agg_result['cnr'] * 100).round(1),
        0
    )
    agg_result['pct_falla'] = np.where(
        agg_result['cnr'] > 0,
        (agg_result['falla'] / agg_result['cnr'] * 100).round(1),
        0
    )

    # Ordenar por CNR descendente
    agg_result = agg_result.sort_values('cnr', ascending=False)

    # Convertir a lista de diccionarios
    tecnicos_data = []
    for _, row in agg_result.iterrows():
        tecnicos_data.append({
            "zona": row['zona'],
            "nombre": row['nombre'],
            "dias_trabajados": int(row['dias']),
            "acciones_diarias": float(row['acciones_diarias']),
            "visitas_totales": int(row['visitas_totales']),
            "visitas_efectivas": int(row['efectivas']),
            "pct_efectivas": float(row['pct_efectivas']),
            "pct_visitas_fallidas": float(row['pct_visitas_fallidas']),
            "cnr": int(row['cnr']),
            "promedio_cnr": float(row['promedio_cnr']),
            "efectivas": int(row['efectivas']),
            "promedio_efectivas": float(row['promedio_efectivas']),
            "pct_hurto": float(row['pct_hurto']),
            "pct_falla": float(row['pct_falla']),
            "kwh_estimado": int(row['kwh']),
        })

    return tecnicos_data
