#!/usr/bin/env python3
"""Genera el reporte ejecutivo de efectividad de OCA para marzo 2026.

Lee backend/data/resultado_consolidado.parquet, filtra por Fecha ejecución
en marzo 2026, calcula las tres métricas de efectividad (Hallazgo, Operativa
y Ajustada por CGE) y escribe el archivo backend/data/reporte_oca_marzo_2026.xlsx
siguiendo la filosofía de Minimalismo Ejecutivo del proyecto.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

# --- Paths ---
ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "backend" / "data" / "resultado_consolidado.parquet"
OUTPUT_PATH = ROOT / "backend" / "data" / "reporte_oca_marzo_2026.xlsx"

# --- Periodo objetivo ---
YEAR = 2026
MONTH = 3  # marzo

# --- Paleta (CLAUDE.md - Minimalismo Ejecutivo) ---
OCA_BLUE = "294D6D"
SLATE_800 = "1E293B"
SLATE_500 = "64748B"
SLATE_400 = "94A3B8"
SLATE_200 = "E2E8F0"
SLATE_100 = "F1F5F9"
SLATE_50 = "F8FAFC"
WHITE = "FFFFFF"

# --- Etiquetas oficiales (campo Responsabilidad) ---
RESP_OCA = "Responsabilidad Contratista"
RESP_CGE = "Responsabilidad CGE"
RESP_SIN = "Sin asignar"  # etiqueta interna para campo vacío

# --- Resultados de visita ---
RV_NORMAL = "Normal"
RV_CNR = "CNR"
RV_FALLIDA = "Visita fallida"
RV_ANULACION = "Cierre por anulación"
RV_MANTENIMIENTO = "Mantenimiento Medidor"


def load_data(path: Path) -> pd.DataFrame:
    """Carga el parquet consolidado."""
    return pd.read_parquet(path)


def filter_period(df: pd.DataFrame, year: int, month: int) -> pd.DataFrame:
    """Filtra registros cuya Fecha ejecución cae dentro del mes indicado.

    Las filas con Fecha ejecución nula o fuera del rango se descartan.
    """
    fechas = pd.to_datetime(df["Fecha ejecución"], format="ISO8601", errors="coerce")
    inicio = pd.Timestamp(year=year, month=month, day=1)
    fin = (inicio + pd.offsets.MonthBegin(1))
    mask = (fechas >= inicio) & (fechas < fin)
    return df.loc[mask].copy()


def compute_global_metrics(df: pd.DataFrame) -> dict:
    """Calcula KPIs globales del reporte.

    Returns dict con:
      total, normal, cnr, fallidas, anulacion, mantenimiento,
      fallidas_cge, fallidas_oca, fallidas_sin_asignar,
      kwh_cnr, pct_fallidas_cge,
      eff_hallazgo, eff_operativa, eff_ajustada
    """
    total = len(df)
    rv = df["Resultado visita"]
    resp = df["Responsabilidad"].fillna("")

    normal = int((rv == RV_NORMAL).sum())
    cnr = int((rv == RV_CNR).sum())
    fallidas = int((rv == RV_FALLIDA).sum())
    anulacion = int((rv == RV_ANULACION).sum())
    mantenimiento = int((rv == RV_MANTENIMIENTO).sum())

    is_fallida = rv == RV_FALLIDA
    fallidas_cge = int((is_fallida & (resp == RESP_CGE)).sum())
    fallidas_oca = int((is_fallida & (resp == RESP_OCA)).sum())
    fallidas_sin_asignar = fallidas - fallidas_cge - fallidas_oca

    kwh_cnr = int(df["kWh CNR"].sum())

    eff_hallazgo = (normal + cnr) / total if total else 0.0
    eff_operativa = 1 - (fallidas / total) if total else 0.0
    denom_ajustada = total - fallidas_cge
    eff_ajustada = (
        1 - ((fallidas - fallidas_cge) / denom_ajustada)
        if denom_ajustada
        else 0.0
    )
    pct_fallidas_cge = fallidas_cge / fallidas if fallidas else 0.0

    return {
        "total": total,
        "normal": normal,
        "cnr": cnr,
        "fallidas": fallidas,
        "anulacion": anulacion,
        "mantenimiento": mantenimiento,
        "fallidas_cge": fallidas_cge,
        "fallidas_oca": fallidas_oca,
        "fallidas_sin_asignar": fallidas_sin_asignar,
        "kwh_cnr": kwh_cnr,
        "pct_fallidas_cge": pct_fallidas_cge,
        "eff_hallazgo": eff_hallazgo,
        "eff_operativa": eff_operativa,
        "eff_ajustada": eff_ajustada,
    }


def main() -> None:
    """Orquesta carga, cómputo y render del reporte."""
    raise NotImplementedError("Implementado en tareas posteriores")


if __name__ == "__main__":
    main()
