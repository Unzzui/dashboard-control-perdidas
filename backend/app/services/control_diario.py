import pandas as pd
import numpy as np
import re


def calculate_control_diario(filtered: pd.DataFrame, dia_especifico: int = None) -> dict:
    """Calcula los datos del control diario basado en el día anterior con datos."""

    # Filtrar registros con fecha
    mask = filtered['Fecha ejecución'].notna()
    df_con_fecha = filtered.loc[mask]

    if df_con_fecha.empty:
        return _empty_response()

    # Obtener todas las fechas únicas ordenadas
    fechas_unicas = sorted(df_con_fecha['Fecha ejecución'].dt.date.unique())

    if len(fechas_unicas) == 0:
        return _empty_response()

    # Determinar fecha a reportar
    if dia_especifico is not None:
        fechas_con_dia = [f for f in fechas_unicas if f.day == dia_especifico]
        if fechas_con_dia:
            fecha_reporte_date = max(fechas_con_dia)
        else:
            return _empty_response()
    else:
        fecha_reporte_date = fechas_unicas[-2] if len(fechas_unicas) >= 2 else fechas_unicas[-1]

    # Formatear fecha
    meses = {1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril', 5: 'mayo', 6: 'junio',
             7: 'julio', 8: 'agosto', 9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre'}
    dias_semana = {0: 'lunes', 1: 'martes', 2: 'miércoles', 3: 'jueves', 4: 'viernes', 5: 'sábado', 6: 'domingo'}
    dia_semana = dias_semana[fecha_reporte_date.weekday()]
    fecha_reporte = f"{dia_semana.capitalize()} {fecha_reporte_date.day} de {meses[fecha_reporte_date.month]} de {fecha_reporte_date.year}"

    # Filtrar datos del día y excluir BOTs
    mask = (df_con_fecha['Fecha ejecución'].dt.date == fecha_reporte_date)
    mask &= ~df_con_fecha['Nombre asignado'].str.contains('BOT', na=False)
    df_dia = df_con_fecha.loc[mask]

    if df_dia.empty:
        return _empty_response()

    return {
        "fecha_reporte": fecha_reporte,
        "produccion": _calculate_produccion_optimized(df_dia),
        "cierre_actividades": _calculate_cierre_optimized(df_dia),
        "detalle_cnr": _calculate_detalle_cnr_optimized(df_dia),
        "campanas_cnr": _calculate_campanas_optimized(df_dia),
        "resumen": _calculate_resumen(df_dia),
    }


def _empty_response() -> dict:
    return {
        "fecha_reporte": "Sin datos",
        "produccion": [],
        "cierre_actividades": [],
        "detalle_cnr": [],
        "campanas_cnr": [],
        "resumen": {
            "total_produccion": 0, "total_cnr": 0, "total_normal": 0,
            "total_visita_fallida": 0, "pct_cnr_general": 0, "pct_visita_fallida_general": 0,
        },
    }


def _calculate_produccion_optimized(df: pd.DataFrame) -> list:
    """Calcula producción por zona y técnico usando operaciones vectorizadas."""
    if df.empty:
        return []

    # Filtrar zonas válidas
    df = df[df['zona'].notna() & (df['zona'] != 'No Asignados')]
    if df.empty:
        return []

    # Crear columnas de conteo
    df = df.copy()
    df['es_cnr'] = (df['Resultado visita'] == 'CNR').astype(int)
    df['es_normal'] = (df['Resultado visita'] == 'Normal').astype(int)
    df['es_vf'] = (df['Resultado visita'] == 'Visita fallida').astype(int)
    df['es_mant'] = (df['Resultado visita'] == 'Mantenimiento Medidor').astype(int)

    # Agregar por técnico
    tec_agg = df.groupby(['zona', 'Nombre asignado'], observed=True).agg({
        'es_cnr': 'sum', 'es_normal': 'sum', 'es_vf': 'sum', 'es_mant': 'sum'
    }).reset_index()
    tec_agg.columns = ['zona', 'nombre', 'cnr', 'normal', 'vf', 'mant']

    # Agregar por zona
    zona_agg = tec_agg.groupby('zona', observed=True).agg({
        'cnr': 'sum', 'normal': 'sum', 'vf': 'sum', 'mant': 'sum', 'nombre': 'nunique'
    }).reset_index()
    zona_agg.columns = ['zona', 'cnr', 'normal', 'vf', 'mant', 'num_tecnicos']

    produccion = []

    for _, zona_row in zona_agg.sort_values('zona').iterrows():
        zona = zona_row['zona']
        z_cnr, z_normal, z_vf, z_mant = zona_row['cnr'], zona_row['normal'], zona_row['vf'], zona_row['mant']
        z_prod = z_cnr + z_normal + z_vf + z_mant
        z_efectivo = z_cnr + z_mant + z_normal
        z_q_efectivo = z_efectivo / zona_row['num_tecnicos'] if zona_row['num_tecnicos'] > 0 else 0
        z_pct_cnr = (z_cnr / (z_cnr + z_normal) * 100) if (z_cnr + z_normal) > 0 else 0
        z_pct_vf = (z_vf / z_prod * 100) if z_prod > 0 else 0

        produccion.append({
            "etiqueta": zona, "es_zona": True,
            "cnr": int(z_cnr), "mantenimiento_medidor": int(z_mant),
            "normal": int(z_normal), "visita_fallida": int(z_vf),
            "produccion": int(z_prod), "q_efectivo": round(z_q_efectivo, 2),
            "pct_cnr": round(z_pct_cnr, 1), "pct_visita_fallida": round(z_pct_vf, 1),
        })

        # Técnicos de esta zona
        tec_zona = tec_agg[tec_agg['zona'] == zona].sort_values('nombre')
        for _, tec_row in tec_zona.iterrows():
            t_cnr, t_normal, t_vf, t_mant = tec_row['cnr'], tec_row['normal'], tec_row['vf'], tec_row['mant']
            t_prod = t_cnr + t_normal + t_vf + t_mant
            t_q_efectivo = t_cnr + t_mant + t_normal
            t_pct_cnr = (t_cnr / (t_cnr + t_normal) * 100) if (t_cnr + t_normal) > 0 else 0
            t_pct_vf = (t_vf / t_prod * 100) if t_prod > 0 else 0

            produccion.append({
                "etiqueta": tec_row['nombre'], "es_zona": False,
                "cnr": int(t_cnr), "mantenimiento_medidor": int(t_mant),
                "normal": int(t_normal), "visita_fallida": int(t_vf),
                "produccion": int(t_prod), "q_efectivo": int(t_q_efectivo),
                "pct_cnr": round(t_pct_cnr, 1), "pct_visita_fallida": round(t_pct_vf, 1),
            })

    return produccion


def _is_valid_time(val) -> bool:
    """Verifica si un string es una hora válida (HH:MM)."""
    if pd.isna(val) or not isinstance(val, str):
        return False
    return bool(re.match(r'^\d{1,2}:\d{2}$', val.strip()))


def _calculate_cierre_optimized(df: pd.DataFrame) -> list:
    """Calcula cierre de actividades usando operaciones vectorizadas."""
    if df.empty or 'Hora inicio' not in df.columns or 'Hora fin' not in df.columns:
        return []

    df = df[df['zona'].notna() & (df['zona'] != 'No Asignados') & df['Nombre asignado'].notna()]
    if df.empty:
        return []

    df = df.copy()

    # Validar horas
    df['hora_inicio_valid'] = df['Hora inicio'].apply(_is_valid_time)
    df['hora_fin_valid'] = df['Hora fin'].apply(_is_valid_time)
    df['hora_inicio_clean'] = df.apply(lambda r: r['Hora inicio'] if r['hora_inicio_valid'] else None, axis=1)
    df['hora_fin_clean'] = df.apply(lambda r: r['Hora fin'] if r['hora_fin_valid'] else None, axis=1)

    # Agrupar por zona y técnico
    cierre = []
    for zona in sorted(df['zona'].unique()):
        zona_df = df[df['zona'] == zona]
        for tecnico in sorted(zona_df['Nombre asignado'].unique()):
            tec_df = zona_df[zona_df['Nombre asignado'] == tecnico]

            horas_inicio = tec_df['hora_inicio_clean'].dropna()
            horas_fin = tec_df['hora_fin_clean'].dropna()

            primera = str(horas_inicio.min())[:5] if len(horas_inicio) > 0 else "-"
            ultima = str(horas_fin.max())[:5] if len(horas_fin) > 0 else "-"

            duracion = "-"
            if primera != "-" and ultima != "-":
                try:
                    h1, m1 = map(int, primera.split(':'))
                    h2, m2 = map(int, ultima.split(':'))
                    dur_min = max((h2 * 60 + m2) - (h1 * 60 + m1), 0)
                    duracion = f"{dur_min // 60}h {dur_min % 60}m"
                except:
                    pass

            cierre.append({
                "zona": zona, "tecnico": tecnico,
                "primera_actividad": primera, "ultima_actividad": ultima,
                "total_actividades": len(tec_df), "duracion_jornada": duracion,
            })

    return cierre


def _calculate_detalle_cnr_optimized(df: pd.DataFrame) -> list:
    """Calcula detalle CNR usando groupby."""
    cnr_df = df[df['Resultado visita'] == 'CNR']
    total_cnr = len(cnr_df)

    if total_cnr == 0:
        return []

    cnr_df = cnr_df[cnr_df['zona'].notna() & (cnr_df['zona'] != 'No Asignados')]

    # Agrupar por zona, técnico y tipo
    grouped = cnr_df.groupby(
        ['zona', 'Nombre asignado', 'Tipo_CNR.Tipo de CNR'],
        observed=True, dropna=False
    ).size().reset_index(name='cantidad')

    detalle = []
    for _, row in grouped.iterrows():
        tipo = row['Tipo_CNR.Tipo de CNR']
        if pd.isna(tipo) or tipo == '':
            tipo = 'Sin clasificar'

        detalle.append({
            "zona": row['zona'],
            "tipo_cnr": tipo,
            "responsable": row['Nombre asignado'],
            "cantidad": int(row['cantidad']),
            "pct_del_total": round(row['cantidad'] / total_cnr * 100, 1),
        })

    return detalle


def _calculate_campanas_optimized(df: pd.DataFrame) -> list:
    """Calcula campañas con CNR usando groupby."""
    df = df[df['zona'].notna() & (df['zona'] != 'No Asignados')]

    if df.empty or 'Descripción del aviso' not in df.columns:
        return []

    # Crear columnas de conteo
    df = df.copy()
    df['es_cnr'] = (df['Resultado visita'] == 'CNR').astype(int)
    df['es_normal'] = (df['Resultado visita'] == 'Normal').astype(int)

    grouped = df.groupby(['zona', 'Descripción del aviso'], observed=True).agg({
        'es_cnr': 'sum', 'es_normal': 'sum'
    }).reset_index()
    grouped.columns = ['zona', 'descripcion_aviso', 'cnr', 'normal']

    # Filtrar solo con CNR > 0
    grouped = grouped[grouped['cnr'] > 0]
    grouped['total'] = grouped['cnr'] + grouped['normal']
    grouped['pct_cnr'] = np.where(grouped['total'] > 0, (grouped['cnr'] / grouped['total'] * 100).round(1), 0)

    # Ordenar por CNR descendente
    grouped = grouped.sort_values('cnr', ascending=False)

    return grouped[['zona', 'descripcion_aviso', 'cnr', 'normal', 'total', 'pct_cnr']].to_dict('records')


def _calculate_resumen(df: pd.DataFrame) -> dict:
    """Calcula resumen general del día."""
    resultado = df['Resultado visita'].value_counts()

    total_cnr = int(resultado.get('CNR', 0))
    total_normal = int(resultado.get('Normal', 0))
    total_mant = int(resultado.get('Mantenimiento Medidor', 0))
    total_vf = int(resultado.get('Visita fallida', 0))

    total_produccion = total_cnr + total_normal + total_mant + total_vf
    total_efectivo = total_cnr + total_normal

    return {
        "total_produccion": total_produccion,
        "total_cnr": total_cnr,
        "total_normal": total_normal,
        "total_visita_fallida": total_vf,
        "pct_cnr_general": round((total_cnr / total_efectivo * 100) if total_efectivo > 0 else 0, 1),
        "pct_visita_fallida_general": round((total_vf / total_produccion * 100) if total_produccion > 0 else 0, 1),
    }
