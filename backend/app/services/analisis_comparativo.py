import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List


def calcular_metricas_periodo(df: pd.DataFrame) -> Dict:
    """Calcula métricas agregadas para un período."""
    if df.empty:
        return {
            "total_cnr": 0,
            "total_normal": 0,
            "total_efectivas": 0,
            "total_vf": 0,
            "total_produccion": 0,
            "pct_cnr": 0,
            "pct_efectivas": 0,
            "pct_vf": 0,
        }

    resultado = df['Resultado visita'].value_counts()
    total_cnr = int(resultado.get('CNR', 0))
    total_normal = int(resultado.get('Normal', 0))
    total_vf = int(resultado.get('Visita fallida', 0))
    total_mant = int(resultado.get('Mantenimiento Medidor', 0))

    total_efectivas = total_cnr + total_normal
    total_produccion = total_efectivas + total_vf + total_mant

    return {
        "total_cnr": total_cnr,
        "total_normal": total_normal,
        "total_efectivas": total_efectivas,
        "total_vf": total_vf,
        "total_produccion": total_produccion,
        "pct_cnr": round((total_cnr / total_efectivas * 100) if total_efectivas > 0 else 0, 1),
        "pct_efectivas": round((total_efectivas / total_produccion * 100) if total_produccion > 0 else 0, 1),
        "pct_vf": round((total_vf / total_produccion * 100) if total_produccion > 0 else 0, 1),
    }


def calcular_metricas_por_zona(df: pd.DataFrame) -> List[Dict]:
    """Calcula métricas por zona para un período."""
    if df.empty:
        return []

    df_filtrado = df[df['zona'].notna() & (df['zona'] != 'No Asignados')]
    if df_filtrado.empty:
        return []

    resultados = []
    for zona in sorted(df_filtrado['zona'].unique()):
        zona_df = df_filtrado[df_filtrado['zona'] == zona]
        resultado = zona_df['Resultado visita'].value_counts()

        cnr = int(resultado.get('CNR', 0))
        normal = int(resultado.get('Normal', 0))
        vf = int(resultado.get('Visita fallida', 0))
        mant = int(resultado.get('Mantenimiento Medidor', 0))

        efectivas = cnr + normal
        produccion = efectivas + vf + mant

        resultados.append({
            "zona": zona,
            "cnr": cnr,
            "normal": normal,
            "efectivas": efectivas,
            "vf": vf,
            "produccion": produccion,
            "pct_cnr": round((cnr / efectivas * 100) if efectivas > 0 else 0, 1),
            "pct_efectivas": round((efectivas / produccion * 100) if produccion > 0 else 0, 1),
            "pct_vf": round((vf / produccion * 100) if produccion > 0 else 0, 1),
        })

    return resultados


def calcular_metricas_por_tecnico(df: pd.DataFrame) -> List[Dict]:
    """Calcula métricas por técnico para un período."""
    if df.empty:
        return []

    df_filtrado = df[
        df['zona'].notna() &
        (df['zona'] != 'No Asignados') &
        df['Nombre asignado'].notna()
    ].copy()

    if df_filtrado.empty:
        return []

    # Normalizar nombres
    df_filtrado['Nombre asignado'] = df_filtrado['Nombre asignado'].str.strip().str.title()

    resultados = []
    for (zona, nombre) in df_filtrado.groupby(['zona', 'Nombre asignado'], observed=True).size().index:
        tec_df = df_filtrado[
            (df_filtrado['zona'] == zona) &
            (df_filtrado['Nombre asignado'] == nombre)
        ]

        resultado = tec_df['Resultado visita'].value_counts()
        cnr = int(resultado.get('CNR', 0))
        normal = int(resultado.get('Normal', 0))
        vf = int(resultado.get('Visita fallida', 0))
        mant = int(resultado.get('Mantenimiento Medidor', 0))

        efectivas = cnr + normal
        produccion = efectivas + vf + mant

        if produccion == 0:  # Saltar técnicos sin producción
            continue

        resultados.append({
            "zona": zona,
            "nombre": nombre,
            "cnr": cnr,
            "efectivas": efectivas,
            "vf": vf,
            "produccion": produccion,
            "pct_cnr": round((cnr / efectivas * 100) if efectivas > 0 else 0, 1),
            "pct_efectivas": round((efectivas / produccion * 100) if produccion > 0 else 0, 1),
            "pct_vf": round((vf / produccion * 100) if produccion > 0 else 0, 1),
        })

    return resultados


def determinar_periodos(df: pd.DataFrame, año: int, meses: List[str]) -> tuple:
    """
    Determina los períodos a comparar basándose en los filtros.
    Retorna (df_actual, df_anterior, periodo_actual_str, periodo_anterior_str)
    """
    if df.empty or 'Fecha ejecución' not in df.columns:
        return None, None, "", ""

    # Filtrar por año
    df = df[df['Fecha ejecución'].dt.year == año].copy()

    if df.empty:
        return None, None, "", ""

    # Convertir meses a números
    meses_map = {
        'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
        'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
    }

    meses_num = sorted([meses_map.get(m.lower(), 0) for m in meses if m.lower() in meses_map])
    meses_num = [m for m in meses_num if m > 0]

    if len(meses_num) == 0:
        # Sin filtro de mes, tomar todos los meses disponibles y dividir
        fechas_disponibles = df['Fecha ejecución'].dt.to_period('M').unique()
        if len(fechas_disponibles) < 2:
            return None, None, "", ""

        fechas_ordenadas = sorted(fechas_disponibles)
        punto_medio = len(fechas_ordenadas) // 2

        periodos_anteriores = fechas_ordenadas[:punto_medio]
        periodos_actuales = fechas_ordenadas[punto_medio:]

        df_anterior = df[df['Fecha ejecución'].dt.to_period('M').isin(periodos_anteriores)]
        df_actual = df[df['Fecha ejecución'].dt.to_period('M').isin(periodos_actuales)]

        periodo_anterior_str = f"{periodos_anteriores[0].strftime('%m/%Y')} - {periodos_anteriores[-1].strftime('%m/%Y')}"
        periodo_actual_str = f"{periodos_actuales[0].strftime('%m/%Y')} - {periodos_actuales[-1].strftime('%m/%Y')}"

    elif len(meses_num) == 1:
        # Un solo mes seleccionado: comparar con el mes anterior
        mes_actual = meses_num[0]
        mes_anterior = mes_actual - 1 if mes_actual > 1 else 12
        año_anterior = año if mes_actual > 1 else año - 1

        df_actual = df[df['Fecha ejecución'].dt.month == mes_actual]
        df_anterior = df[
            (df['Fecha ejecución'].dt.month == mes_anterior) &
            (df['Fecha ejecución'].dt.year == año_anterior)
        ]

        # Si no hay datos del mes anterior del mismo dataset, buscar en el año anterior
        if df_anterior.empty and año_anterior != año:
            df_completo_anterior = df  # Aquí necesitaríamos el dataset completo
            df_anterior = df_completo_anterior[
                (df_completo_anterior['Fecha ejecución'].dt.month == mes_anterior) &
                (df_completo_anterior['Fecha ejecución'].dt.year == año_anterior)
            ]

        meses_nombres = {v: k.capitalize() for k, v in meses_map.items()}
        periodo_actual_str = f"{meses_nombres[mes_actual]} {año}"
        periodo_anterior_str = f"{meses_nombres[mes_anterior]} {año_anterior}"

    else:
        # Múltiples meses: dividir en dos grupos (primera mitad vs segunda mitad)
        punto_medio = len(meses_num) // 2
        meses_anteriores = meses_num[:punto_medio]
        meses_actuales = meses_num[punto_medio:]

        df_anterior = df[df['Fecha ejecución'].dt.month.isin(meses_anteriores)]
        df_actual = df[df['Fecha ejecución'].dt.month.isin(meses_actuales)]

        meses_nombres = {v: k.capitalize() for k, v in meses_map.items()}
        periodo_anterior_str = ", ".join([meses_nombres[m] for m in meses_anteriores]) + f" {año}"
        periodo_actual_str = ", ".join([meses_nombres[m] for m in meses_actuales]) + f" {año}"

    return df_actual, df_anterior, periodo_actual_str, periodo_anterior_str


def calculate_analisis_comparativo(filtered: pd.DataFrame, año: int, meses: List[str]) -> Dict:
    """
    Calcula un análisis comparativo real entre dos períodos.
    """
    # Determinar períodos
    df_actual, df_anterior, periodo_actual_str, periodo_anterior_str = determinar_periodos(
        filtered, año, meses
    )

    if df_actual is None or df_anterior is None or df_actual.empty or df_anterior.empty:
        return {
            "periodo_actual": "",
            "periodo_anterior": "",
            "resumen": {
                "total_cnr_actual": 0,
                "total_cnr_anterior": 0,
                "variacion_cnr": 0,
                "total_efectivas_actual": 0,
                "total_efectivas_anterior": 0,
                "variacion_efectivas": 0,
                "total_vf_actual": 0,
                "total_vf_anterior": 0,
                "variacion_vf": 0,
            },
            "zonas": [],
            "tecnicos_mejorando": [],
            "tecnicos_cayendo": [],
        }

    # Calcular métricas generales
    metricas_actual = calcular_metricas_periodo(df_actual)
    metricas_anterior = calcular_metricas_periodo(df_anterior)

    # Calcular métricas por zona
    zonas_actual = {z['zona']: z for z in calcular_metricas_por_zona(df_actual)}
    zonas_anterior = {z['zona']: z for z in calcular_metricas_por_zona(df_anterior)}

    # Combinar zonas
    todas_zonas = set(zonas_actual.keys()) | set(zonas_anterior.keys())
    zonas_comparadas = []

    for zona in sorted(todas_zonas):
        actual = zonas_actual.get(zona, {
            "cnr": 0, "efectivas": 0, "vf": 0, "pct_cnr": 0, "pct_efectivas": 0
        })
        anterior = zonas_anterior.get(zona, {
            "cnr": 0, "efectivas": 0, "vf": 0, "pct_cnr": 0, "pct_efectivas": 0
        })

        zonas_comparadas.append({
            "zona": zona,
            "actual": {
                "cnr": actual["cnr"],
                "efectivas": actual["efectivas"],
                "visita_fallida": actual.get("vf", 0),
                "pct_cnr": actual["pct_cnr"],
                "pct_efectivas": actual["pct_efectivas"],
            },
            "anterior": {
                "cnr": anterior["cnr"],
                "efectivas": anterior["efectivas"],
                "visita_fallida": anterior.get("vf", 0),
                "pct_cnr": anterior["pct_cnr"],
                "pct_efectivas": anterior["pct_efectivas"],
            },
            "variacion": {
                "cnr": actual["cnr"] - anterior["cnr"],
                "efectivas": actual["efectivas"] - anterior["efectivas"],
                "visita_fallida": actual.get("vf", 0) - anterior.get("vf", 0),
                "pct_cnr": round(actual["pct_cnr"] - anterior["pct_cnr"], 1),
                "pct_efectivas": round(actual["pct_efectivas"] - anterior["pct_efectivas"], 1),
            }
        })

    # Calcular métricas por técnico
    tecnicos_actual = calcular_metricas_por_tecnico(df_actual)
    tecnicos_anterior = calcular_metricas_por_tecnico(df_anterior)

    # Crear mapa de técnicos anteriores
    tec_anterior_map = {
        f"{t['zona']}_{t['nombre']}": t for t in tecnicos_anterior
    }

    # Comparar técnicos (solo los que aparecen en ambos períodos)
    tecnicos_comparados = []
    for tec_act in tecnicos_actual:
        key = f"{tec_act['zona']}_{tec_act['nombre']}"
        tec_ant = tec_anterior_map.get(key)

        if tec_ant:
            var_cnr = tec_act['cnr'] - tec_ant['cnr']
            var_efectivas = tec_act['efectivas'] - tec_ant['efectivas']
            var_pct_efectivas = tec_act['pct_efectivas'] - tec_ant['pct_efectivas']

            # Determinar tendencia
            if var_cnr > 0 and var_pct_efectivas >= 0:
                tendencia = 'mejorando'
            elif var_cnr < 0 or var_pct_efectivas < -5:
                tendencia = 'cayendo'
            else:
                tendencia = 'estable'

            tecnicos_comparados.append({
                "zona": tec_act['zona'],
                "nombre": tec_act['nombre'],
                "actual_cnr": tec_act['cnr'],
                "anterior_cnr": tec_ant['cnr'],
                "variacion_cnr": var_cnr,
                "actual_efectivas": tec_act['efectivas'],
                "anterior_efectivas": tec_ant['efectivas'],
                "variacion_efectivas": var_efectivas,
                "actual_pct_efectivas": tec_act['pct_efectivas'],
                "anterior_pct_efectivas": tec_ant['pct_efectivas'],
                "variacion_pct_efectivas": round(var_pct_efectivas, 1),
                "tendencia": tendencia,
            })

    # Filtrar técnicos mejorando y cayendo
    tecnicos_mejorando = sorted(
        [t for t in tecnicos_comparados if t['tendencia'] == 'mejorando'],
        key=lambda x: x['variacion_cnr'],
        reverse=True
    )[:15]

    tecnicos_cayendo = sorted(
        [t for t in tecnicos_comparados if t['tendencia'] == 'cayendo'],
        key=lambda x: x['variacion_cnr']
    )[:15]

    return {
        "periodo_actual": periodo_actual_str,
        "periodo_anterior": periodo_anterior_str,
        "resumen": {
            "total_cnr_actual": metricas_actual["total_cnr"],
            "total_cnr_anterior": metricas_anterior["total_cnr"],
            "variacion_cnr": metricas_actual["total_cnr"] - metricas_anterior["total_cnr"],
            "total_efectivas_actual": metricas_actual["total_efectivas"],
            "total_efectivas_anterior": metricas_anterior["total_efectivas"],
            "variacion_efectivas": metricas_actual["total_efectivas"] - metricas_anterior["total_efectivas"],
            "total_vf_actual": metricas_actual["total_vf"],
            "total_vf_anterior": metricas_anterior["total_vf"],
            "variacion_vf": metricas_actual["total_vf"] - metricas_anterior["total_vf"],
        },
        "zonas": zonas_comparadas,
        "tecnicos_mejorando": tecnicos_mejorando,
        "tecnicos_cayendo": tecnicos_cayendo,
    }
