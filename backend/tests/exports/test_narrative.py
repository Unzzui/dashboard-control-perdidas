from app.services.exports.context import InformeContext, MesData
from app.services.exports.narrative import (
    narrar_contexto,
    narrar_pulso,
    narrar_visitas_fallidas,
    narrar_plan_accion,
)


def _mes(brigadas=51, prom=7.2, vf_cge=10, total_efectivas=1000, prod=10_000_000):
    return MesData(
        año=2026, mes=4, mes_nombre="Abril",
        kpis={
            "total_efectivas": total_efectivas,
            "total_visita_fallida_cge": vf_cge,
            "total_visita_fallida": 100,
            "pct_efectivas": 78.0,
            "pct_efectivas_sin_cge_excluida": 84.0,
            "pct_cnr": 18.5,
            "total_registros": 1280,
            "promedio_efectivas_oficial": prom,
        },
        tecnicos=[], zonas=[], daily=[], produccion_total=prod,
        visitas_fallidas_resp=[], resultados_fallidos=[], alertas={},
        calendario={"total_habiles": 22, "meta_efectivas": 176},
        promedio_efectivas_oficial=prom,
        brigadas_unicas=brigadas,
    )


def test_narrar_contexto_con_incremento_brigadas():
    ctx = InformeContext(actual=_mes(brigadas=51), anterior=_mes(brigadas=45))
    texto = narrar_contexto(ctx)
    assert "51" in texto
    assert "incremento" in texto.lower()
    assert "marzo" in texto.lower() or "anterior" in texto.lower()


def test_narrar_contexto_sin_mes_anterior():
    ctx = InformeContext(actual=_mes(brigadas=51), anterior=None)
    texto = narrar_contexto(ctx)
    assert "51" in texto
    assert "sin comparativo" in texto.lower() or "primer mes" in texto.lower()


def test_narrar_pulso_promedio_subio():
    ctx = InformeContext(actual=_mes(prom=8.0), anterior=_mes(prom=7.0))
    texto = narrar_pulso(ctx)
    assert "subió" in texto.lower() or "incrementó" in texto.lower()


def test_narrar_pulso_promedio_bajo():
    ctx = InformeContext(actual=_mes(prom=6.5), anterior=_mes(prom=7.5))
    texto = narrar_pulso(ctx)
    assert "bajó" in texto.lower() or "curva de aprendizaje" in texto.lower()


def test_narrar_visitas_fallidas_efectividad_ajustada():
    ctx = InformeContext(actual=_mes(), anterior=None)
    texto = narrar_visitas_fallidas(ctx)
    assert "78" in texto or "84" in texto


def test_narrar_plan_accion_devuelve_bullets():
    ctx = InformeContext(actual=_mes(), anterior=_mes(brigadas=45))
    bullets = narrar_plan_accion(ctx)
    assert isinstance(bullets, list)
    assert len(bullets) >= 1
    assert all(isinstance(b, str) and len(b) > 10 for b in bullets)
