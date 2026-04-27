# Reporte Efectividad OCA Marzo 2026 — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generar un Excel ejecutivo (`reporte_oca_marzo_2026.xlsx`) con 7 hojas que defienda la efectividad operativa de OCA en marzo 2026, mediante un script Python re-ejecutable.

**Architecture:** Script único `backend/scripts/generar_reporte_oca_marzo.py` con funciones puras de cómputo (data → métricas) separadas de funciones de render (métricas → openpyxl). Tests independientes en `backend/scripts/test_reporte_oca_marzo.py` siguiendo la convención del proyecto (scripts ejecutables con `python3`, sin pytest).

**Tech Stack:** Python 3.12, pandas 2.x (lectura parquet + agregaciones), openpyxl 3.1 (escritura Excel con estilos), pyarrow (backend parquet).

**Spec de referencia:** `docs/superpowers/specs/2026-04-27-reporte-efectividad-oca-marzo-design.md`

---

## File Structure

| Archivo | Responsabilidad |
|---------|-----------------|
| `backend/scripts/__init__.py` | Marca `scripts` como paquete (vacío) |
| `backend/scripts/generar_reporte_oca_marzo.py` | Script principal: carga, cómputo, render, orquestación |
| `backend/scripts/test_reporte_oca_marzo.py` | Tests ejecutables con `python3` (assertions sobre data sintética) |
| `backend/data/reporte_oca_marzo_2026.xlsx` | Output generado (no se commitea) |

El script tendrá secciones internas claramente delimitadas:
1. **Constantes** (paths, año/mes objetivo, paleta de colores, etiquetas).
2. **Carga y filtrado** (`load_data`, `filter_period`).
3. **Cómputo** (`compute_global_metrics`, `compute_by_dimension`, `compute_failed_cross`).
4. **Estilos openpyxl** (fills, fonts, borders, helpers `apply_header_style`, `apply_zone_style`, `write_table`).
5. **Builders de hojas** (`build_resumen_sheet`, `build_resultados_sheet`, etc.).
6. **`main()`** — orquestación end-to-end.

---

## Convenciones del proyecto

- **Tests**: scripts ejecutables con `python3 backend/scripts/test_reporte_oca_marzo.py`. Usar `assert` y `print` con marcador final `PASS`/`FAIL`. No pytest (no está instalado).
- **Idioma**: comentarios y docstrings en español; nombres de variables/funciones en inglés (estándar Python).
- **Commits**: prefijos en español tipo `feat(reporte): ...`, `fix(reporte): ...`, `test(reporte): ...`, `docs(reporte): ...`.
- **Working directory**: comandos asumen `cwd = /home/Diego_Bravo/Proyectos/dashboard-control-perdidas`.
- **Python**: usar `python3` directamente (el entorno actual tiene pandas/openpyxl/pyarrow instalados globalmente).

---

## Task 1: Esqueleto del script con constantes

**Files:**
- Create: `backend/scripts/__init__.py` (vacío)
- Create: `backend/scripts/generar_reporte_oca_marzo.py`

- [ ] **Step 1: Crear paquete scripts**

```bash
mkdir -p backend/scripts
touch backend/scripts/__init__.py
```

- [ ] **Step 2: Crear esqueleto del script con constantes**

Escribir `backend/scripts/generar_reporte_oca_marzo.py` con:

```python
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
```

- [ ] **Step 3: Validar import**

Run: `python3 -c "from backend.scripts import generar_reporte_oca_marzo as r; print(r.YEAR, r.MONTH, r.DATA_PATH.name)"`
Expected: `2026 3 resultado_consolidado.parquet`

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/__init__.py backend/scripts/generar_reporte_oca_marzo.py
git commit -m "feat(reporte): esqueleto del script generador de reporte OCA marzo 2026"
```

---

## Task 2: Carga y filtrado por periodo (TDD)

**Files:**
- Create: `backend/scripts/test_reporte_oca_marzo.py`
- Modify: `backend/scripts/generar_reporte_oca_marzo.py`

- [ ] **Step 1: Escribir test que falla**

Crear `backend/scripts/test_reporte_oca_marzo.py`:

```python
#!/usr/bin/env python3
"""Tests del generador de reporte OCA marzo 2026.

Ejecutar con: python3 backend/scripts/test_reporte_oca_marzo.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.scripts import generar_reporte_oca_marzo as r


def _df_sintetico_fechas() -> pd.DataFrame:
    """DataFrame mínimo con fechas dentro y fuera de marzo 2026."""
    return pd.DataFrame({
        "Fecha ejecución": [
            "2026-02-28T10:00:00",
            "2026-03-01T08:00:00",
            "2026-03-15T12:00:00",
            "2026-03-31T23:59:00",
            "2026-04-01T00:00:00",
            None,
        ],
        "Resultado visita": ["Normal"] * 6,
    })


def test_filter_period_keeps_only_march_2026() -> None:
    df = _df_sintetico_fechas()
    out = r.filter_period(df, year=2026, month=3)
    # Solo las 3 filas dentro de marzo 2026 sobreviven
    assert len(out) == 3, f"Esperaba 3 filas, obtuve {len(out)}"
    fechas = pd.to_datetime(out["Fecha ejecución"]).dt.strftime("%Y-%m-%d").tolist()
    assert fechas == ["2026-03-01", "2026-03-15", "2026-03-31"], fechas
    print("PASS test_filter_period_keeps_only_march_2026")


def test_load_data_real_returns_dataframe() -> None:
    """Smoke test contra el parquet real."""
    df = r.load_data(r.DATA_PATH)
    assert isinstance(df, pd.DataFrame)
    assert len(df) > 0
    assert "Fecha ejecución" in df.columns
    print("PASS test_load_data_real_returns_dataframe")


TESTS = [
    test_filter_period_keeps_only_march_2026,
    test_load_data_real_returns_dataframe,
]


def main() -> int:
    failures = 0
    for t in TESTS:
        try:
            t()
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
            failures += 1
    print(f"\n{len(TESTS) - failures}/{len(TESTS)} tests passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Verificar que falla**

Run: `python3 backend/scripts/test_reporte_oca_marzo.py`
Expected: `AttributeError: module 'backend.scripts.generar_reporte_oca_marzo' has no attribute 'filter_period'`

- [ ] **Step 3: Implementar `load_data` y `filter_period`**

Agregar al script `backend/scripts/generar_reporte_oca_marzo.py` después de las constantes:

```python
import pandas as pd  # añadir al tope con los imports


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
```

- [ ] **Step 4: Verificar que pasa**

Run: `python3 backend/scripts/test_reporte_oca_marzo.py`
Expected: `2/2 tests passed`

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/test_reporte_oca_marzo.py backend/scripts/generar_reporte_oca_marzo.py
git commit -m "feat(reporte): carga y filtrado por periodo (marzo 2026)"
```

---

## Task 3: Métricas globales (TDD)

**Files:**
- Modify: `backend/scripts/test_reporte_oca_marzo.py`
- Modify: `backend/scripts/generar_reporte_oca_marzo.py`

- [ ] **Step 1: Escribir test sintético con cifras conocidas**

Agregar al test file (antes del bloque `TESTS = [...]`):

```python
def _df_sintetico_metricas() -> pd.DataFrame:
    """20 visitas con composición conocida.

    - Normal: 10
    - CNR: 5 (con kWh: 100 + 200 + 50 + 0 + 0 = 350)
    - Visita fallida: 4 (1 con Responsabilidad CGE, 3 sin asignar)
    - Cierre por anulación: 1
    - Mantenimiento Medidor: 0
    """
    rv = (
        ["Normal"] * 10
        + ["CNR"] * 5
        + ["Visita fallida"] * 4
        + ["Cierre por anulación"] * 1
    )
    resp = (
        [""] * 10
        + ["Responsabilidad Contratista"] * 5
        + ["Responsabilidad CGE"] + [""] * 3
        + [""] * 1
    )
    kwh = [0] * 10 + [100, 200, 50, 0, 0] + [0] * 4 + [0]
    return pd.DataFrame({
        "Resultado visita": rv,
        "Responsabilidad": resp,
        "kWh CNR": kwh,
        "Resultado final": [""] * 20,
    })


def test_compute_global_metrics_known_values() -> None:
    df = _df_sintetico_metricas()
    m = r.compute_global_metrics(df)
    assert m["total"] == 20, m["total"]
    assert m["normal"] == 10
    assert m["cnr"] == 5
    assert m["fallidas"] == 4
    assert m["fallidas_cge"] == 1
    assert m["fallidas_oca"] == 0  # ninguna fallida marcada como Contratista
    assert m["fallidas_sin_asignar"] == 3
    assert m["kwh_cnr"] == 350
    # Efectividad de Hallazgo = (10 + 5) / 20 = 0.75
    assert abs(m["eff_hallazgo"] - 0.75) < 1e-9, m["eff_hallazgo"]
    # Efectividad Operativa = 1 - (4 / 20) = 0.80
    assert abs(m["eff_operativa"] - 0.80) < 1e-9
    # Efectividad Ajustada = 1 - (3 / (20 - 1)) = 1 - 3/19
    assert abs(m["eff_ajustada"] - (1 - 3 / 19)) < 1e-9
    # % fallidas atribuibles a CGE = 1 / 4 = 0.25
    assert abs(m["pct_fallidas_cge"] - 0.25) < 1e-9
    print("PASS test_compute_global_metrics_known_values")
```

Y añadirlo a `TESTS`:

```python
TESTS = [
    test_filter_period_keeps_only_march_2026,
    test_load_data_real_returns_dataframe,
    test_compute_global_metrics_known_values,
]
```

- [ ] **Step 2: Verificar que falla**

Run: `python3 backend/scripts/test_reporte_oca_marzo.py`
Expected: `AttributeError: ... 'compute_global_metrics'`

- [ ] **Step 3: Implementar `compute_global_metrics`**

Agregar al script:

```python
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
```

- [ ] **Step 4: Verificar que pasa**

Run: `python3 backend/scripts/test_reporte_oca_marzo.py`
Expected: `3/3 tests passed`

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/test_reporte_oca_marzo.py backend/scripts/generar_reporte_oca_marzo.py
git commit -m "feat(reporte): cómputo de métricas globales (3 efectividades)"
```

---

## Task 4: Métricas por dimensión (TDD)

**Files:**
- Modify: `backend/scripts/test_reporte_oca_marzo.py`
- Modify: `backend/scripts/generar_reporte_oca_marzo.py`

- [ ] **Step 1: Test con dataset de 2 grupos**

Agregar al test file:

```python
def test_compute_by_dimension_two_groups() -> None:
    df = _df_sintetico_metricas().copy()
    # Asignar primeras 10 filas a "ZONA A", resto a "ZONA B"
    df["Regional"] = ["ZONA A"] * 10 + ["ZONA B"] * 10
    out = r.compute_by_dimension(df, "Regional")
    assert list(out.columns[:1]) == ["Regional"], out.columns.tolist()
    expected_cols = {
        "Regional", "Total", "Normal", "CNR", "Fallidas",
        "Fallidas_CGE", "Fallidas_OCA",
        "Eff_Hallazgo", "Eff_Operativa", "Eff_Ajustada",
    }
    assert expected_cols.issubset(set(out.columns)), out.columns.tolist()
    # ZONA A son 10 Normal puros → 100% en todas las efectividades
    a = out[out["Regional"] == "ZONA A"].iloc[0]
    assert a["Total"] == 10
    assert a["Normal"] == 10
    assert abs(a["Eff_Hallazgo"] - 1.0) < 1e-9
    assert abs(a["Eff_Operativa"] - 1.0) < 1e-9
    # ZONA B tiene los CNR + fallidas + anulación → mismas cifras del global excepto los Normal
    b = out[out["Regional"] == "ZONA B"].iloc[0]
    assert b["Total"] == 10
    assert b["CNR"] == 5
    assert b["Fallidas"] == 4
    assert b["Fallidas_CGE"] == 1
    print("PASS test_compute_by_dimension_two_groups")
```

Añadir a `TESTS`.

- [ ] **Step 2: Verificar que falla**

Run: `python3 backend/scripts/test_reporte_oca_marzo.py`
Expected: `AttributeError: ... 'compute_by_dimension'`

- [ ] **Step 3: Implementar `compute_by_dimension`**

```python
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
```

- [ ] **Step 4: Verificar que pasa**

Run: `python3 backend/scripts/test_reporte_oca_marzo.py`
Expected: `4/4 tests passed`

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/test_reporte_oca_marzo.py backend/scripts/generar_reporte_oca_marzo.py
git commit -m "feat(reporte): agregación de métricas por dimensión"
```

---

## Task 5: Cross-tab Visitas Fallidas × Responsabilidad (TDD)

**Files:**
- Modify: `backend/scripts/test_reporte_oca_marzo.py`
- Modify: `backend/scripts/generar_reporte_oca_marzo.py`

- [ ] **Step 1: Test sobre cross-tab**

```python
def test_compute_failed_cross_matrix() -> None:
    df = pd.DataFrame({
        "Resultado visita": [
            "Visita fallida", "Visita fallida", "Visita fallida",
            "Visita fallida", "Visita fallida",
            "Normal",  # debe excluirse
        ],
        "Resultado final": [
            "Casa cerrada", "Casa cerrada", "Casa deshabitada",
            "Sitio eriazo", "Cliente no permite revisión",
            "Servicio normal",
        ],
        "Responsabilidad": [
            "Responsabilidad Contratista", "", "Responsabilidad CGE",
            "Responsabilidad CGE", "", "",
        ],
    })
    out = r.compute_failed_cross(df)
    # Solo 5 filas (las fallidas)
    assert int(out.values.sum()) == 5, out
    # Casa cerrada: 1 OCA, 1 sin asignar
    fila_casa_cerrada = out.loc["Casa cerrada"]
    assert fila_casa_cerrada["Responsabilidad Contratista"] == 1
    assert fila_casa_cerrada["Sin asignar"] == 1
    # Casa deshabitada: 1 CGE
    assert out.loc["Casa deshabitada", "Responsabilidad CGE"] == 1
    # Sitio eriazo: 1 CGE
    assert out.loc["Sitio eriazo", "Responsabilidad CGE"] == 1
    print("PASS test_compute_failed_cross_matrix")
```

Añadir a `TESTS`.

- [ ] **Step 2: Verificar que falla**

Run: `python3 backend/scripts/test_reporte_oca_marzo.py`
Expected: `AttributeError: ... 'compute_failed_cross'`

- [ ] **Step 3: Implementar `compute_failed_cross`**

```python
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
```

- [ ] **Step 4: Verificar que pasa**

Run: `python3 backend/scripts/test_reporte_oca_marzo.py`
Expected: `5/5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/test_reporte_oca_marzo.py backend/scripts/generar_reporte_oca_marzo.py
git commit -m "feat(reporte): cross-tab visitas fallidas por responsabilidad"
```

---

## Task 6: Estilos openpyxl + helper de tabla

**Files:**
- Modify: `backend/scripts/generar_reporte_oca_marzo.py`

No se testean visualmente — la validación viene en la Task 13 (smoke test del .xlsx final).

- [ ] **Step 1: Agregar imports openpyxl y constantes de estilo**

Al tope del script (después de `import pandas as pd`):

```python
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet
```

Después de las constantes de paleta, agregar:

```python
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
```

- [ ] **Step 2: Helper `write_table`**

Agregar:

```python
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
```

- [ ] **Step 3: Smoke test del módulo**

Run: `python3 -c "from backend.scripts import generar_reporte_oca_marzo as r; print('OK', r.write_table.__name__)"`
Expected: `OK write_table`

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/generar_reporte_oca_marzo.py
git commit -m "feat(reporte): estilos openpyxl y helper write_table"
```

---

## Task 7: Hoja Metodología

**Files:**
- Modify: `backend/scripts/generar_reporte_oca_marzo.py`

- [ ] **Step 1: Implementar `build_metodologia_sheet`**

```python
def build_metodologia_sheet(wb: Workbook) -> None:
    ws = wb.create_sheet("Metodología")
    ws.sheet_view.showGridLines = False
    row = write_title(ws, 1, "Metodología del Reporte")

    bloques = [
        ("Fuente de datos",
         "Archivo backend/data/resultado_consolidado.parquet. "
         "Universo histórico: jul-2024 a abr-2026. Único contratista presente: OCA."),
        ("Periodo del reporte",
         "Marzo 2026. Filtro aplicado sobre el campo Fecha ejecución "
         "en el rango [2026-03-01, 2026-04-01). Las visitas sin Fecha "
         "ejecución se descartan del análisis."),
        ("Definiciones de Resultado de visita",
         "Normal: visita ejecutada, servicio sin anomalías. "
         "CNR: visita ejecutada, se detectó Consumo No Registrado (hallazgo positivo). "
         "Visita fallida: no se pudo completar la inspección. "
         "Cierre por anulación: orden anulada antes/durante ejecución. "
         "Mantenimiento Medidor: intervención técnica sobre el equipo."),
        ("Responsabilidad",
         "Campo Responsabilidad del registro. "
         "Responsabilidad Contratista: atribuible a OCA. "
         "Responsabilidad CGE: atribuible al cliente o a condiciones del sistema CGE "
         "(casa deshabitada, desconectado en BT/MT, sin empalme, sitio eriazo, "
         "zona peligrosa, sin acceso por caja tortuga, etc.). "
         "Sin asignar: el campo viene vacío en el origen y se reporta tal cual."),
        ("Métricas de efectividad",
         "Se reportan tres en paralelo:"),
        ("    Efectividad de Hallazgo",
         "(Normal + CNR) / Total visitas. Mide la proporción de visitas con resultado conclusivo."),
        ("    Efectividad Operativa",
         "1 - (Visitas fallidas / Total visitas). Mide la capacidad de OCA de completar la visita."),
        ("    Efectividad Ajustada por CGE",
         "1 - (Fallidas no CGE / (Total - Fallidas CGE)). Excluye del cálculo las "
         "visitas fallidas atribuibles a CGE. Refleja la efectividad real de OCA "
         "descontando las causas que no controla."),
        ("Alcance",
         "Solo se reporta volumen físico (kWh CNR detectados). "
         "No se incluye valorización monetaria ni comparativos contra otros meses."),
    ]

    for label, body in bloques:
        ws.cell(row=row, column=1, value=label).font = FONT_SECTION
        row += 1
        cell = ws.cell(row=row, column=1, value=body)
        cell.font = FONT_CELL
        cell.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
        ws.row_dimensions[row].height = 45
        row += 2

    ws.column_dimensions["A"].width = 110
```

- [ ] **Step 2: Smoke test escribiendo solo esta hoja**

Run:
```bash
python3 -c "
from openpyxl import Workbook
from backend.scripts import generar_reporte_oca_marzo as r
wb = Workbook()
wb.remove(wb.active)
r.build_metodologia_sheet(wb)
wb.save('/tmp/test_metodologia.xlsx')
print('OK', wb.sheetnames)
"
```
Expected: `OK ['Metodología']`

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/generar_reporte_oca_marzo.py
git commit -m "feat(reporte): hoja de metodología"
```

---

## Task 8: Hoja Resultados Globales

**Files:**
- Modify: `backend/scripts/generar_reporte_oca_marzo.py`

- [ ] **Step 1: Implementar `build_resultados_sheet`**

```python
def build_resultados_sheet(wb: Workbook, df: pd.DataFrame, metrics: dict) -> None:
    ws = wb.create_sheet("Resultados Globales")
    ws.sheet_view.showGridLines = False
    row = write_title(ws, 1, "Resultados Globales — Marzo 2026")
    row = write_section(ws, row, "Distribución por Resultado de Visita")
    row += 1

    total = metrics["total"]
    orden = [
        (RV_NORMAL, metrics["normal"]),
        (RV_CNR, metrics["cnr"]),
        (RV_FALLIDA, metrics["fallidas"]),
        (RV_ANULACION, metrics["anulacion"]),
        (RV_MANTENIMIENTO, metrics["mantenimiento"]),
    ]
    rows = [
        {"Resultado": k, "Cantidad": v, "% Total": (v / total) if total else 0.0}
        for k, v in orden
    ]
    rows.append({"Resultado": "TOTAL", "Cantidad": total, "% Total": 1.0})
    tabla = pd.DataFrame(rows)
    write_table(
        ws, tabla, start_row=row, start_col=1,
        pct_cols=("% Total",), int_cols=("Cantidad",),
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/scripts/generar_reporte_oca_marzo.py
git commit -m "feat(reporte): hoja de resultados globales"
```

---

## Task 9: Hoja Visitas Fallidas y Responsabilidad

**Files:**
- Modify: `backend/scripts/generar_reporte_oca_marzo.py`

- [ ] **Step 1: Implementar `build_fallidas_sheet`**

```python
def build_fallidas_sheet(wb: Workbook, cross: pd.DataFrame) -> None:
    ws = wb.create_sheet("Fallidas y Responsabilidad")
    ws.sheet_view.showGridLines = False
    row = write_title(ws, 1, "Visitas Fallidas — Distribución por Responsabilidad")
    row = write_section(
        ws, row,
        "Causa raíz (Resultado final) cruzada con Responsabilidad",
    )
    row += 1

    tabla = cross.copy()
    tabla["Total"] = tabla.sum(axis=1)
    # Fila de totales
    total_row = pd.DataFrame(tabla.sum(axis=0)).T
    total_row.index = ["TOTAL"]
    tabla = pd.concat([tabla, total_row])
    tabla.insert(0, "Causa (Resultado final)", tabla.index)
    tabla = tabla.reset_index(drop=True)

    int_cols = (RESP_OCA, RESP_CGE, "Sin asignar", "Total")
    write_table(ws, tabla, start_row=row, int_cols=int_cols)
```

- [ ] **Step 2: Commit**

```bash
git add backend/scripts/generar_reporte_oca_marzo.py
git commit -m "feat(reporte): hoja visitas fallidas por responsabilidad"
```

---

## Task 10: Hoja genérica de Efectividad por dimensión

**Files:**
- Modify: `backend/scripts/generar_reporte_oca_marzo.py`

- [ ] **Step 1: Implementar `build_efectividad_dimension_sheet` (reusable)**

```python
def build_efectividad_dimension_sheet(
    wb: Workbook,
    sheet_name: str,
    title: str,
    dim_label: str,
    dim_df: pd.DataFrame,
) -> None:
    """Construye una hoja con la tabla de efectividad por dimensión.

    dim_df viene de compute_by_dimension; se renombra la primera columna a dim_label.
    Se agrega una fila TOTAL al final con totales y efectividades recalculadas.
    """
    ws = wb.create_sheet(sheet_name)
    ws.sheet_view.showGridLines = False
    row = write_title(ws, 1, title)
    row = write_section(ws, row, f"Métricas por {dim_label}")
    row += 1

    df = dim_df.copy()
    first_col = df.columns[0]
    df = df.rename(columns={first_col: dim_label})

    # Recomputar efectividades del total a partir de los recuentos
    total = int(df["Total"].sum())
    fallidas = int(df["Fallidas"].sum())
    fallidas_cge = int(df["Fallidas_CGE"].sum())
    normal = int(df["Normal"].sum())
    cnr = int(df["CNR"].sum())
    eff_h = (normal + cnr) / total if total else 0.0
    eff_o = 1 - (fallidas / total) if total else 0.0
    denom = total - fallidas_cge
    eff_a = 1 - ((fallidas - fallidas_cge) / denom) if denom else 0.0
    total_row = {
        dim_label: "TOTAL",
        "Total": total,
        "Normal": normal,
        "CNR": cnr,
        "Fallidas": fallidas,
        "Fallidas_CGE": fallidas_cge,
        "Fallidas_OCA": int(df["Fallidas_OCA"].sum()),
        "Eff_Hallazgo": eff_h,
        "Eff_Operativa": eff_o,
        "Eff_Ajustada": eff_a,
    }
    df = pd.concat([df, pd.DataFrame([total_row])], ignore_index=True)

    # Renombrar columnas para presentación
    df = df.rename(columns={
        "Eff_Hallazgo": "Ef. Hallazgo",
        "Eff_Operativa": "Ef. Operativa",
        "Eff_Ajustada": "Ef. Ajustada CGE",
        "Fallidas_CGE": "Fallidas CGE",
        "Fallidas_OCA": "Fallidas OCA",
    })

    int_cols = ("Total", "Normal", "CNR", "Fallidas", "Fallidas CGE", "Fallidas OCA")
    pct_cols = ("Ef. Hallazgo", "Ef. Operativa", "Ef. Ajustada CGE")
    write_table(ws, df, start_row=row, int_cols=int_cols, pct_cols=pct_cols)
```

- [ ] **Step 2: Commit**

```bash
git add backend/scripts/generar_reporte_oca_marzo.py
git commit -m "feat(reporte): builder genérico de hoja de efectividad por dimensión"
```

---

## Task 11: Hoja Resumen Ejecutivo

**Files:**
- Modify: `backend/scripts/generar_reporte_oca_marzo.py`

- [ ] **Step 1: Implementar `build_resumen_sheet`**

```python
def build_resumen_sheet(wb: Workbook, m: dict) -> None:
    """Resumen ejecutivo con KPIs en bloques tipo card."""
    ws = wb.create_sheet("Resumen Ejecutivo", 0)
    ws.sheet_view.showGridLines = False

    write_title(ws, 1, "Reporte de Efectividad OCA — Marzo 2026")
    sub = ws.cell(row=2, column=1, value="Inspecciones ejecutadas en marzo 2026")
    sub.font = FONT_KPI_HINT

    # KPIs en una grilla 2x3 (filas 4-5 etiquetas/valores, fila 6 hint)
    # Cada KPI ocupa 2 columnas. Distribuimos 5 KPIs en filas 4-7 / 9-12 / 14-17.
    kpis = [
        ("Total Inspecciones",
         f"{m['total']:,}",
         "Visitas con Fecha ejecución en marzo 2026"),
        ("Resultado Conclusivo",
         f"{(m['normal'] + m['cnr']):,} ({m['eff_hallazgo']:.1%})",
         "Normal + CNR"),
        ("CNR Detectados",
         f"{m['cnr']:,} | {m['kwh_cnr']:,} kWh",
         "Casos y energía recuperada al sistema"),
        ("Visitas Fallidas",
         f"{m['fallidas']:,} ({m['pct_fallidas_cge']:.1%} CGE)",
         f"{m['fallidas_cge']:,} atribuibles a CGE"),
        ("Efectividad Operativa",
         f"{m['eff_operativa']:.1%}  →  {m['eff_ajustada']:.1%}",
         "Bruta vs Ajustada por responsabilidad CGE"),
    ]

    for i, (label, value, hint) in enumerate(kpis):
        # 2 KPIs por fila (cols 1-3 y 4-6); última fila puede tener uno solo
        block_row = 4 + (i // 2) * 5
        block_col = 1 + (i % 2) * 4
        l = ws.cell(row=block_row, column=block_col, value=label.upper())
        l.font = FONT_KPI_LABEL
        v = ws.cell(row=block_row + 1, column=block_col, value=value)
        v.font = FONT_KPI_VALUE
        h = ws.cell(row=block_row + 3, column=block_col, value=hint)
        h.font = FONT_KPI_HINT
        # Combinar etiquetas/valores en 3 columnas para ancho de card
        ws.merge_cells(start_row=block_row, start_column=block_col,
                       end_row=block_row, end_column=block_col + 2)
        ws.merge_cells(start_row=block_row + 1, start_column=block_col,
                       end_row=block_row + 1, end_column=block_col + 2)
        ws.merge_cells(start_row=block_row + 3, start_column=block_col,
                       end_row=block_row + 3, end_column=block_col + 2)

    # Mensaje de cierre defensivo
    cierre_row = 4 + ((len(kpis) + 1) // 2) * 5 + 2
    msg = (
        f"En marzo 2026 OCA ejecutó {m['total']:,} inspecciones con efectividad "
        f"operativa de {m['eff_operativa']:.1%}. Al ajustar por las "
        f"{m['fallidas_cge']:,} visitas fallidas cuya responsabilidad recae en "
        f"CGE, la efectividad real de OCA asciende a {m['eff_ajustada']:.1%}, "
        f"con {m['cnr']:,} CNR detectados y {m['kwh_cnr']:,} kWh recuperados al sistema."
    )
    cell = ws.cell(row=cierre_row, column=1, value=msg)
    cell.font = FONT_CELL
    cell.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
    ws.merge_cells(start_row=cierre_row, start_column=1, end_row=cierre_row, end_column=7)
    ws.row_dimensions[cierre_row].height = 60

    for col in range(1, 8):
        ws.column_dimensions[get_column_letter(col)].width = 22
```

- [ ] **Step 2: Commit**

```bash
git add backend/scripts/generar_reporte_oca_marzo.py
git commit -m "feat(reporte): hoja resumen ejecutivo con KPIs y cierre defensivo"
```

---

## Task 12: Función `main()` orquestadora

**Files:**
- Modify: `backend/scripts/generar_reporte_oca_marzo.py`

- [ ] **Step 1: Implementar `main`**

Reemplazar el `raise NotImplementedError` del esqueleto:

```python
def main() -> None:
    print(f"Cargando {DATA_PATH}...")
    df_full = load_data(DATA_PATH)
    print(f"  {len(df_full):,} registros totales")

    df = filter_period(df_full, year=YEAR, month=MONTH)
    print(f"Filtradas {len(df):,} inspecciones de marzo {YEAR}")

    metrics = compute_global_metrics(df)
    print(
        f"  Total {metrics['total']:,} | "
        f"CNR {metrics['cnr']:,} | "
        f"Fallidas {metrics['fallidas']:,} (CGE: {metrics['fallidas_cge']:,}) | "
        f"kWh CNR {metrics['kwh_cnr']:,}"
    )

    by_regional = compute_by_dimension(df.rename(columns={"Regional": "Regional"}), "Regional")
    by_zona = compute_by_dimension(df, "zona")
    by_campana = compute_by_dimension(df, "Tipo de Campaña")
    cross_fallidas = compute_failed_cross(df)

    wb = Workbook()
    wb.remove(wb.active)  # quitar Sheet por defecto
    build_resumen_sheet(wb, metrics)
    build_resultados_sheet(wb, df, metrics)
    build_fallidas_sheet(wb, cross_fallidas)
    build_efectividad_dimension_sheet(
        wb, "Efectividad Regional",
        "Efectividad por Regional — Marzo 2026", "Regional", by_regional,
    )
    build_efectividad_dimension_sheet(
        wb, "Efectividad Zona",
        "Efectividad por Zona — Marzo 2026", "Zona", by_zona,
    )
    build_efectividad_dimension_sheet(
        wb, "Efectividad Campaña",
        "Efectividad por Tipo de Campaña — Marzo 2026", "Tipo de Campaña", by_campana,
    )
    build_metodologia_sheet(wb)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUTPUT_PATH)
    print(f"OK Reporte escrito en {OUTPUT_PATH}")
```

- [ ] **Step 2: Ejecutar y verificar archivo**

Run: `python3 backend/scripts/generar_reporte_oca_marzo.py`
Expected (ejemplo):
```
Cargando .../resultado_consolidado.parquet...
  180,912 registros totales
Filtradas 10,376 inspecciones de marzo 2026
  Total 10,376 | CNR 926 | Fallidas 4,288 (CGE: 882) | kWh CNR 714,610
OK Reporte escrito en .../reporte_oca_marzo_2026.xlsx
```

- [ ] **Step 3: Commit del script (sin el .xlsx)**

```bash
git add backend/scripts/generar_reporte_oca_marzo.py
git commit -m "feat(reporte): orquestación main y generación del Excel completo"
```

---

## Task 13: Smoke test integración + ignorar artefacto

**Files:**
- Modify: `backend/scripts/test_reporte_oca_marzo.py`
- Modify: `.gitignore` (si no excluye ya el .xlsx)

- [ ] **Step 1: Verificar `.gitignore`**

Run: `grep -n "xlsx\|reporte_oca" .gitignore || echo "no rule"`

Si el output es `no rule`, agregar al `.gitignore`:

```
backend/data/reporte_oca_marzo_2026.xlsx
```

- [ ] **Step 2: Test de integración end-to-end**

Agregar al final de `backend/scripts/test_reporte_oca_marzo.py` (antes de `TESTS = [...]`):

```python
def test_end_to_end_generates_workbook() -> None:
    """Ejecuta main y valida estructura del .xlsx producido."""
    import openpyxl
    r.main()
    assert r.OUTPUT_PATH.exists(), f"No se generó {r.OUTPUT_PATH}"
    wb = openpyxl.load_workbook(r.OUTPUT_PATH)
    expected = [
        "Resumen Ejecutivo",
        "Resultados Globales",
        "Fallidas y Responsabilidad",
        "Efectividad Regional",
        "Efectividad Zona",
        "Efectividad Campaña",
        "Metodología",
    ]
    assert wb.sheetnames == expected, wb.sheetnames
    # La hoja Resultados Globales debe tener una fila TOTAL
    ws = wb["Resultados Globales"]
    valores_col_a = [ws.cell(row=i, column=1).value for i in range(1, 20)]
    assert "TOTAL" in valores_col_a, valores_col_a
    print("PASS test_end_to_end_generates_workbook")
```

Y añadirlo a `TESTS`.

- [ ] **Step 3: Ejecutar suite completa**

Run: `python3 backend/scripts/test_reporte_oca_marzo.py`
Expected: `6/6 tests passed`

- [ ] **Step 4: Verificación visual**

Abrir manualmente `backend/data/reporte_oca_marzo_2026.xlsx` (o copiar a Windows si está en WSL) y revisar:
- 7 hojas en el orden correcto
- Sin emojis, paleta sobria (azul OCA + slate)
- Tablas con headers azul oscuro / texto blanco
- Números enteros con miles, porcentajes con 1 decimal
- Hoja Metodología legible

- [ ] **Step 5: Commit final**

```bash
git add backend/scripts/test_reporte_oca_marzo.py
# Solo agregar .gitignore si fue modificado en Step 1
[ -n "$(git diff --cached --name-only .gitignore 2>/dev/null)" ] && true
git diff --name-only HEAD -- .gitignore | grep -q .gitignore && git add .gitignore
git commit -m "test(reporte): smoke test end-to-end del reporte completo"
```

---

## Self-Review

**Spec coverage:**
- Filtro `Fecha ejecución` marzo 2026 → Task 2 ✓
- 3 efectividades (Hallazgo, Operativa, Ajustada CGE) → Task 3 ✓
- 5 KPIs Resumen Ejecutivo → Task 11 ✓
- Hoja Resultados Globales (5 resultados + %) → Task 8 ✓
- Hoja Fallidas × Responsabilidad → Tasks 5 + 9 ✓
- Hoja Efectividad Regional/Zona/Campaña → Tasks 4 + 10 + 12 ✓
- Hoja Metodología → Task 7 ✓
- Estilo CLAUDE.md (sin emojis, paleta OCA Blue + slate) → Task 6 ✓
- Sin valorización monetaria, solo kWh → coherente en Tasks 3 y 11 ✓
- Re-ejecutable → `main()` regenera desde cero, Task 12 ✓
- Output `backend/data/reporte_oca_marzo_2026.xlsx` → Task 12 ✓

**Placeholder scan:** ninguno. Cada paso tiene código completo o comando exacto.

**Type/name consistency:**
- `compute_global_metrics` retorna dict con claves usadas consistentemente en `build_resumen_sheet`, `build_resultados_sheet` y la fila TOTAL de `build_efectividad_dimension_sheet`.
- `compute_by_dimension` retorna columnas `Eff_Hallazgo/Eff_Operativa/Eff_Ajustada` que son renombradas en la hoja para presentación; el rename se hace dentro de `build_efectividad_dimension_sheet`, no en el cómputo, evitando inconsistencias.
- `compute_failed_cross` retorna columnas `[RESP_OCA, RESP_CGE, "Sin asignar"]`, idénticas a las usadas en `build_fallidas_sheet`.

**Riesgos cubiertos:**
- Filas con `Fecha ejecución` nulas se descartan en `filter_period` (test cubre el caso None).
- Campo `Responsabilidad` vacío se reporta como "Sin asignar" sin reclasificar (alineado con spec).
- División por cero en efectividades: el código retorna 0.0 cuando el denominador es 0.
