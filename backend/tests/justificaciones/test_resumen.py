"""
Tests del cálculo de resumen mensual (cruce parquet + sqlite).
Usa un calendario falso para no depender del dataset real.
"""
import pytest
from app.services.justificaciones import service, repository as repo


@pytest.fixture
def analista(conn):
    return repo.create_analista(conn, nombre="diego.bravo")


# Calendario sintético: 22 días hábiles, 5 sin trabajo, 3 con baja, 14 ok.
CALENDARIO_FAKE = {
    "calendario": [
        # 5 días sin trabajo (sin_trabajo, hábiles, no futuros)
        {"fecha": "2026-05-04", "es_habil": True, "es_futuro": False, "trabajo": False},
        {"fecha": "2026-05-05", "es_habil": True, "es_futuro": False, "trabajo": False},
        {"fecha": "2026-05-06", "es_habil": True, "es_futuro": False, "trabajo": False},
        {"fecha": "2026-05-07", "es_habil": True, "es_futuro": False, "trabajo": False},
        {"fecha": "2026-05-08", "es_habil": True, "es_futuro": False, "trabajo": False},
        # 3 días con baja producción (trabajaron < 4)
        {"fecha": "2026-05-11", "es_habil": True, "es_futuro": False, "trabajo": True},
        {"fecha": "2026-05-12", "es_habil": True, "es_futuro": False, "trabajo": True},
        {"fecha": "2026-05-13", "es_habil": True, "es_futuro": False, "trabajo": True},
        # 14 días ok (>= 4)
        *[
            {"fecha": f"2026-05-{d:02d}", "es_habil": True, "es_futuro": False, "trabajo": True}
            for d in (14, 15, 18, 19, 20, 22, 25, 26, 27, 28, 29)
        ],
    ],
    "dias": [
        {"fecha": "2026-05-11", "efectivas": 2},
        {"fecha": "2026-05-12", "efectivas": 3},
        {"fecha": "2026-05-13", "efectivas": 1},
        {"fecha": "2026-05-14", "efectivas": 8},
        {"fecha": "2026-05-15", "efectivas": 9},
        {"fecha": "2026-05-18", "efectivas": 7},
        {"fecha": "2026-05-19", "efectivas": 8},
        {"fecha": "2026-05-20", "efectivas": 8},
        {"fecha": "2026-05-22", "efectivas": 10},
        {"fecha": "2026-05-25", "efectivas": 8},
        {"fecha": "2026-05-26", "efectivas": 8},
        {"fecha": "2026-05-27", "efectivas": 9},
        {"fecha": "2026-05-28", "efectivas": 8},
        {"fecha": "2026-05-29", "efectivas": 8},
    ],
    "total_dias": 14,
}


def test_resumen_sin_justificaciones(conn, analista):
    r = service.calcular_resumen(
        conn,
        tecnico_nombre="JAIRO PEREZ",
        mes="2026-05",
        calendario_data=CALENDARIO_FAKE,
        meta_diaria=8,
        dias_habiles_mes=22,
    )
    assert r["dias_no_trabajados_total"] == 5
    assert r["dias_no_trabajados_justificados"] == 0
    assert r["dias_baja_produccion_total"] == 3
    assert r["dias_baja_produccion_justificados"] == 0
    assert r["dias_pendientes_justificar"] == 8
    assert r["efectivas_totales"] == 2 + 3 + 1 + 8 + 9 + 7 + 8 + 8 + 10 + 8 + 8 + 9 + 8 + 8  # 97
    assert r["cumplimiento_real"] == pytest.approx(97 / (22 * 8))


def test_resumen_con_justificaciones_ajusta_cumplimiento(conn, analista):
    # Justificar 5 días no trabajados como dia_no_trabajado
    for fecha in ("2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07", "2026-05-08"):
        service.crear_justificacion(
            conn, fecha=fecha, tecnico_nombre="JAIRO PEREZ",
            zona_origen="07. RANCAGUA", produccion_real=0, meta_diaria=8,
            motivo="licencia_medica", comentario=None,
            usuario_registro="diego.bravo", es_futuro=False,
        )
    # Justificar 1 día de baja
    service.crear_justificacion(
        conn, fecha="2026-05-11", tecnico_nombre="JAIRO PEREZ",
        zona_origen="07. RANCAGUA", produccion_real=2, meta_diaria=8,
        motivo="cliente_ausente", comentario=None,
        usuario_registro="diego.bravo", es_futuro=False,
    )

    r = service.calcular_resumen(
        conn,
        tecnico_nombre="JAIRO PEREZ",
        mes="2026-05",
        calendario_data=CALENDARIO_FAKE,
        meta_diaria=8,
        dias_habiles_mes=22,
    )
    assert r["dias_no_trabajados_justificados"] == 5
    assert r["dias_baja_produccion_justificados"] == 1
    assert r["dias_pendientes_justificar"] == 2  # 8 totales - 6 justificados
    # Días hábiles efectivos = 22 - 5 = 17. Cumplimiento ajustado = 97 / (17*8)
    assert r["cumplimiento_ajustado"] == pytest.approx(97 / (17 * 8))


def test_resumen_no_cuenta_dias_futuros_en_pendientes(conn, analista):
    cal = {
        "calendario": [
            {"fecha": "2026-05-04", "es_habil": True, "es_futuro": False, "trabajo": False},
            {"fecha": "2026-05-25", "es_habil": True, "es_futuro": True, "trabajo": False},
        ],
        "dias": [],
        "total_dias": 0,
    }
    r = service.calcular_resumen(
        conn, tecnico_nombre="JAIRO PEREZ", mes="2026-05",
        calendario_data=cal, meta_diaria=8, dias_habiles_mes=2,
    )
    assert r["dias_no_trabajados_total"] == 1  # solo el no-futuro cuenta
    assert r["dias_pendientes_justificar"] == 1
