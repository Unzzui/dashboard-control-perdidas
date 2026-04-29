from app.services.exports.context import InformeContext


META_PROMEDIO_DIARIO = 8.0
META_CNR_PCT = 20.0
META_EFECTIVAS_PCT = 80.0


def _safe_pct(num: float, den: float) -> float:
    return (num / den * 100) if den else 0.0


def narrar_contexto(ctx: InformeContext) -> str:
    actual = ctx.actual
    if ctx.anterior is None:
        return (
            f"Este mes de {actual.mes_nombre} {actual.año} iniciamos la operación con un total de "
            f"{actual.brigadas_unicas} brigadas. Este es el primer mes con datos disponibles, por lo "
            f"que no aplica comparativo con el período anterior (sin comparativo previo)."
        )
    anterior = ctx.anterior
    delta = ctx.delta_brigadas
    if delta > 0:
        cambio = f"un incremento respecto a las {anterior.brigadas_unicas} brigadas operativas en el mes anterior ({anterior.mes_nombre})"
    elif delta < 0:
        cambio = f"una reducción respecto a las {anterior.brigadas_unicas} brigadas del mes anterior ({anterior.mes_nombre})"
    else:
        cambio = f"misma dotación que en el mes anterior — {anterior.mes_nombre} ({anterior.brigadas_unicas} brigadas)"
    dias_habiles = actual.calendario.get("total_habiles", 0) if actual.calendario else 0
    return (
        f"Este mes de {actual.mes_nombre} {actual.año} representa un período de operación con un total de "
        f"{actual.brigadas_unicas} brigadas, lo que supone {cambio}. "
        f"El período comprende {dias_habiles} días hábiles de operación."
    )


def narrar_pulso(ctx: InformeContext) -> str:
    actual = ctx.actual
    prom_actual = actual.promedio_efectivas_oficial
    if ctx.anterior is None:
        return (
            f"El promedio de efectivas diarias consolidado se ubicó en {prom_actual:.1f}, "
            f"contra una meta de {META_PROMEDIO_DIARIO:.1f} efectivas por día."
        )
    prom_anterior = ctx.anterior.promedio_efectivas_oficial
    delta = prom_actual - prom_anterior
    if delta > 0.3:
        tendencia = "subió"
        explicacion = "lo que refleja una operación en mayor ritmo respecto al mes anterior."
    elif delta < -0.3:
        tendencia = "bajó"
        explicacion = (
            "lo que se explica probablemente por la curva de aprendizaje de las brigadas "
            "recientemente activadas y por factores operativos del período."
        )
    else:
        tendencia = "se mantuvo estable"
        explicacion = "consolidando el ritmo del período anterior."
    return (
        f"El promedio de efectivas diarias consolidado se situó en {prom_actual:.1f}. "
        f"Al comparar con {ctx.anterior.mes_nombre} ({prom_anterior:.1f}), el indicador {tendencia}, "
        f"{explicacion}"
    )


def narrar_visitas_fallidas(ctx: InformeContext) -> str:
    k = ctx.actual.kpis
    pct_real = float(k.get("pct_efectivas", 0))
    pct_ajustada = float(k.get("pct_efectivas_sin_cge_excluida", 0))
    delta = pct_ajustada - pct_real
    vf_cge = int(k.get("total_visita_fallida_cge", 0))
    vf_total = int(k.get("total_visita_fallida", 0))
    pct_cge = _safe_pct(vf_cge, vf_total)
    if delta > 5:
        cierre = (
            "Esto demuestra que factores externos (responsabilidad CGE) pesan significativamente "
            "sobre el indicador final de efectividad."
        )
    else:
        cierre = "El impacto de factores externos es acotado en el período."
    return (
        f"De las {vf_total} visitas fallidas totales del período, el {pct_cge:.1f}% corresponden a "
        f"responsabilidad CGE. La efectividad real fue {pct_real:.1f}%, mientras que la efectividad "
        f"ajustada (excluyendo responsabilidad CGE) sube a {pct_ajustada:.1f}%. {cierre}"
    )


def narrar_plan_accion(ctx: InformeContext) -> list[str]:
    actual = ctx.actual
    bullets: list[str] = []
    k = actual.kpis
    pct_efectivas = float(k.get("pct_efectivas", 0))
    pct_cnr = float(k.get("pct_cnr", 0))
    vf_cge = int(k.get("total_visita_fallida_cge", 0))
    vf_total = int(k.get("total_visita_fallida", 0))
    pct_cge = _safe_pct(vf_cge, vf_total)

    if pct_cge > 30:
        bullets.append(
            f"Trabajar en conjunto con CGE para mitigar las causas de falla externas, "
            f"que representan el {pct_cge:.1f}% de las visitas fallidas del período."
        )

    no_cumplen = sum(1 for t in actual.tecnicos if not t.get("cumple_meta_global", False))
    if no_cumplen > 0:
        bullets.append(
            f"Reforzar el acompañamiento operativo a las {no_cumplen} brigadas que no alcanzaron "
            f"la meta de efectivas/día, con foco en las de reciente activación."
        )

    if pct_cnr > META_CNR_PCT:
        bullets.append(
            f"Revisar la calidad de la información de terreno: el CNR del {pct_cnr:.1f}% supera "
            f"el umbral contractual del {META_CNR_PCT:.0f}%."
        )

    if pct_efectivas < META_EFECTIVAS_PCT:
        bullets.append(
            f"Ejecutar plan de cierre de brecha en zonas con menor desempeño para acercar el "
            f"% de visita efectiva ({pct_efectivas:.1f}%) a la meta ({META_EFECTIVAS_PCT:.0f}%)."
        )

    if not bullets:
        bullets.append(
            "Mantener el ritmo operativo del período y consolidar las prácticas de las brigadas "
            "que destacaron en cumplimiento de meta."
        )
    return bullets
