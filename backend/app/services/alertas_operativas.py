import pandas as pd
import numpy as np
from datetime import date, timedelta
from typing import Dict, List


# Feriados 2026 Chile
FERIADOS_2026 = {
    date(2026, 1, 1): "Año Nuevo",
    date(2026, 4, 3): "Viernes Santo",
    date(2026, 4, 4): "Sábado Santo",
    date(2026, 5, 1): "Día del Trabajo",
    date(2026, 5, 21): "Día de las Glorias Navales",
    date(2026, 6, 29): "San Pedro y San Pablo",
    date(2026, 7, 16): "Día de la Virgen del Carmen",
    date(2026, 8, 15): "Asunción de la Virgen",
    date(2026, 9, 18): "Independencia Nacional",
    date(2026, 9, 19): "Día de las Glorias del Ejército",
    date(2026, 10, 12): "Encuentro de Dos Mundos",
    date(2026, 10, 31): "Día de las Iglesias Evangélicas",
    date(2026, 11, 1): "Día de Todos los Santos",
    date(2026, 12, 8): "Inmaculada Concepción",
    date(2026, 12, 25): "Navidad",
}


def es_dia_habil(fecha: date) -> bool:
    """Determina si un día es hábil (no es fin de semana ni feriado)."""
    # Sábado = 5, Domingo = 6
    if fecha.weekday() >= 5:
        return False
    return fecha not in FERIADOS_2026


def normalizar_nombre(nombre: str) -> str:
    """Normaliza nombres a Title Case."""
    return nombre.strip().title()


def calculate_alertas_operativas(filtered: pd.DataFrame, año: int, meses: List[str]) -> Dict:
    """
    Calcula alertas operativas para la gestión diaria.
    Identifica problemas, técnicos sin actividad, metas no cumplidas, etc.
    """
    if filtered.empty or 'Fecha ejecución' not in filtered.columns:
        return {
            "periodo": "",
            "dias_analizados": 0,
            "dias_habiles": 0,
            "resumen_alertas": {
                "tecnicos_inactivos": 0,
                "metas_no_cumplidas": 0,
                "problemas_jornada": 0,
                "alta_visita_fallida": 0,
            },
            "alertas_por_zona": [],
            "tecnicos_inactivos": [],
            "metas_no_cumplidas": [],
            "problemas_jornada": [],
            "alta_visita_fallida": [],
        }

    # Filtrar por año y mes
    df = filtered[filtered['Fecha ejecución'].dt.year == año].copy()

    if df.empty:
        return {
            "periodo": f"{año}",
            "dias_analizados": 0,
            "dias_habiles": 0,
            "resumen_alertas": {
                "tecnicos_inactivos": 0,
                "metas_no_cumplidas": 0,
                "problemas_jornada": 0,
                "alta_visita_fallida": 0,
            },
            "alertas_por_zona": [],
            "tecnicos_inactivos": [],
            "metas_no_cumplidas": [],
            "problemas_jornada": [],
            "alta_visita_fallida": [],
        }

    # Determinar período de análisis
    hoy = date.today()

    # Si hay meses filtrados, usar esos meses
    if meses and len(meses) > 0:
        meses_map = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
            'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
        }
        meses_num = [meses_map.get(m.lower(), 0) for m in meses if m.lower() in meses_map]
        meses_num = [m for m in meses_num if m > 0]

        if meses_num:
            df = df[df['Fecha ejecución'].dt.month.isin(meses_num)]
            meses_nombres = [m.capitalize() for m in meses if m.lower() in meses_map]
            periodo_str = f"{', '.join(meses_nombres)} {año}"
        else:
            periodo_str = f"{año}"
    else:
        # Sin filtro de mes: analizar últimos 7 días con datos
        fechas_disponibles = sorted(df['Fecha ejecución'].dt.date.unique())
        if len(fechas_disponibles) >= 7:
            fecha_inicio = fechas_disponibles[-7]
            df = df[df['Fecha ejecución'].dt.date >= fecha_inicio]
            periodo_str = f"Últimos 7 días ({fecha_inicio.strftime('%d/%m/%Y')} - {fechas_disponibles[-1].strftime('%d/%m/%Y')})"
        else:
            periodo_str = f"Últimos {len(fechas_disponibles)} días disponibles"

    if df.empty:
        return {
            "periodo": periodo_str,
            "dias_analizados": 0,
            "dias_habiles": 0,
            "resumen_alertas": {
                "tecnicos_inactivos": 0,
                "metas_no_cumplidas": 0,
                "problemas_jornada": 0,
                "alta_visita_fallida": 0,
            },
            "alertas_por_zona": [],
            "tecnicos_inactivos": [],
            "metas_no_cumplidas": [],
            "problemas_jornada": [],
            "alta_visita_fallida": [],
        }

    # Normalizar nombres
    df['Nombre asignado'] = df['Nombre asignado'].apply(normalizar_nombre)

    # Calcular días del período
    fechas_unicas = sorted(df['Fecha ejecución'].dt.date.unique())
    fecha_inicio = fechas_unicas[0]
    fecha_fin = fechas_unicas[-1]

    dias_analizados = (fecha_fin - fecha_inicio).days + 1
    dias_habiles = sum(1 for i in range(dias_analizados) if es_dia_habil(fecha_inicio + timedelta(days=i)))

    # Filtrar datos válidos
    # IMPORTANTE: Usar zona_tecnico para alertas de técnicos (gestión de personas)
    df = df[df['zona_tecnico'].notna() & (df['zona_tecnico'] != 'No Asignados') & df['Nombre asignado'].notna()]

    if df.empty:
        return {
            "periodo": periodo_str,
            "dias_analizados": dias_analizados,
            "dias_habiles": dias_habiles,
            "resumen_alertas": {
                "tecnicos_inactivos": 0,
                "metas_no_cumplidas": 0,
                "problemas_jornada": 0,
                "alta_visita_fallida": 0,
            },
            "alertas_por_zona": [],
            "tecnicos_inactivos": [],
            "metas_no_cumplidas": [],
            "problemas_jornada": [],
            "alta_visita_fallida": [],
        }

    # 1. TÉCNICOS INACTIVOS (días no trabajados)
    # Agrupar por zona_tecnico (zona de origen del técnico)
    tecnicos_inactivos = []

    for zona_tecnico in sorted(df['zona_tecnico'].unique()):
        zona_df = df[df['zona_tecnico'] == zona_tecnico]
        tecnicos_zona = zona_df['Nombre asignado'].unique()

        for tecnico in tecnicos_zona:
            tec_df = zona_df[zona_df['Nombre asignado'] == tecnico]

            # Obtener fechas trabajadas
            fechas_trabajadas = set(tec_df['Fecha ejecución'].dt.date.unique())

            # Calcular días hábiles no trabajados
            dias_no_trabajados = []
            for i in range(dias_analizados):
                fecha = fecha_inicio + timedelta(days=i)
                if es_dia_habil(fecha) and fecha not in fechas_trabajadas:
                    dias_no_trabajados.append(fecha)

            # Alerta si tiene más de 2 días hábiles sin trabajar
            if len(dias_no_trabajados) >= 2:
                tecnicos_inactivos.append({
                    "zona": zona_tecnico,  # Zona de origen del técnico
                    "tecnico": tecnico,
                    "dias_trabajados": len(fechas_trabajadas),
                    "dias_no_trabajados": len(dias_no_trabajados),
                    "pct_ausentismo": round((len(dias_no_trabajados) / dias_habiles * 100) if dias_habiles > 0 else 0, 1),
                    "ultima_actividad": max(fechas_trabajadas).strftime('%d/%m/%Y') if fechas_trabajadas else "-",
                    "fechas_trabajadas": [f.strftime('%Y-%m-%d') for f in sorted(fechas_trabajadas)],
                    "fecha_inicio": fecha_inicio.strftime('%Y-%m-%d'),
                    "fecha_fin": fecha_fin.strftime('%Y-%m-%d'),
                })

    # 2. METAS NO CUMPLIDAS (CNR < 2 o Efectivas < 8 por día)
    # Agrupar por zona_tecnico (metas son responsabilidad del supervisor de la zona del técnico)
    metas_no_cumplidas = []

    # Agrupar por zona_tecnico, técnico y fecha
    df['es_cnr'] = (df['Resultado visita'] == 'CNR').astype(int)
    df['es_normal'] = (df['Resultado visita'] == 'Normal').astype(int)
    df['es_mant'] = (df['Resultado visita'] == 'Mantenimiento Medidor').astype(int)

    daily_performance = df.groupby(['zona_tecnico', 'Nombre asignado', df['Fecha ejecución'].dt.date], observed=True).agg({
        'es_cnr': 'sum',
        'es_normal': 'sum',
        'es_mant': 'sum',
    }).reset_index()
    daily_performance.columns = ['zona_tecnico', 'tecnico', 'fecha', 'cnr', 'normal', 'mant']
    daily_performance['efectivas'] = daily_performance['cnr'] + daily_performance['normal'] + daily_performance['mant']

    # Técnicos con bajo rendimiento (promedio en el período)
    tec_performance = daily_performance.groupby(['zona_tecnico', 'tecnico'], observed=True).agg({
        'cnr': 'mean',
        'efectivas': 'mean',
        'fecha': 'count'
    }).reset_index()
    tec_performance.columns = ['zona_tecnico', 'tecnico', 'promedio_cnr', 'promedio_efectivas', 'dias_trabajados']

    for _, row in tec_performance.iterrows():
        problemas = []
        if row['promedio_cnr'] < 2:
            problemas.append(f"CNR promedio: {row['promedio_cnr']:.1f} (meta: 2)")
        if row['promedio_efectivas'] < 8:
            problemas.append(f"Efectivas promedio: {row['promedio_efectivas']:.1f} (meta: 8)")

        if problemas:
            metas_no_cumplidas.append({
                "zona": row['zona_tecnico'],  # Zona de origen del técnico
                "tecnico": row['tecnico'],
                "promedio_cnr": round(row['promedio_cnr'], 1),
                "promedio_efectivas": round(row['promedio_efectivas'], 1),
                "dias_trabajados": int(row['dias_trabajados']),
                "problemas": ", ".join(problemas),
                "gravedad": "alta" if row['promedio_cnr'] < 1 or row['promedio_efectivas'] < 5 else "media",
            })

    # 3. PROBLEMAS DE JORNADA
    # Agrupar por zona_tecnico (jornada es responsabilidad del supervisor de la zona del técnico)
    problemas_jornada = []

    if 'Hora inicio' in df.columns and 'Hora fin' in df.columns:
        for zona_tecnico in sorted(df['zona_tecnico'].unique()):
            zona_df = df[df['zona_tecnico'] == zona_tecnico]

            for tecnico in zona_df['Nombre asignado'].unique():
                tec_df = zona_df[zona_df['Nombre asignado'] == tecnico]

                # Analizar horarios
                horas_inicio_validas = []
                horas_fin_validas = []
                duraciones = []

                for _, row in tec_df.iterrows():
                    try:
                        if pd.notna(row['Hora inicio']) and isinstance(row['Hora inicio'], str):
                            h, m = map(int, str(row['Hora inicio']).split(':')[:2])
                            horas_inicio_validas.append(h * 60 + m)

                        if pd.notna(row['Hora fin']) and isinstance(row['Hora fin'], str):
                            h, m = map(int, str(row['Hora fin']).split(':')[:2])
                            horas_fin_validas.append(h * 60 + m)

                        if (pd.notna(row['Hora inicio']) and pd.notna(row['Hora fin']) and
                            isinstance(row['Hora inicio'], str) and isinstance(row['Hora fin'], str)):
                            h1, m1 = map(int, str(row['Hora inicio']).split(':')[:2])
                            h2, m2 = map(int, str(row['Hora fin']).split(':')[:2])
                            dur = (h2 * 60 + m2) - (h1 * 60 + m1)
                            if dur > 0:
                                duraciones.append(dur)
                    except:
                        continue

                if len(horas_inicio_validas) > 0:
                    problemas_tec = []

                    # Contar días con cada problema
                    dias_inicio_tardio = sum(1 for h in horas_inicio_validas if h > 540)  # 9:00 AM
                    dias_cierre_temprano = sum(1 for h in horas_fin_validas if h < 1020)  # 17:00
                    dias_jornada_corta = sum(1 for d in duraciones if d < 360)  # 6 horas

                    total_dias = len(horas_inicio_validas)

                    # Inicio tardío (después de las 9:00 AM = 540 minutos)
                    promedio_inicio = np.mean(horas_inicio_validas)
                    if dias_inicio_tardio > 0:
                        hora_inicio_str = f"{int(promedio_inicio // 60):02d}:{int(promedio_inicio % 60):02d}"
                        problemas_tec.append(f"Inicio tardío: {dias_inicio_tardio} días")

                    # Cierre temprano (antes de las 17:00 = 1020 minutos)
                    if len(horas_fin_validas) > 0:
                        promedio_fin = np.mean(horas_fin_validas)
                        if dias_cierre_temprano > 0:
                            hora_fin_str = f"{int(promedio_fin // 60):02d}:{int(promedio_fin % 60):02d}"
                            problemas_tec.append(f"Cierre temprano: {dias_cierre_temprano} días")

                    # Jornada muy corta (menos de 6 horas = 360 minutos)
                    if len(duraciones) > 0:
                        promedio_duracion = np.mean(duraciones)
                        if dias_jornada_corta > 0:
                            dur_horas = promedio_duracion / 60
                            problemas_tec.append(f"Jornada corta: {dias_jornada_corta} días")

                    if problemas_tec:
                        problemas_jornada.append({
                            "zona": zona_tecnico,  # Zona de origen del técnico
                            "tecnico": tecnico,
                            "promedio_inicio": f"{int(promedio_inicio // 60):02d}:{int(promedio_inicio % 60):02d}",
                            "promedio_fin": f"{int(np.mean(horas_fin_validas) // 60):02d}:{int(np.mean(horas_fin_validas) % 60):02d}" if len(horas_fin_validas) > 0 else "-",
                            "promedio_duracion": f"{np.mean(duraciones) / 60:.1f}h" if len(duraciones) > 0 else "-",
                            "dias_inicio_tardio": dias_inicio_tardio,
                            "dias_cierre_temprano": dias_cierre_temprano,
                            "dias_jornada_corta": dias_jornada_corta,
                            "total_dias": total_dias,
                            "problemas": ", ".join(problemas_tec),
                        })

    # 4. ALTA VISITA FALLIDA
    # Agrupar por zona_tecnico (visitas fallidas son responsabilidad del supervisor de la zona del técnico)
    alta_visita_fallida = []

    df['es_vf'] = (df['Resultado visita'] == 'Visita fallida').astype(int)

    vf_performance = df.groupby(['zona_tecnico', 'Nombre asignado'], observed=True).agg({
        'es_vf': 'sum',
        'Resultado visita': 'count'
    }).reset_index()
    vf_performance.columns = ['zona_tecnico', 'tecnico', 'visitas_fallidas', 'total_visitas']
    vf_performance['pct_vf'] = (vf_performance['visitas_fallidas'] / vf_performance['total_visitas'] * 100).round(1)

    # Alerta si VF > 30%
    alta_vf = vf_performance[vf_performance['pct_vf'] > 30].copy()

    for _, row in alta_vf.iterrows():
        alta_visita_fallida.append({
            "zona": row['zona_tecnico'],  # Zona de origen del técnico
            "tecnico": row['tecnico'],
            "visitas_fallidas": int(row['visitas_fallidas']),
            "total_visitas": int(row['total_visitas']),
            "pct_vf": round(row['pct_vf'], 1),
            "gravedad": "alta" if row['pct_vf'] > 40 else "media",
        })

    # 5. RESUMEN POR ZONA
    # Agrupar por zona_tecnico (resumen por zona de origen de técnicos)
    alertas_por_zona = []

    for zona_tecnico in sorted(df['zona_tecnico'].unique()):
        zona_inactivos = [t for t in tecnicos_inactivos if t['zona'] == zona_tecnico]
        zona_metas = [t for t in metas_no_cumplidas if t['zona'] == zona_tecnico]
        zona_jornada = [t for t in problemas_jornada if t['zona'] == zona_tecnico]
        zona_vf = [t for t in alta_visita_fallida if t['zona'] == zona_tecnico]

        total_alertas = len(zona_inactivos) + len(zona_metas) + len(zona_jornada) + len(zona_vf)

        # Determinar gravedad de la zona
        alertas_altas = sum(1 for m in zona_metas if m.get('gravedad') == 'alta') + \
                        sum(1 for v in zona_vf if v.get('gravedad') == 'alta')

        if alertas_altas >= 3 or total_alertas >= 8:
            gravedad = "critica"
        elif alertas_altas >= 1 or total_alertas >= 4:
            gravedad = "alta"
        elif total_alertas >= 2:
            gravedad = "media"
        else:
            gravedad = "baja"

        alertas_por_zona.append({
            "zona": zona_tecnico,  # Zona de origen de los técnicos
            "total_alertas": total_alertas,
            "tecnicos_inactivos": len(zona_inactivos),
            "metas_no_cumplidas": len(zona_metas),
            "problemas_jornada": len(zona_jornada),
            "alta_visita_fallida": len(zona_vf),
            "gravedad": gravedad,
        })

    # Ordenar alertas por zona alfabéticamente
    alertas_por_zona = sorted(alertas_por_zona, key=lambda x: x['zona'])

    # Ordenar técnicos por zona primero, luego por métrica
    tecnicos_inactivos = sorted(tecnicos_inactivos, key=lambda x: (x['zona'], -x['dias_no_trabajados']))
    metas_no_cumplidas = sorted(metas_no_cumplidas, key=lambda x: (
        x['zona'], {"alta": 0, "media": 1}[x['gravedad']], x['promedio_cnr']
    ))
    problemas_jornada = sorted(problemas_jornada, key=lambda x: x['zona'])
    alta_visita_fallida = sorted(alta_visita_fallida, key=lambda x: (x['zona'], -x['pct_vf']))

    return {
        "periodo": periodo_str,
        "dias_analizados": dias_analizados,
        "dias_habiles": dias_habiles,
        "resumen_alertas": {
            "tecnicos_inactivos": len(tecnicos_inactivos),
            "metas_no_cumplidas": len(metas_no_cumplidas),
            "problemas_jornada": len(problemas_jornada),
            "alta_visita_fallida": len(alta_visita_fallida),
        },
        "alertas_por_zona": alertas_por_zona,
        "tecnicos_inactivos": tecnicos_inactivos,
        "metas_no_cumplidas": metas_no_cumplidas,
        "problemas_jornada": problemas_jornada,
        "alta_visita_fallida": alta_visita_fallida,
    }
