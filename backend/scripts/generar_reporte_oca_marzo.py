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
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

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

# --- Estilos reusables ---
FONT_TITLE = Font(name="Calibri", size=16, bold=True, color=OCA_BLUE)
FONT_SECTION = Font(name="Calibri", size=10, bold=True, color=SLATE_500)
FONT_HEADER = Font(name="Calibri", size=10, bold=True, color=WHITE)
FONT_ZONE = Font(name="Calibri", size=11, bold=True, color=WHITE)
FONT_KPI_LABEL = Font(name="Calibri", size=9, color=SLATE_400)
FONT_KPI_VALUE = Font(name="Calibri", size=22, bold=True, color=SLATE_800)
FONT_KPI_HINT = Font(name="Calibri", size=9, color=SLATE_500)
FONT_CELL = Font(name="Calibri", size=10, color=SLATE_800)
FONT_CELL_DIM = Font(name="Calibri", size=10, color=SLATE_500)

FILL_HEADER = PatternFill("solid", fgColor=OCA_BLUE)
FILL_ZONE = PatternFill("solid", fgColor=SLATE_800)
FILL_ALT = PatternFill("solid", fgColor=SLATE_50)
FILL_KPI_CARD = PatternFill("solid", fgColor=WHITE)

THIN = Side(border_style="thin", color=SLATE_200)
BORDER_CELL = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

ALIGN_LEFT = Alignment(horizontal="left", vertical="center", wrap_text=False)
ALIGN_CENTER = Alignment(horizontal="center", vertical="center")
ALIGN_RIGHT = Alignment(horizontal="right", vertical="center")

FMT_INT = "#,##0"
FMT_PCT = "0.0%"


def write_table(
    ws: Worksheet,
    df: pd.DataFrame,
    start_row: int,
    start_col: int = 1,
    pct_cols: tuple[str, ...] = (),
    int_cols: tuple[str, ...] = (),
) -> int:
    """Escribe un DataFrame como tabla con estilos. Devuelve la fila siguiente libre.

    pct_cols: nombres de columnas a formatear como porcentaje.
    int_cols: nombres de columnas a formatear como entero con miles.
    Resto de columnas numéricas: formato general.
    """
    # Header
    for j, col in enumerate(df.columns):
        cell = ws.cell(row=start_row, column=start_col + j, value=str(col).upper())
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = ALIGN_CENTER
        cell.border = BORDER_CELL
    # Filas
    for i, (_, row) in enumerate(df.iterrows()):
        excel_row = start_row + 1 + i
        is_alt = i % 2 == 1
        for j, col in enumerate(df.columns):
            val = row[col]
            cell = ws.cell(row=excel_row, column=start_col + j, value=val)
            cell.font = FONT_CELL
            cell.border = BORDER_CELL
            if is_alt:
                cell.fill = FILL_ALT
            if col in pct_cols:
                cell.number_format = FMT_PCT
                cell.alignment = ALIGN_RIGHT
            elif col in int_cols:
                cell.number_format = FMT_INT
                cell.alignment = ALIGN_RIGHT
            elif j == 0:
                cell.alignment = ALIGN_LEFT
            else:
                cell.alignment = ALIGN_RIGHT
    # Anchos de columna
    for j, col in enumerate(df.columns):
        letter = get_column_letter(start_col + j)
        max_len = max(
            len(str(col)),
            *[len(str(v)) for v in df[col].astype(str).tolist()],
        )
        ws.column_dimensions[letter].width = max(12, min(40, max_len + 4))
    return start_row + len(df) + 2


def write_title(ws: Worksheet, row: int, text: str, col: int = 1) -> int:
    """Escribe un título de hoja. Devuelve la siguiente fila libre."""
    cell = ws.cell(row=row, column=col, value=text)
    cell.font = FONT_TITLE
    return row + 2


def write_section(ws: Worksheet, row: int, text: str, col: int = 1) -> int:
    """Escribe un encabezado de sección en mayúsculas grises."""
    cell = ws.cell(row=row, column=col, value=text.upper())
    cell.font = FONT_SECTION
    return row + 1


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


def compute_by_dimension(df: pd.DataFrame, dim_col: str) -> pd.DataFrame:
    """Agrupa por la dimensión dada y calcula métricas por grupo.

    Returns DataFrame con columnas:
      [dim_col], Total, Normal, CNR, Fallidas, Fallidas_CGE, Fallidas_OCA,
      Eff_Hallazgo, Eff_Operativa, Eff_Ajustada
    Filas vacías o nulas en la dimensión se etiquetan como "Sin asignar".
    """
    work = df.copy()
    work[dim_col] = work[dim_col].fillna("").replace("", "Sin asignar")

    rows = []
    for grupo, sub in work.groupby(dim_col, sort=True):
        m = compute_global_metrics(sub)
        rows.append({
            dim_col: grupo,
            "Total": m["total"],
            "Normal": m["normal"],
            "CNR": m["cnr"],
            "Fallidas": m["fallidas"],
            "Fallidas_CGE": m["fallidas_cge"],
            "Fallidas_OCA": m["fallidas_oca"],
            "Eff_Hallazgo": m["eff_hallazgo"],
            "Eff_Operativa": m["eff_operativa"],
            "Eff_Ajustada": m["eff_ajustada"],
        })
    return pd.DataFrame(rows)


def compute_failed_cross(df: pd.DataFrame) -> pd.DataFrame:
    """Cross-tab Resultado final × Responsabilidad para visitas fallidas.

    Returns DataFrame indexado por Resultado final con columnas:
      [RESP_OCA, RESP_CGE, "Sin asignar"]. Incluye totales en el orden dado.
    """
    fallidas = df[df["Resultado visita"] == RV_FALLIDA].copy()
    resp = fallidas["Responsabilidad"].fillna("").replace("", "Sin asignar")
    fallidas = fallidas.assign(_resp=resp)
    cross = pd.crosstab(fallidas["Resultado final"], fallidas["_resp"])
    # Garantizar las 3 columnas en orden estable
    for col in [RESP_OCA, RESP_CGE, "Sin asignar"]:
        if col not in cross.columns:
            cross[col] = 0
    cross = cross[[RESP_OCA, RESP_CGE, "Sin asignar"]]
    cross = cross.sort_values(by=cross.columns.tolist(), ascending=False)
    return cross


def main() -> None:
    """Orquesta carga, cómputo y render del reporte."""
    raise NotImplementedError("Implementado en tareas posteriores")


if __name__ == "__main__":
    main()
