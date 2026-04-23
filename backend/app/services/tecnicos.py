import pandas as pd
import numpy as np


def normalizar_nombre(nombre: str) -> str:
    """Normaliza nombres a Title Case (Primera Letra Mayúscula)"""
    return nombre.strip().title()


def calculate_tecnicos(filtered: pd.DataFrame) -> list:
    """
    Calcula ranking de técnicos agrupados por zona_inspeccion (donde trabajó).

    IMPORTANTE: Un técnico aparece UNA VEZ POR CADA ZONA donde trabajó.
    Esto permite ver específicamente dónde está trabajando cada persona.
    """
    if filtered.empty:
        return []

    # Filtrar BOTs y No Asignados
    zona_inspeccion_col = 'zona_inspeccion' if 'zona_inspeccion' in filtered.columns else 'zona'
    mask = ~filtered['Nombre asignado'].str.contains('BOT', na=False)
    mask &= filtered[zona_inspeccion_col].notna()
    mask &= filtered[zona_inspeccion_col] != 'No Asignados'
    mask &= filtered['Nombre asignado'].notna()
    ejecutores = filtered.loc[mask]

    if ejecutores.empty:
        return []

    # Crear columnas auxiliares para agregación vectorizada
    ejecutores = ejecutores.copy()
    # Normalizar nombres a Title Case
    ejecutores['Nombre asignado'] = ejecutores['Nombre asignado'].apply(normalizar_nombre)
    ejecutores['es_cnr'] = (ejecutores['Resultado visita'] == 'CNR').astype(int)
    ejecutores['es_normal'] = (ejecutores['Resultado visita'] == 'Normal').astype(int)
    ejecutores['es_vf'] = (ejecutores['Resultado visita'] == 'Visita fallida').astype(int)
    ejecutores['es_mant'] = (ejecutores['Resultado visita'] == 'Mantenimiento Medidor').astype(int)

    # VF CGE Pagables (responsabilidad CGE que se pagan)
    # Incluye: Sitio eriazo, Sin empalme, Desconectado en BT/MT, y cualquier "Sin acceso medidor..."
    ejecutores['es_vf_cge_pagable'] = (
        (ejecutores['Resultado visita'] == 'Visita fallida') &
        (
            ejecutores['Resultado final'].isin(['Sitio eriazo', 'Sin empalme', 'Desconectado en BT/MT']) |
            ejecutores['Resultado final'].str.contains('Sin acceso medidor', case=False, na=False)
        )
    ).astype(int)

    # VF No Efectivas (todas las VF menos las CGE pagables)
    ejecutores['es_vf_no_efectiva'] = (
        (ejecutores['Resultado visita'] == 'Visita fallida') &
        ~(
            ejecutores['Resultado final'].isin(['Sitio eriazo', 'Sin empalme', 'Desconectado en BT/MT']) |
            ejecutores['Resultado final'].str.contains('Sin acceso medidor', case=False, na=False)
        )
    ).astype(int)

    ejecutores['es_hurto'] = ((ejecutores['Resultado visita'] == 'CNR') &
                               (ejecutores['Tipo_CNR.Tipo de CNR'] == 'CNR Hurto')).astype(int)
    ejecutores['es_falla'] = ((ejecutores['Resultado visita'] == 'CNR') &
                               (ejecutores['Tipo_CNR.Tipo de CNR'] == 'CNR Falla')).astype(int)
    ejecutores['kwh'] = ejecutores['kWh CNR'].fillna(0)
    ejecutores['fecha_date'] = ejecutores['Fecha ejecución'].dt.date

    # Agrupar por zona_inspeccion (donde trabajó) y técnico
    # Esto muestra una fila por cada zona donde trabajó el técnico
    agg_result = ejecutores.groupby([zona_inspeccion_col, 'Nombre asignado'], observed=True).agg({
        'es_cnr': 'sum',
        'es_normal': 'sum',
        'es_vf': 'sum',
        'es_vf_cge_pagable': 'sum',
        'es_vf_no_efectiva': 'sum',
        'es_mant': 'sum',
        'es_hurto': 'sum',
        'es_falla': 'sum',
        'kwh': 'sum',
        'fecha_date': 'nunique',
        'zona_tecnico': 'first',  # Zona de origen del técnico
    }).reset_index()

    agg_result.columns = ['zona_inspeccion', 'nombre', 'cnr', 'normal', 'vf_total', 'vf_cge_pagable', 'vf_no_efectiva', 'mant', 'hurto', 'falla', 'kwh', 'dias', 'zona_tecnico']

    # Calcular métricas vectorizadas
    agg_result['dias'] = agg_result['dias'].clip(lower=1)

    # NUEVO CÁLCULO: Efectivas = CNR + Normal + VF CGE Pagables + Mantenimiento Medidor
    agg_result['efectivas'] = agg_result['cnr'] + agg_result['normal'] + agg_result['vf_cge_pagable'] + agg_result['mant']

    # Total visitas incluye todas las VF (efectivas y no efectivas)
    agg_result['visitas_totales'] = agg_result['cnr'] + agg_result['normal'] + agg_result['vf_total'] + agg_result['mant']

    # CALCULAR TOTALES GLOBALES POR TÉCNICO (para técnicos que apoyan en múltiples zonas)
    # La meta de 160 efectivas es GLOBAL, no por zona individual
    totales_globales = agg_result.groupby('nombre', observed=True).agg({
        'cnr': 'sum',
        'normal': 'sum',
        'efectivas': 'sum',
        'visitas_totales': 'sum',
        'kwh': 'sum',
        'dias': 'sum',  # Suma de días trabajados en todas las zonas
    }).reset_index()

    totales_globales.columns = ['nombre', 'cnr_global', 'normal_global', 'efectivas_global',
                                 'visitas_totales_global', 'kwh_global', 'dias_global']

    # Calcular promedios globales
    totales_globales['promedio_efectivas_global'] = (totales_globales['efectivas_global'] / totales_globales['dias_global']).round(1)
    totales_globales['promedio_cnr_global'] = (totales_globales['cnr_global'] / totales_globales['dias_global']).round(1)

    # Determinar si cumple meta global (8 efectivas por día o 160 efectivas totales en 20 días)
    totales_globales['cumple_meta_global'] = (totales_globales['promedio_efectivas_global'] >= 8)

    # Contar en cuántas zonas trabaja cada técnico
    zonas_por_tecnico = agg_result.groupby('nombre', observed=True)['zona_inspeccion'].nunique().reset_index()
    zonas_por_tecnico.columns = ['nombre', 'cantidad_zonas']
    totales_globales = totales_globales.merge(zonas_por_tecnico, on='nombre', how='left')

    # Unir totales globales con los datos por zona
    agg_result = agg_result.merge(totales_globales, on='nombre', how='left')

    agg_result['acciones_diarias'] = (agg_result['visitas_totales'] / agg_result['dias']).round(1)

    agg_result['pct_efectivas'] = np.where(
        agg_result['visitas_totales'] > 0,
        (agg_result['efectivas'] / agg_result['visitas_totales'] * 100).round(1),
        0
    )

    # Porcentaje de VF No Efectivas (no incluye VF CGE pagables)
    agg_result['pct_vf_no_efectivas'] = np.where(
        agg_result['visitas_totales'] > 0,
        (agg_result['vf_no_efectiva'] / agg_result['visitas_totales'] * 100).round(1),
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

    # Determinar si está en su zona de origen o apoyando
    # Convertir a string para comparar (evitar problemas con categorías)
    agg_result['es_zona_origen'] = (
        agg_result['zona_inspeccion'].astype(str) == agg_result['zona_tecnico'].astype(str)
    )

    # Ordenar por CNR descendente
    agg_result = agg_result.sort_values('cnr', ascending=False)

    # Convertir a lista de diccionarios
    tecnicos_data = []
    for _, row in agg_result.iterrows():
        tecnico_dict = {
            "zona": row['zona_inspeccion'],  # Zona donde trabajó
            "zona_origen": row['zona_tecnico'],  # Zona de origen del técnico
            "nombre": row['nombre'],
            "dias_trabajados": int(row['dias']),
            "acciones_diarias": float(row['acciones_diarias']),

            # Visitas y efectividad
            "visitas_totales": int(row['visitas_totales']),
            "normal": int(row['normal']),
            "vf_cge_pagable": int(row['vf_cge_pagable']),  # VF efectivas (CGE)
            "vf_no_efectiva": int(row['vf_no_efectiva']),  # VF no efectivas
            "cnr": int(row['cnr']),

            # Efectivas (CNR + Normal + VF CGE Pagables)
            "visitas_efectivas": int(row['efectivas']),
            "efectivas": int(row['efectivas']),

            # Porcentajes
            "pct_efectivas": float(row['pct_efectivas']),
            "pct_vf_no_efectivas": float(row['pct_vf_no_efectivas']),

            # Promedios
            "promedio_cnr": float(row['promedio_cnr']),
            "promedio_efectivas": float(row['promedio_efectivas']),

            # CNR detalle
            "pct_hurto": float(row['pct_hurto']),
            "pct_falla": float(row['pct_falla']),

            # kWh
            "kwh_recuperado": int(row['kwh']),  # Renombrado para claridad
            "kwh_estimado": int(row['kwh']),     # Mantener por compatibilidad

            # Zona
            "es_zona_origen": bool(row['es_zona_origen']),  # True si está en su zona
            "esta_apoyando": not bool(row['es_zona_origen']),  # True si está apoyando

            # Totales Globales (suma de todas las zonas donde trabajó)
            "efectivas_global": int(row['efectivas_global']),  # Total efectivas en TODAS las zonas
            "cnr_global": int(row['cnr_global']),  # Total CNR en TODAS las zonas
            "normal_global": int(row['normal_global']),  # Total Normal en TODAS las zonas
            "visitas_totales_global": int(row['visitas_totales_global']),  # Total visitas en TODAS las zonas
            "kwh_global": int(row['kwh_global']),  # Total kWh en TODAS las zonas
            "dias_global": int(row['dias_global']),  # Total días trabajados en TODAS las zonas
            "promedio_efectivas_global": float(row['promedio_efectivas_global']),  # Promedio efectivas diario global
            "promedio_cnr_global": float(row['promedio_cnr_global']),  # Promedio CNR diario global
            "cumple_meta_global": bool(row['cumple_meta_global']),  # True si cumple meta global (≥8 efectivas/día)
            "cantidad_zonas": int(row['cantidad_zonas']),  # Número de zonas donde trabaja
        }
        tecnicos_data.append(tecnico_dict)

    return tecnicos_data
