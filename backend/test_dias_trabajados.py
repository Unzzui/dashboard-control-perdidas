#!/usr/bin/env python3
"""Test de dias_trabajados en pago_tecnicos."""

import sys
sys.path.insert(0, '.')

import pandas as pd
from app.services.pago_tecnicos import calculate_pago_tecnicos


def _make_row(nombre, fecha, resultado="Normal", zona="07. RANCAGUA"):
    return {
        "Nombre asignado": nombre,
        "Fecha ejecución": pd.Timestamp(fecha),
        "Resultado visita": resultado,
        "Resultado final": "",
        "Tipo_CNR.Tipo de CNR": "",
        "Comuna": "Rancagua",
        "zona_tecnico": zona,
        "zona_inspeccion": zona,
        "regional_tecnico": "Centro",
    }


def test_dias_trabajados_cuenta_dias_unicos_del_ultimo_mes():
    # Mario en marzo 3 días diferentes, en abril 2 días — el calendario visualizado es abril
    rows = [
        _make_row("Mario Perez", "2026-03-05"),
        _make_row("Mario Perez", "2026-03-06"),
        _make_row("Mario Perez", "2026-03-07"),
        _make_row("Mario Perez", "2026-04-01"),
        _make_row("Mario Perez", "2026-04-01"),  # repetido mismo día
        _make_row("Mario Perez", "2026-04-15"),
    ]
    df = pd.DataFrame(rows)
    res = calculate_pago_tecnicos(df)
    mario = next((r for r in res if r["nombre"].upper().startswith("MARIO")), None)
    assert mario is not None, "Mario debe estar en el resultado"
    # dias_trabajados es del último mes con datos (abril): 1 y 15
    assert mario["dias_trabajados"] == [1, 15], f"Esperado [1,15], obtuvo {mario['dias_trabajados']}"
    assert mario["dias_trabajados_count"] == 2
    assert mario["sabados_trabajados_count"] == 0  # ni 1-abr ni 15-abr son sábado


def test_sabado_se_cuenta_correctamente():
    # 4 abril 2026 es sábado
    rows = [
        _make_row("Juan Soto", "2026-04-04"),
        _make_row("Juan Soto", "2026-04-07"),
    ]
    df = pd.DataFrame(rows)
    res = calculate_pago_tecnicos(df)
    juan = next((r for r in res if "JUAN" in r["nombre"].upper()), None)
    assert juan is not None
    assert juan["dias_trabajados"] == [4, 7]
    assert juan["dias_trabajados_count"] == 2
    assert juan["sabados_trabajados_count"] == 1


def test_sin_datos_devuelve_lista_vacia():
    df = pd.DataFrame(columns=[
        "Nombre asignado", "Fecha ejecución", "Resultado visita", "Resultado final",
        "Tipo_CNR.Tipo de CNR", "Comuna", "zona_tecnico", "zona_inspeccion", "regional_tecnico",
    ])
    assert calculate_pago_tecnicos(df) == []


if __name__ == "__main__":
    test_dias_trabajados_cuenta_dias_unicos_del_ultimo_mes()
    test_sabado_se_cuenta_correctamente()
    test_sin_datos_devuelve_lista_vacia()
    print("OK — dias_trabajados")
