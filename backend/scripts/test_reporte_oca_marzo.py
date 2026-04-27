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
