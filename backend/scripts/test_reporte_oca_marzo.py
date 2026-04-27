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


TESTS = [
    test_filter_period_keeps_only_march_2026,
    test_load_data_real_returns_dataframe,
    test_compute_global_metrics_known_values,
    test_compute_by_dimension_two_groups,
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
