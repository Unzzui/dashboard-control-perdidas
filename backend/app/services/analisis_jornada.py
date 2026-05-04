"""
Análisis de jornada agregado mensual: por (técnico, fecha) calcula la jornada,
luego promedia por técnico y agrupa por zona.
"""
import re
import pandas as pd

from app.services.control_diario import normalizar_nombre


def _is_valid_time(val) -> bool:
    if pd.isna(val) or not isinstance(val, str):
        return False
    return bool(re.match(r"^\d{1,2}:\d{2}$", val.strip()))


def _hora_a_min(hora: str) -> int:
    h, m = hora.split(":")
    return int(h) * 60 + int(m or 0)


def _min_a_hora(minutos: float) -> str:
    if pd.isna(minutos) or minutos < 0:
        return "—"
    h = int(minutos // 60)
    m = int(round(minutos % 60))
    return f"{h:02d}:{m:02d}"


def calculate_analisis_jornada_mensual(filtered: pd.DataFrame) -> dict:
    """
    Devuelve análisis de jornada agregado para el periodo filtrado.

    Estructura:
    {
        "periodo": "Marzo 2026 (22 días)",
        "total_dias": 22,
        "total_jornadas": int,
        "total_tecnicos": int,
        "stats_globales": { ... },
        "por_zona": [
            {
                "zona": str,
                "tecnicos": int,
                "dias_trabajados": int,
                "duracion_promedio_min": float,
                "productividad_promedio": float,
                "hora_inicio_promedio": "HH:MM",
                "hora_fin_promedio": "HH:MM",
                "actividades_total": int,
                "jornadas_cortas": int,
                "pct_jornadas_cortas": float,
                "tecnicos_detalle": [ {nombre, dias_trabajados, ...}, ... ]
            }, ...
        ]
    }
    """
    empty = {
        "periodo": "Sin datos",
        "total_dias": 0,
        "total_jornadas": 0,
        "total_tecnicos": 0,
        "stats_globales": _empty_stats(),
        "por_zona": [],
    }

    if filtered.empty or "Fecha ejecución" not in filtered.columns:
        return empty

    df = filtered.copy()
    df = df[df["Fecha ejecución"].notna()]
    df = df[df["Nombre asignado"].notna() & (~df["Nombre asignado"].fillna("").str.contains("BOT", case=False))]
    df = df[df["zona"].notna() & (df["zona"] != "No Asignados")]
    if df.empty:
        return empty

    # Validar y normalizar horas
    df["hora_inicio_valid"] = df["Hora inicio"].apply(_is_valid_time)
    df["hora_fin_valid"] = df["Hora fin"].apply(_is_valid_time)
    df = df[df["hora_inicio_valid"] & df["hora_fin_valid"]]
    if df.empty:
        return empty

    df["Nombre asignado"] = df["Nombre asignado"].apply(normalizar_nombre)
    df["fecha_date"] = df["Fecha ejecución"].dt.date
    df["inicio_min"] = df["Hora inicio"].apply(_hora_a_min)
    df["fin_min"] = df["Hora fin"].apply(_hora_a_min)

    # Una jornada = (zona, técnico, fecha)
    jornadas = (
        df.groupby(["zona", "Nombre asignado", "fecha_date"], observed=True)
        .agg(
            primera=("inicio_min", "min"),
            ultima=("fin_min", "max"),
            actividades=("Nombre asignado", "count"),
        )
        .reset_index()
    )
    jornadas["duracion_min"] = (jornadas["ultima"] - jornadas["primera"]).clip(lower=0)
    jornadas["productividad_hora"] = jornadas.apply(
        lambda r: r["actividades"] / (r["duracion_min"] / 60) if r["duracion_min"] > 0 else 0,
        axis=1,
    )
    jornadas["es_corta"] = (jornadas["duracion_min"] < 360).astype(int)

    total_jornadas = len(jornadas)
    total_dias = jornadas["fecha_date"].nunique()
    total_tecnicos = jornadas["Nombre asignado"].nunique()

    # Stats globales
    stats_globales = {
        "duracion_promedio_min": float(round(jornadas["duracion_min"].mean(), 1)),
        "productividad_promedio": float(round(jornadas["productividad_hora"].mean(), 2)),
        "hora_inicio_promedio": _min_a_hora(jornadas["primera"].mean()),
        "hora_fin_promedio": _min_a_hora(jornadas["ultima"].mean()),
        "jornadas_cortas": int(jornadas["es_corta"].sum()),
        "pct_jornadas_cortas": float(round(jornadas["es_corta"].sum() / total_jornadas * 100, 1)) if total_jornadas else 0,
        "actividades_total": int(jornadas["actividades"].sum()),
        "actividades_promedio_jornada": float(round(jornadas["actividades"].mean(), 1)),
    }

    # Por técnico
    por_tecnico = (
        jornadas.groupby(["zona", "Nombre asignado"], observed=True)
        .agg(
            dias_trabajados=("fecha_date", "nunique"),
            duracion_promedio_min=("duracion_min", "mean"),
            productividad_promedio=("productividad_hora", "mean"),
            primera_promedio=("primera", "mean"),
            ultima_promedio=("ultima", "mean"),
            actividades_total=("actividades", "sum"),
            actividades_promedio=("actividades", "mean"),
            jornadas_cortas=("es_corta", "sum"),
        )
        .reset_index()
    )
    por_tecnico["pct_jornadas_cortas"] = (
        por_tecnico["jornadas_cortas"] / por_tecnico["dias_trabajados"] * 100
    ).round(1)

    # Promedios globales (sobre todos los técnicos / todas las jornadas) para
    # calcular deltas vs el global y poder identificar zonas atípicas.
    prod_media_global = float(por_tecnico["productividad_promedio"].mean()) if len(por_tecnico) else 0.0
    cortas_media_global = float(por_tecnico["pct_jornadas_cortas"].mean()) if len(por_tecnico) else 0.0

    # Por zona — con detección de outliers (z-score vs su zona)
    por_zona_lista = []
    for zona in sorted(jornadas["zona"].unique()):
        zona_jorn = jornadas[jornadas["zona"] == zona]
        zona_tec = por_tecnico[por_tecnico["zona"] == zona].sort_values(
            "productividad_promedio", ascending=False
        )
        n_tec = len(zona_tec)
        if n_tec == 0:
            continue

        # Estadística de la zona para z-score
        prod_media = float(zona_tec["productividad_promedio"].mean())
        prod_std = float(zona_tec["productividad_promedio"].std()) if n_tec > 1 else 0.0
        cortas_media = float(zona_tec["pct_jornadas_cortas"].mean())
        cortas_std = float(zona_tec["pct_jornadas_cortas"].std()) if n_tec > 1 else 0.0

        tecnicos_detalle = []
        n_criticos = 0
        n_alertas = 0
        for _, t in zona_tec.iterrows():
            prod_val = float(t["productividad_promedio"])
            cortas_val = float(t["pct_jornadas_cortas"]) if pd.notna(t["pct_jornadas_cortas"]) else 0.0

            prod_status = _clasificar_outlier(prod_val, prod_media, prod_std, invertido=False)
            cortas_status = _clasificar_outlier(cortas_val, cortas_media, cortas_std, invertido=True)

            severidad = _severidad_max(prod_status, cortas_status)
            if severidad == "critico":
                n_criticos += 1
            elif severidad == "alerta":
                n_alertas += 1

            tecnicos_detalle.append({
                "nombre": t["Nombre asignado"],
                "dias_trabajados": int(t["dias_trabajados"]),
                "duracion_promedio_min": float(round(t["duracion_promedio_min"], 1)),
                "productividad_promedio": float(round(prod_val, 2)),
                "hora_inicio_promedio": _min_a_hora(t["primera_promedio"]),
                "hora_fin_promedio": _min_a_hora(t["ultima_promedio"]),
                "actividades_total": int(t["actividades_total"]),
                "actividades_promedio": float(round(t["actividades_promedio"], 1)),
                "jornadas_cortas": int(t["jornadas_cortas"]),
                "pct_jornadas_cortas": float(round(cortas_val, 1)),
                # Outliers vs zona
                "productividad_status": prod_status,
                "jornadas_cortas_status": cortas_status,
                "severidad": severidad,
                "delta_productividad_pct": float(round((prod_val - prod_media) / prod_media * 100, 1)) if prod_media > 0 else 0.0,
                "delta_jornadas_cortas_pp": float(round(cortas_val - cortas_media, 1)),
                # Deltas vs el global (todas las zonas)
                "delta_productividad_global_pct": float(round((prod_val - prod_media_global) / prod_media_global * 100, 1)) if prod_media_global > 0 else 0.0,
                "delta_jornadas_cortas_global_pp": float(round(cortas_val - cortas_media_global, 1)),
            })

        zona_prod = float(round(zona_jorn["productividad_hora"].mean(), 2))
        zona_cortas = float(round(zona_jorn["es_corta"].sum() / len(zona_jorn) * 100, 1))
        por_zona_lista.append({
            "zona": str(zona),
            "tecnicos": n_tec,
            "dias_trabajados": int(zona_jorn["fecha_date"].nunique()),
            "duracion_promedio_min": float(round(zona_jorn["duracion_min"].mean(), 1)),
            "productividad_promedio": zona_prod,
            "hora_inicio_promedio": _min_a_hora(zona_jorn["primera"].mean()),
            "hora_fin_promedio": _min_a_hora(zona_jorn["ultima"].mean()),
            "actividades_total": int(zona_jorn["actividades"].sum()),
            "jornadas_cortas": int(zona_jorn["es_corta"].sum()),
            "pct_jornadas_cortas": zona_cortas,
            "criticos": n_criticos,
            "alertas": n_alertas,
            # Deltas de la zona vs el promedio global de zonas
            "delta_productividad_global_pct": float(round((zona_prod - prod_media_global) / prod_media_global * 100, 1)) if prod_media_global > 0 else 0.0,
            "delta_jornadas_cortas_global_pp": float(round(zona_cortas - cortas_media_global, 1)),
            "tecnicos_detalle": tecnicos_detalle,
        })

    # Periodo legible
    fechas_min = jornadas["fecha_date"].min()
    fechas_max = jornadas["fecha_date"].max()
    if fechas_min == fechas_max:
        periodo = fechas_min.strftime("%d-%m-%Y")
    else:
        periodo = f"{fechas_min.strftime('%d-%m-%Y')} → {fechas_max.strftime('%d-%m-%Y')} ({total_dias} días)"

    return {
        "periodo": periodo,
        "total_dias": int(total_dias),
        "total_jornadas": int(total_jornadas),
        "total_tecnicos": int(total_tecnicos),
        "stats_globales": stats_globales,
        "por_zona": por_zona_lista,
    }


def _clasificar_outlier(valor: float, media: float, std: float, invertido: bool = False) -> str:
    """
    Clasifica un valor según su z-score respecto a la media/std del grupo.
    invertido=True para métricas donde valor alto es malo (ej: % jornadas cortas).
    """
    if std == 0 or pd.isna(std):
        return "normal"
    z = (valor - media) / std
    if invertido:
        z = -z
    if z < -1.0:
        return "critico"
    if z < -0.5:
        return "alerta"
    if z > 1.0:
        return "destacado"
    return "normal"


def _severidad_max(*statuses: str) -> str:
    """Devuelve la peor severidad (critico > alerta > normal > destacado)."""
    orden = {"critico": 3, "alerta": 2, "normal": 1, "destacado": 0}
    peor = max(statuses, key=lambda s: orden.get(s, 0))
    return peor


def _empty_stats() -> dict:
    return {
        "duracion_promedio_min": 0.0,
        "productividad_promedio": 0.0,
        "hora_inicio_promedio": "—",
        "hora_fin_promedio": "—",
        "jornadas_cortas": 0,
        "pct_jornadas_cortas": 0.0,
        "actividades_total": 0,
        "actividades_promedio_jornada": 0.0,
    }


# ============================================================================
# Detalle día a día de un técnico (para modal granular)
# ============================================================================

DIAS_SEMANA_ES = {
    0: "lunes", 1: "martes", 2: "miércoles", 3: "jueves",
    4: "viernes", 5: "sábado", 6: "domingo",
}


def calculate_jornada_tecnico_detalle(filtered: pd.DataFrame, nombre_tecnico: str) -> dict:
    """
    Devuelve el detalle día a día de las jornadas de un técnico en el periodo
    filtrado, con el desglose de inspecciones por categoría.
    """
    empty = {
        "nombre": nombre_tecnico,
        "zona": "—",
        "periodo": "Sin datos",
        "total_dias": 0,
        "kpis": _empty_kpis_tecnico(),
        "dias": [],
    }

    if filtered.empty or "Fecha ejecución" not in filtered.columns:
        return empty

    df = filtered.copy()
    df = df[df["Fecha ejecución"].notna()]
    df["Nombre asignado"] = df["Nombre asignado"].apply(
        lambda x: normalizar_nombre(x) if isinstance(x, str) else x
    )
    df = df[df["Nombre asignado"].str.lower() == nombre_tecnico.lower()]
    if df.empty:
        return empty

    # Validar horas
    df["hora_inicio_valid"] = df["Hora inicio"].apply(_is_valid_time)
    df["hora_fin_valid"] = df["Hora fin"].apply(_is_valid_time)

    df["fecha_date"] = df["Fecha ejecución"].dt.date

    # Clasificación de resultados (mismo criterio que pago_tecnicos)
    rv = df["Resultado visita"]
    rf = df["Resultado final"]
    tipo_cnr = df.get("Tipo_CNR.Tipo de CNR", pd.Series([""] * len(df), index=df.index))

    df["es_normal"] = (rv == "Normal").astype(int)
    df["es_cnr"] = (rv == "CNR").astype(int)
    df["es_cnr_falla"] = ((rv == "CNR") & (tipo_cnr == "CNR Falla")).astype(int)
    df["es_cnr_hurto"] = ((rv == "CNR") & (tipo_cnr == "CNR Hurto")).astype(int)
    df["es_vf_total"] = (rv == "Visita fallida").astype(int)
    df["es_vf_cge"] = (
        (rv == "Visita fallida") &
        (
            rf.isin(["Sitio eriazo", "Sin empalme", "Desconectado en BT/MT"]) |
            rf.str.contains("Sin acceso medidor", case=False, na=False)
        )
    ).astype(int)
    df["es_mant"] = (rv == "Mantenimiento Medidor").astype(int)
    df["es_efectiva"] = (
        df["es_normal"] + df["es_cnr"] + df["es_vf_cge"] + df["es_mant"]
    ).clip(upper=1)
    df["kwh"] = df["kWh CNR"].fillna(0) if "kWh CNR" in df.columns else 0

    # Para hora: convertir a minutos solo en filas válidas
    df["inicio_min"] = df.apply(
        lambda r: _hora_a_min(r["Hora inicio"]) if r["hora_inicio_valid"] else None,
        axis=1,
    )
    df["fin_min"] = df.apply(
        lambda r: _hora_a_min(r["Hora fin"]) if r["hora_fin_valid"] else None,
        axis=1,
    )

    # Agrupar por día
    agg = (
        df.groupby("fecha_date", observed=True)
        .agg(
            primera=("inicio_min", "min"),
            ultima=("fin_min", "max"),
            total=("Nombre asignado", "count"),
            normales=("es_normal", "sum"),
            cnr=("es_cnr", "sum"),
            cnr_falla=("es_cnr_falla", "sum"),
            cnr_hurto=("es_cnr_hurto", "sum"),
            vf_total=("es_vf_total", "sum"),
            vf_cge=("es_vf_cge", "sum"),
            mantenimiento=("es_mant", "sum"),
            efectivas=("es_efectiva", "sum"),
            kwh=("kwh", "sum"),
        )
        .reset_index()
        .sort_values("fecha_date")
    )
    agg["vf_no_efectivas"] = agg["vf_total"] - agg["vf_cge"]
    agg["duracion_min"] = (agg["ultima"] - agg["primera"]).clip(lower=0).fillna(0)
    agg["productividad_hora"] = agg.apply(
        lambda r: r["total"] / (r["duracion_min"] / 60) if r["duracion_min"] > 0 else 0.0,
        axis=1,
    )
    agg["pct_efectividad"] = agg.apply(
        lambda r: round(r["efectivas"] / r["total"] * 100, 1) if r["total"] > 0 else 0.0,
        axis=1,
    )

    # Construir lista de días
    dias_list = []
    for _, row in agg.iterrows():
        fecha = row["fecha_date"]
        dias_list.append({
            "fecha": str(fecha),
            "dia_semana": DIAS_SEMANA_ES[pd.Timestamp(fecha).weekday()],
            "primera_actividad": _min_a_hora(row["primera"]) if pd.notna(row["primera"]) else "—",
            "ultima_actividad": _min_a_hora(row["ultima"]) if pd.notna(row["ultima"]) else "—",
            "duracion_min": float(row["duracion_min"]) if pd.notna(row["duracion_min"]) else 0.0,
            "es_corta": bool(row["duracion_min"] < 360),
            "total_actividades": int(row["total"]),
            "normales": int(row["normales"]),
            "cnr_total": int(row["cnr"]),
            "cnr_falla": int(row["cnr_falla"]),
            "cnr_hurto": int(row["cnr_hurto"]),
            "vf_total": int(row["vf_total"]),
            "vf_cge": int(row["vf_cge"]),
            "vf_no_efectivas": int(row["vf_no_efectivas"]),
            "mantenimiento": int(row["mantenimiento"]),
            "efectivas": int(row["efectivas"]),
            "pct_efectividad": float(row["pct_efectividad"]),
            "kwh": int(row["kwh"]),
            "productividad_hora": float(round(row["productividad_hora"], 2)),
        })

    # KPIs agregados del periodo
    total_dias = len(agg)
    total = int(agg["total"].sum())
    efectivas = int(agg["efectivas"].sum())
    duracion_validas = agg.loc[agg["duracion_min"] > 0, "duracion_min"]
    primera_validas = agg["primera"].dropna()
    ultima_validas = agg["ultima"].dropna()

    kpis = {
        "total_dias": total_dias,
        "total_actividades": total,
        "actividades_promedio_dia": float(round(total / total_dias, 1)) if total_dias else 0.0,
        "efectivas_total": efectivas,
        "efectivas_promedio_dia": float(round(efectivas / total_dias, 2)) if total_dias else 0.0,
        "pct_efectividad_global": float(round(efectivas / total * 100, 1)) if total else 0.0,
        "normales": int(agg["normales"].sum()),
        "cnr_falla": int(agg["cnr_falla"].sum()),
        "cnr_hurto": int(agg["cnr_hurto"].sum()),
        "vf_cge": int(agg["vf_cge"].sum()),
        "vf_no_efectivas": int(agg["vf_no_efectivas"].sum()),
        "mantenimiento": int(agg["mantenimiento"].sum()),
        "duracion_promedio_min": float(round(duracion_validas.mean(), 1)) if len(duracion_validas) else 0.0,
        "hora_inicio_promedio": _min_a_hora(primera_validas.mean()) if len(primera_validas) else "—",
        "hora_fin_promedio": _min_a_hora(ultima_validas.mean()) if len(ultima_validas) else "—",
        "jornadas_cortas": int(agg["es_corta"] if False else (agg["duracion_min"] < 360).sum()),
        "productividad_promedio": float(round(agg.loc[agg["duracion_min"] > 0, "productividad_hora"].mean(), 2)) if (agg["duracion_min"] > 0).any() else 0.0,
        "kwh_total": int(agg["kwh"].sum()),
    }

    # Zona del técnico (la que más aparece, o zona_tecnico si existe)
    if "zona_tecnico" in df.columns:
        zona_serie = df["zona_tecnico"].dropna()
    else:
        zona_serie = df["zona"].dropna() if "zona" in df.columns else pd.Series([], dtype=str)
    zona = str(zona_serie.mode().iloc[0]) if not zona_serie.empty else "—"

    fechas_min = agg["fecha_date"].min()
    fechas_max = agg["fecha_date"].max()
    if fechas_min == fechas_max:
        periodo = fechas_min.strftime("%d-%m-%Y")
    else:
        periodo = f"{fechas_min.strftime('%d-%m-%Y')} → {fechas_max.strftime('%d-%m-%Y')} ({total_dias} días)"

    return {
        "nombre": nombre_tecnico,
        "zona": zona,
        "periodo": periodo,
        "total_dias": total_dias,
        "kpis": kpis,
        "dias": dias_list,
    }


def _empty_kpis_tecnico() -> dict:
    return {
        "total_dias": 0,
        "total_actividades": 0,
        "actividades_promedio_dia": 0.0,
        "efectivas_total": 0,
        "efectivas_promedio_dia": 0.0,
        "pct_efectividad_global": 0.0,
        "normales": 0, "cnr_falla": 0, "cnr_hurto": 0,
        "vf_cge": 0, "vf_no_efectivas": 0, "mantenimiento": 0,
        "duracion_promedio_min": 0.0,
        "hora_inicio_promedio": "—",
        "hora_fin_promedio": "—",
        "jornadas_cortas": 0,
        "productividad_promedio": 0.0,
        "kwh_total": 0,
    }
