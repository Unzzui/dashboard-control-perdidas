#!/usr/bin/env python3
"""Genera el reporte ejecutivo de efectividad de OCA para marzo 2026.

Lee backend/data/resultado_consolidado.parquet, filtra por Fecha ejecución
en marzo 2026, calcula las tres métricas de efectividad (Hallazgo, Operativa
y Ajustada por CGE) y escribe el archivo backend/data/reporte_oca_marzo_2026.xlsx
siguiendo la filosofía de Minimalismo Ejecutivo del proyecto.
"""
from __future__ import annotations

from pathlib import Path

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


def main() -> None:
    """Orquesta carga, cómputo y render del reporte."""
    raise NotImplementedError("Implementado en tareas posteriores")


if __name__ == "__main__":
    main()
