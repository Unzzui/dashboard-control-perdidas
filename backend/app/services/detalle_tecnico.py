import pandas as pd
import numpy as np
from datetime import date


# Feriados de Chile 2026
FERIADOS_2026 = {
    date(2026, 1, 1): "Año Nuevo",
    date(2026, 4, 3): "Viernes Santo",
    date(2026, 4, 4): "Sábado Santo",
    date(2026, 5, 1): "Día del Trabajo",
    date(2026, 5, 21): "Glorias Navales",
    date(2026, 6, 21): "Pueblos Indígenas",
    date(2026, 6, 29): "San Pedro y San Pablo",
    date(2026, 7, 16): "Virgen del Carmen",
    date(2026, 8, 15): "Asunción de la Virgen",
    date(2026, 9, 18): "Independencia Nacional",
    date(2026, 9, 19): "Glorias del Ejército",
    date(2026, 10, 12): "Encuentro de Dos Mundos",
    date(2026, 10, 31): "Iglesias Evangélicas",
    date(2026, 11, 1): "Todos los Santos",
    date(2026, 12, 8): "Inmaculada Concepción",
    date(2026, 12, 25): "Navidad",
}


def es_feriado(fecha: date) -> bool:
    """Determina si una fecha es feriado en Chile (NO incluye domingos, solo feriados oficiales)."""
    return fecha in FERIADOS_2026


def calculate_detalle_tecnico_diario(filtered: pd.DataFrame, nombre_tecnico: str, zona: str = None) -> dict:
    """
    Calcula el detalle diario de un técnico específico.

    Si zona es None o "TODAS": Muestra el consolidado de TODAS las zonas con desglose
    Si zona es específica: Muestra solo el detalle de esa zona

    IMPORTANTE: El DataFrame 'filtered' ya viene filtrado por mes desde apply_filters.

    Args:
        nombre_tecnico: Nombre del técnico
        zona: zona_inspeccion (zona donde trabajó) o None/"TODAS" para consolidado

    Returns:
        Dict con días trabajados, calendario, desglose por zona_inspeccion y zonas trabajadas
    """
    if filtered.empty:
        return {
            "nombre": nombre_tecnico,
            "zona": zona if zona else "TODAS",
            "dias": [],
            "total_dias": 0,
            "calendario": [],
            "desglose_zonas": [],
            "zonas_trabajadas": []
        }

    # Determinar si mostrar consolidado o zona específica
    mostrar_consolidado = (zona is None or zona == "TODAS")

    # Filtrar por técnico (case-insensitive para el nombre)
    zona_col = 'zona_inspeccion' if 'zona_inspeccion' in filtered.columns else 'zona'

    if mostrar_consolidado:
        # MODO CONSOLIDADO: Todo el trabajo del técnico
        mask = filtered['Nombre asignado'].str.lower() == nombre_tecnico.lower()
    else:
        # MODO ZONA ESPECÍFICA: Solo trabajo en esa zona
        mask = (filtered['Nombre asignado'].str.lower() == nombre_tecnico.lower()) & (filtered[zona_col] == zona)

    tecnico_df = filtered.loc[mask].copy()

    if tecnico_df.empty:
        return {
            "nombre": nombre_tecnico,
            "zona": zona if zona else "TODAS",
            "dias": [],
            "total_dias": 0,
            "calendario": [],
            "desglose_zonas": [],
            "zonas_trabajadas": []
        }


    # Mapeo de días en español
    dias_map = {
        'Monday': 'Lunes',
        'Tuesday': 'Martes',
        'Wednesday': 'Miércoles',
        'Thursday': 'Jueves',
        'Friday': 'Viernes',
        'Saturday': 'Sábado',
        'Sunday': 'Domingo'
    }

    # Agregar columnas auxiliares
    tecnico_df['fecha_date'] = pd.to_datetime(tecnico_df['Fecha ejecución']).dt.date
    tecnico_df['dia_semana'] = pd.to_datetime(tecnico_df['Fecha ejecución']).dt.day_name().map(dias_map)
    tecnico_df['es_cnr'] = (tecnico_df['Resultado visita'] == 'CNR').astype(int)
    tecnico_df['es_normal'] = (tecnico_df['Resultado visita'] == 'Normal').astype(int)
    tecnico_df['es_vf'] = (tecnico_df['Resultado visita'] == 'Visita fallida').astype(int)

    # VF CGE Pagables (responsabilidad CGE que se pagan)
    # Incluye: Sitio eriazo, Sin empalme, y cualquier "Sin acceso medidor..."
    tecnico_df['es_vf_cge_pagable'] = (
        (tecnico_df['Resultado visita'] == 'Visita fallida') &
        (
            tecnico_df['Resultado final'].isin(['Sitio eriazo', 'Sin empalme']) |
            tecnico_df['Resultado final'].str.contains('Sin acceso medidor', case=False, na=False)
        )
    ).astype(int)

    # VF No Efectivas (todas las VF menos las CGE pagables)
    tecnico_df['es_vf_no_efectiva'] = (
        (tecnico_df['Resultado visita'] == 'Visita fallida') &
        ~(
            tecnico_df['Resultado final'].isin(['Sitio eriazo', 'Sin empalme']) |
            tecnico_df['Resultado final'].str.contains('Sin acceso medidor', case=False, na=False)
        )
    ).astype(int)

    tecnico_df['es_mant'] = (tecnico_df['Resultado visita'] == 'Mantenimiento Medidor').astype(int)
    tecnico_df['kwh'] = tecnico_df['kWh CNR'].fillna(0)

    # Agrupar por fecha
    agg_by_date = tecnico_df.groupby('fecha_date', observed=True).agg({
        'dia_semana': 'first',
        'es_cnr': 'sum',
        'es_normal': 'sum',
        'es_vf': 'sum',
        'es_vf_cge_pagable': 'sum',
        'es_vf_no_efectiva': 'sum',
        'es_mant': 'sum',
        'kwh': 'sum',
    }).reset_index()

    agg_by_date.columns = ['fecha', 'dia_semana', 'cnr', 'normal', 'vf_total', 'vf_cge_pagable', 'vf_no_efectiva', 'mant', 'kwh']

    # Calcular métricas - EFECTIVAS incluyen VF CGE Pagables + Mantenimiento Medidor
    agg_by_date['efectivas'] = agg_by_date['cnr'] + agg_by_date['normal'] + agg_by_date['vf_cge_pagable'] + agg_by_date['mant']
    agg_by_date['visitas_totales'] = agg_by_date['cnr'] + agg_by_date['normal'] + agg_by_date['vf_total'] + agg_by_date['mant']
    agg_by_date['no_efectivas'] = agg_by_date['vf_no_efectiva']  # Solo VF no efectivas

    agg_by_date['pct_cnr'] = np.where(
        agg_by_date['visitas_totales'] > 0,
        (agg_by_date['cnr'] / agg_by_date['visitas_totales'] * 100).round(1),
        0
    )
    agg_by_date['pct_efectivas'] = np.where(
        agg_by_date['visitas_totales'] > 0,
        (agg_by_date['efectivas'] / agg_by_date['visitas_totales'] * 100).round(1),
        0
    )

    # Ordenar por fecha
    agg_by_date = agg_by_date.sort_values('fecha')

    # Calcular desglose por zonas (siempre se calcula para saber en cuántas zonas trabajó)
    desglose_zonas = []
    zona_inspeccion_col = 'zona_inspeccion' if 'zona_inspeccion' in tecnico_df.columns else 'zona'

    if zona_inspeccion_col in tecnico_df.columns:
        # Agrupar por zona_inspeccion para ver el desglose
        agg_by_zona = tecnico_df.groupby(zona_inspeccion_col, observed=True).agg({
            'es_cnr': 'sum',
            'es_normal': 'sum',
            'es_vf': 'sum',
            'es_vf_cge_pagable': 'sum',
            'es_vf_no_efectiva': 'sum',
            'es_mant': 'sum',
            'kwh': 'sum',
            'fecha_date': 'nunique',
        }).reset_index()

        agg_by_zona.columns = ['zona_inspeccion', 'cnr', 'normal', 'vf_total', 'vf_cge_pagable', 'vf_no_efectiva', 'mant', 'kwh', 'dias']

        # Calcular métricas por zona - EFECTIVAS incluyen VF CGE Pagables + Mantenimiento Medidor
        agg_by_zona['efectivas'] = agg_by_zona['cnr'] + agg_by_zona['normal'] + agg_by_zona['vf_cge_pagable'] + agg_by_zona['mant']
        agg_by_zona['visitas_totales'] = agg_by_zona['cnr'] + agg_by_zona['normal'] + agg_by_zona['vf_total'] + agg_by_zona['mant']
        agg_by_zona['pct_efectivas'] = np.where(
            agg_by_zona['visitas_totales'] > 0,
            (agg_by_zona['efectivas'] / agg_by_zona['visitas_totales'] * 100).round(1),
            0
        )

        # Ordenar por efectivas descendente
        agg_by_zona = agg_by_zona.sort_values('efectivas', ascending=False)

        # Convertir a lista de diccionarios - Orden: Total visitas - Normales - VF CGE - VF No Efectiva - CNR - kWH
        for _, row in agg_by_zona.iterrows():
            desglose_zonas.append({
                "zona": row['zona_inspeccion'],
                "dias_trabajados": int(row['dias']),

                # Orden solicitado
                "visitas_totales": int(row['visitas_totales']),
                "normal": int(row['normal']),
                "mantenimiento": int(row['mant']),
                "vf_cge_pagable": int(row['vf_cge_pagable']),
                "vf_no_efectiva": int(row['vf_no_efectiva']),
                "cnr": int(row['cnr']),
                "kwh_recuperado": int(row['kwh']),

                # Campos adicionales
                "efectivas": int(row['efectivas']),
                "pct_efectivas": float(row['pct_efectivas']),

                # Compatibilidad
                "kwh_estimado": int(row['kwh']),
            })

    # Obtener información de zonas
    zonas_trabajadas = [z['zona'] for z in desglose_zonas]
    zona_origen = tecnico_df['zona_tecnico'].iloc[0] if 'zona_tecnico' in tecnico_df.columns else (zona if zona else "")

    if mostrar_consolidado:
        esta_apoyando = False  # En modo consolidado no está "apoyando", está mostrando todo
    else:
        esta_apoyando = zona != zona_origen if zona and 'zona_tecnico' in tecnico_df.columns else False

    # Determinar el mes del calendario
    calendario = []
    dias_data_filtrados = []

    if len(agg_by_date) > 0:
        # Contar días por mes y usar el mes con MÁS días trabajados
        agg_by_date['mes_año'] = pd.to_datetime(agg_by_date['fecha']).dt.to_period('M')
        mes_con_mas_dias = agg_by_date['mes_año'].value_counts().idxmax()

        # Convertir el período a timestamp
        fecha_ref = mes_con_mas_dias.to_timestamp()
        mes_calendario = fecha_ref.month
        año_calendario = fecha_ref.year

        # Filtrar agg_by_date para incluir SOLO el mes del calendario
        agg_by_date_filtrado = agg_by_date[
            agg_by_date['mes_año'] == mes_con_mas_dias
        ].copy()

        # Eliminar columna temporal
        agg_by_date_filtrado = agg_by_date_filtrado.drop(columns=['mes_año'])
        agg_by_date = agg_by_date.drop(columns=['mes_año'])

        primer_dia_mes = pd.Timestamp(year=año_calendario, month=mes_calendario, day=1).date()

        # Último día del mes
        if mes_calendario == 12:
            ultimo_dia_mes = pd.Timestamp(year=año_calendario + 1, month=1, day=1).date() - pd.Timedelta(days=1)
        else:
            ultimo_dia_mes = pd.Timestamp(year=año_calendario, month=mes_calendario + 1, day=1).date() - pd.Timedelta(days=1)

        # Convertir agg_by_date_filtrado a dias_data
        for _, row in agg_by_date_filtrado.iterrows():
            dias_data_filtrados.append({
                "fecha": str(row['fecha']),
                "dia_semana": row['dia_semana'],

                # Orden solicitado: Total visitas - Normales - Fallida Efectiva CGE - Fallida No efectiva - CNR - kWH
                "visitas_totales": int(row['visitas_totales']),
                "normal": int(row['normal']),
                "vf_cge_pagable": int(row['vf_cge_pagable']),  # Fallida Efectiva CGE
                "vf_no_efectiva": int(row['vf_no_efectiva']),  # Fallida No efectiva
                "cnr": int(row['cnr']),
                "kwh_recuperado": int(row['kwh']),

                # Campos adicionales
                "efectivas": int(row['efectivas']),
                "no_efectivas": int(row['no_efectivas']),
                "mantenimiento": int(row['mant']),

                # Porcentajes
                "pct_cnr": float(row['pct_cnr']),
                "pct_efectivas": float(row['pct_efectivas']),

                # Compatibilidad
                "visita_fallida": int(row['vf_total']),  # Total VF
                "kwh_estimado": int(row['kwh']),
            })

        # Crear diccionario de días trabajados para búsqueda rápida
        dias_trabajados = {str(row['fecha']): True for _, row in agg_by_date_filtrado.iterrows()}

        # Obtener fecha de hoy
        hoy = pd.Timestamp.now().date()

        # Generar todos los días del mes
        fecha_actual = primer_dia_mes
        while fecha_actual <= ultimo_dia_mes:
            fecha_str = str(fecha_actual)
            dia_semana_nombre = dias_map[pd.Timestamp(fecha_actual).day_name()]

            # Determinar si es feriado
            es_dia_feriado = es_feriado(fecha_actual)

            # Determinar si es día hábil (lunes a viernes, excluyendo sábado, domingo y feriados)
            dia_semana_num = pd.Timestamp(fecha_actual).dayofweek  # 0=Monday, 6=Sunday
            es_habil = dia_semana_num < 5 and not es_dia_feriado  # Lunes a Viernes son hábiles (0-4) si no es feriado

            # Determinar si es día futuro
            es_futuro = fecha_actual > hoy

            # Determinar si trabajó este día
            trabajo = fecha_str in dias_trabajados

            calendario.append({
                "fecha": fecha_str,
                "dia": int(pd.Timestamp(fecha_actual).day),
                "dia_semana": dia_semana_nombre,
                "trabajo": trabajo,
                "es_habil": es_habil,
                "es_futuro": es_futuro,
                "es_feriado": es_dia_feriado
            })
            fecha_actual += pd.Timedelta(days=1)

    # Usar dias_data_filtrados si existe, sino lista vacía
    dias_finales = dias_data_filtrados if len(dias_data_filtrados) > 0 else []

    return {
        "nombre": nombre_tecnico,
        "zona": zona if zona else "TODAS",  # Zona filtrada o "TODAS" para consolidado
        "zona_origen": zona_origen,  # Zona de origen del técnico
        "dias": dias_finales,
        "total_dias": len(dias_finales),
        "calendario": calendario,
        "desglose_zonas": desglose_zonas,  # Desglose de trabajo por zona
        "zonas_trabajadas": list(zonas_trabajadas),  # Lista de todas las zonas donde trabaja
        "trabajo_en_otras_zonas": len(zonas_trabajadas) > 1,  # Trabaja en múltiples zonas
        "esta_apoyando": esta_apoyando,  # True si la zona actual no es su zona de origen
        "es_consolidado": mostrar_consolidado,  # True si muestra todas las zonas
    }


def get_inspecciones_dia(filtered: pd.DataFrame, nombre_tecnico: str, zona: str = None, fecha_str: str = None) -> dict:
    """
    Obtiene el detalle de todas las inspecciones de un técnico en un día específico.

    Args:
        nombre_tecnico: Nombre del técnico
        zona: zona_inspeccion (zona donde trabajó). Si es None o "TODAS", busca en todas las zonas.
        fecha_str: Fecha en formato YYYY-MM-DD
    """
    if filtered.empty:
        return {
            "nombre": nombre_tecnico,
            "zona": zona if zona else "TODAS",
            "fecha": fecha_str,
            "total_inspecciones": 0,
            "efectivas": 0,
            "cnr": 0,
            "normal": 0,
            "mantenimiento": 0,
            "vf_cge_pagable": 0,
            "vf_no_efectiva": 0,
            "inspecciones": []
        }

    # Filtrar por técnico, zona_inspeccion y fecha (case-insensitive para el nombre)
    try:
        fecha_buscada = pd.to_datetime(fecha_str).date()
    except:
        return {
            "nombre": nombre_tecnico,
            "zona": zona if zona else "TODAS",
            "fecha": fecha_str,
            "total_inspecciones": 0,
            "efectivas": 0,
            "cnr": 0,
            "normal": 0,
            "mantenimiento": 0,
            "vf_cge_pagable": 0,
            "vf_no_efectiva": 0,
            "inspecciones": []
        }

    zona_col = 'zona_inspeccion' if 'zona_inspeccion' in filtered.columns else 'zona'

    # IMPORTANTE: Si zona es None o "TODAS", buscar en TODAS las zonas
    buscar_todas_zonas = (zona is None or zona == "TODAS")

    if buscar_todas_zonas:
        mask = (
            (filtered['Nombre asignado'].str.lower() == nombre_tecnico.lower()) &
            (filtered['Fecha ejecución'].dt.date == fecha_buscada)
        )
    else:
        mask = (
            (filtered['Nombre asignado'].str.lower() == nombre_tecnico.lower()) &
            (filtered[zona_col] == zona) &
            (filtered['Fecha ejecución'].dt.date == fecha_buscada)
        )

    inspecciones_df = filtered.loc[mask].copy()

    if inspecciones_df.empty:
        return {
            "nombre": nombre_tecnico,
            "zona": zona if zona else "TODAS",
            "fecha": fecha_str,
            "total_inspecciones": 0,
            "efectivas": 0,
            "cnr": 0,
            "normal": 0,
            "mantenimiento": 0,
            "vf_cge_pagable": 0,
            "vf_no_efectiva": 0,
            "inspecciones": []
        }

    # Calcular métricas del día
    total_cnr = (inspecciones_df['Resultado visita'] == 'CNR').sum()
    total_normal = (inspecciones_df['Resultado visita'] == 'Normal').sum()
    total_vf = (inspecciones_df['Resultado visita'] == 'Visita fallida').sum()
    total_mant = (inspecciones_df['Resultado visita'] == 'Mantenimiento Medidor').sum()

    # VF CGE Pagables
    vf_cge_mask = (
        (inspecciones_df['Resultado visita'] == 'Visita fallida') &
        (
            inspecciones_df['Resultado final'].isin(['Sitio eriazo', 'Sin empalme']) |
            inspecciones_df['Resultado final'].str.contains('Sin acceso medidor', case=False, na=False)
        )
    )
    total_vf_cge = vf_cge_mask.sum()
    total_vf_no_efectiva = total_vf - total_vf_cge

    # Efectivas = CNR + Normal + VF CGE Pagables + Mantenimiento Medidor
    total_efectivas = total_cnr + total_normal + total_vf_cge + total_mant

    # Columnas relevantes para mostrar
    columnas_mostrar = [
        'ID Medida', 'Aviso', 'Resultado visita', 'Resultado final', 'Tipo_CNR.Tipo de CNR',
        'Comuna', 'Dirección Servicio', 'Hora inicio', 'Hora fin',
        'kWh CNR', 'Descripción del aviso'
    ]

    inspecciones = []
    for _, row in inspecciones_df.iterrows():
        inspeccion = {}
        for col in columnas_mostrar:
            if col in row.index:
                val = row[col]
                if pd.isna(val):
                    inspeccion[col] = None
                elif isinstance(val, (pd.Timestamp,)):
                    inspeccion[col] = val.strftime('%H:%M')
                else:
                    inspeccion[col] = str(val) if not isinstance(val, (int, float)) else val
            else:
                inspeccion[col] = None

        # Agregar zona donde se hizo la inspección (útil cuando se busca en todas las zonas)
        if zona_col in row.index:
            inspeccion['zona_inspeccion'] = row[zona_col]

        inspecciones.append(inspeccion)

    return {
        "nombre": nombre_tecnico,
        "zona": zona if zona else "TODAS",
        "fecha": fecha_str,
        "total_inspecciones": len(inspecciones),
        "efectivas": int(total_efectivas),
        "cnr": int(total_cnr),
        "normal": int(total_normal),
        "mantenimiento": int(total_mant),
        "vf_cge_pagable": int(total_vf_cge),
        "vf_no_efectiva": int(total_vf_no_efectiva),
        "inspecciones": inspecciones
    }
