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
