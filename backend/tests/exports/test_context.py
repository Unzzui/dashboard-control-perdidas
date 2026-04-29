from app.services.exports.context import InformeContext, MesData


def test_informe_context_default_construction():
    actual = MesData(
        año=2026, mes=4, mes_nombre="Abril",
        kpis={"total_efectivas": 100},
        tecnicos=[],
        zonas=[],
        daily=[],
        produccion_total=1_000_000,
        visitas_fallidas_resp=[],
        resultados_fallidos=[],
        alertas={},
        calendario={"total_habiles": 22, "meta_efectivas": 176},
        promedio_efectivas_oficial=8.0,
        brigadas_unicas=51,
    )
    anterior = MesData(
        año=2026, mes=3, mes_nombre="Marzo",
        kpis={"total_efectivas": 90},
        tecnicos=[],
        zonas=[],
        daily=[],
        produccion_total=900_000,
        visitas_fallidas_resp=[],
        resultados_fallidos=[],
        alertas={},
        calendario={"total_habiles": 20, "meta_efectivas": 160},
        promedio_efectivas_oficial=7.5,
        brigadas_unicas=45,
    )
    ctx = InformeContext(actual=actual, anterior=anterior)

    assert ctx.actual.brigadas_unicas == 51
    assert ctx.anterior.brigadas_unicas == 45
    assert ctx.delta_brigadas == 6


import pytest
from app.services.exports.context import build_context


def test_build_context_returns_data_for_existing_month():
    """Smoke test: construye contexto para un mes que existe en el dataset."""
    from app.dependencies import get_dataframe
    df = get_dataframe()
    años_disponibles = sorted(df['año'].dropna().unique().tolist())
    if not años_disponibles:
        pytest.skip("No hay datos en el dataset")
    año = int(años_disponibles[-1])
    meses_año = sorted(df[df['año'] == año]['mes'].dropna().unique().tolist())
    mes = int(meses_año[-1])

    ctx = build_context(año, mes)

    assert ctx.actual.año == año
    assert ctx.actual.mes == mes
    assert ctx.actual.kpis is not None
    assert isinstance(ctx.actual.brigadas_unicas, int)
    assert ctx.actual.brigadas_unicas >= 0


def test_build_context_raises_on_missing_month():
    """Mes sin datos lanza ValueError."""
    with pytest.raises(ValueError, match="No hay datos"):
        build_context(1900, 1)
