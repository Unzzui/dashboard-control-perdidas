"""Construye la metadata del mes visualizado en el calendario de brigadas."""

import calendar as _cal
import pandas as pd
from app.config import FERIADOS_CL, MESES_MAP, EFECTIVAS_POR_DIA


def compute_estructura_mes(año: int, numero_mes: int) -> dict:
    """
    Devuelve la estructura del mes (sábados, domingos, feriados, total hábiles)
    para un (año, mes) dado. Reusable desde otros servicios.
    """
    dias_en_mes = _cal.monthrange(año, numero_mes)[1]

    sabados: list[int] = []
    domingos: list[int] = []
    for d in range(1, dias_en_mes + 1):
        dow = pd.Timestamp(year=año, month=numero_mes, day=d).dayofweek  # 0=Lun, 5=Sáb, 6=Dom
        if dow == 5:
            sabados.append(d)
        elif dow == 6:
            domingos.append(d)

    feriados_año = FERIADOS_CL.get(año, set())
    feriados = sorted(d for (m, d) in feriados_año if m == numero_mes)

    no_habiles = set(sabados) | set(domingos) | set(feriados)
    total_habiles = dias_en_mes - len(no_habiles)

    return {
        "dias_en_mes": dias_en_mes,
        "sabados": sabados,
        "domingos": domingos,
        "feriados": feriados,
        "total_habiles": total_habiles,
    }


def compute_meta_efectivas(total_habiles: int) -> int:
    """Meta dinámica: 8 efectivas/día × días hábiles del mes."""
    return int(EFECTIVAS_POR_DIA * max(0, total_habiles))


def build_calendario_mes(filtered: pd.DataFrame) -> dict | None:
    """
    Devuelve la metadata del último mes con datos dentro del dataframe filtrado.

    Estructura de salida:
        {
            "mes": "abril",
            "año": 2026,
            "numero_mes": 4,
            "dias_en_mes": 30,
            "sabados": [4, 11, 18, 25],
            "domingos": [5, 12, 19, 26],
            "feriados": [3, 4],
            "total_habiles": 21,
            "meta_efectivas": 168,
        }

    Devuelve None si el dataframe está vacío o no tiene "Fecha ejecución".
    """
    if filtered is None or filtered.empty or "Fecha ejecución" not in filtered.columns:
        return None

    fechas = pd.to_datetime(filtered["Fecha ejecución"], errors="coerce").dropna()
    if fechas.empty:
        return None

    # Último mes con datos: mayor (año, mes) presente
    periodos = fechas.dt.to_period("M")
    ultimo = periodos.max()
    año = int(ultimo.year)
    numero_mes = int(ultimo.month)

    estructura = compute_estructura_mes(año, numero_mes)

    return {
        "mes": MESES_MAP.get(numero_mes, str(numero_mes)),
        "año": año,
        "numero_mes": numero_mes,
        "dias_en_mes": estructura["dias_en_mes"],
        "sabados": estructura["sabados"],
        "domingos": estructura["domingos"],
        "feriados": estructura["feriados"],
        "total_habiles": estructura["total_habiles"],
        "meta_efectivas": compute_meta_efectivas(estructura["total_habiles"]),
    }
