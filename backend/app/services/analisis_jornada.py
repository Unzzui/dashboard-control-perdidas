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

    # Por zona
    por_zona_lista = []
    for zona in sorted(jornadas["zona"].unique()):
        zona_jorn = jornadas[jornadas["zona"] == zona]
        zona_tec = por_tecnico[por_tecnico["zona"] == zona].sort_values(
            "productividad_promedio", ascending=False
        )
        n_tec = len(zona_tec)
        if n_tec == 0:
            continue

        tecnicos_detalle = []
        for _, t in zona_tec.iterrows():
            tecnicos_detalle.append({
                "nombre": t["Nombre asignado"],
                "dias_trabajados": int(t["dias_trabajados"]),
                "duracion_promedio_min": float(round(t["duracion_promedio_min"], 1)),
                "productividad_promedio": float(round(t["productividad_promedio"], 2)),
                "hora_inicio_promedio": _min_a_hora(t["primera_promedio"]),
                "hora_fin_promedio": _min_a_hora(t["ultima_promedio"]),
                "actividades_total": int(t["actividades_total"]),
                "actividades_promedio": float(round(t["actividades_promedio"], 1)),
                "jornadas_cortas": int(t["jornadas_cortas"]),
                "pct_jornadas_cortas": float(t["pct_jornadas_cortas"]) if pd.notna(t["pct_jornadas_cortas"]) else 0.0,
            })

        por_zona_lista.append({
            "zona": str(zona),
            "tecnicos": n_tec,
            "dias_trabajados": int(zona_jorn["fecha_date"].nunique()),
            "duracion_promedio_min": float(round(zona_jorn["duracion_min"].mean(), 1)),
            "productividad_promedio": float(round(zona_jorn["productividad_hora"].mean(), 2)),
            "hora_inicio_promedio": _min_a_hora(zona_jorn["primera"].mean()),
            "hora_fin_promedio": _min_a_hora(zona_jorn["ultima"].mean()),
            "actividades_total": int(zona_jorn["actividades"].sum()),
            "jornadas_cortas": int(zona_jorn["es_corta"].sum()),
            "pct_jornadas_cortas": float(round(zona_jorn["es_corta"].sum() / len(zona_jorn) * 100, 1)),
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
