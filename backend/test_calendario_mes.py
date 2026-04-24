#!/usr/bin/env python3
"""Test del helper calendario_mes."""

import sys
sys.path.insert(0, '.')

import calendar as _cal
import pandas as pd
from app.services.calendario_mes import build_calendario_mes


def _make_df(fechas):
    return pd.DataFrame({"Fecha ejecución": pd.to_datetime(fechas)})


def test_mes_completo_abril_2026():
    df = _make_df(["2026-04-01", "2026-04-15", "2026-04-30"])
    res = build_calendario_mes(df)
    assert res is not None, "Debe devolver dict cuando hay datos"
    assert res["numero_mes"] == 4
    assert res["año"] == 2026
    assert res["mes"] == "abril"
    assert res["dias_en_mes"] == 30
    # Abril 2026: sábados son 4, 11, 18, 25
    assert res["sabados"] == [4, 11, 18, 25]
    # Domingos 5, 12, 19, 26
    assert res["domingos"] == [5, 12, 19, 26]
    # Feriados en abril 2026: Viernes Santo (3), Sábado Santo (4)
    assert 3 in res["feriados"]
    assert 4 in res["feriados"]
    # Hábiles: días no sábado, no domingo, no feriado
    assert res["total_habiles"] == 30 - len(set(res["sabados"]) | set(res["domingos"]) | set(res["feriados"]))


def test_elige_ultimo_mes_con_datos():
    df = _make_df(["2026-02-15", "2026-03-10", "2026-03-25"])
    res = build_calendario_mes(df)
    assert res["numero_mes"] == 3, "Debe elegir marzo (el último con datos)"


def test_df_vacio_retorna_none():
    df = pd.DataFrame({"Fecha ejecución": pd.to_datetime([])})
    assert build_calendario_mes(df) is None


def test_mes_sin_feriados():
    # Julio 2026 sólo tiene el 16 (Virgen del Carmen)
    df = _make_df(["2026-07-02"])
    res = build_calendario_mes(df)
    assert res["feriados"] == [16]


if __name__ == "__main__":
    test_mes_completo_abril_2026()
    test_elige_ultimo_mes_con_datos()
    test_df_vacio_retorna_none()
    test_mes_sin_feriados()
    print("OK — calendario_mes helper")
