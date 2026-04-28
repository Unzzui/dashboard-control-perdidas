def calculate_promedio_efectivas(tecnicos: list, total_visita_fallida_cge: int = 0) -> dict:
    """Métrica oficial de evaluación de brigadas (single source of truth).

    1) Deduplica por nombre — técnicos en múltiples zonas cuentan una vez.
    2) Para multi-zona usa promedio_efectivas_global (ya ponderado dentro de la brigada);
       para zona única usa promedio_efectivas directamente.
    3) Promedio aritmético sobre brigadas únicas.

    Es el cálculo que muestra Control Metas. Cualquier vista que muestre
    "promedio efectivas/día" debe leer este valor del payload, no recomputarlo.

    Devuelve también:
    - promedio_efectivas_ponderado: sum(efectivas)/sum(días) — métrica comparativa.
    - promedio_efectivas_ajustado_sin_cge: oficial escalado por el ratio de
      recuperación si las fallidas-CGE se contaran como efectivas.
    - total_dias_brigada / total_brigadas_unicas: base del cálculo.
    """
    if not tecnicos:
        return {
            "promedio_efectivas_oficial": 0.0,
            "promedio_efectivas_ponderado": 0.0,
            "promedio_efectivas_ajustado_sin_cge": 0.0,
            "total_dias_brigada": 0,
            "total_brigadas_unicas": 0,
        }

    seen: dict = {}
    for t in tecnicos:
        nombre = t.get("nombre")
        if not nombre or nombre in seen:
            continue
        is_multi = t.get("cantidad_zonas", 1) > 1
        seen[nombre] = {
            "efectivas_dia": float(
                t["promedio_efectivas_global"] if is_multi else t["promedio_efectivas"]
            ),
            "efectivas": int(t["efectivas_global"] if is_multi else t["efectivas"]),
            "dias": int(t["dias_global"] if is_multi else t["dias_trabajados"]),
        }

    brigadas = list(seen.values())
    if not brigadas:
        return {
            "promedio_efectivas_oficial": 0.0,
            "promedio_efectivas_ponderado": 0.0,
            "promedio_efectivas_ajustado_sin_cge": 0.0,
            "total_dias_brigada": 0,
            "total_brigadas_unicas": 0,
        }

    oficial = sum(b["efectivas_dia"] for b in brigadas) / len(brigadas)

    total_efectivas = sum(b["efectivas"] for b in brigadas)
    total_dias = sum(b["dias"] for b in brigadas)
    ponderado = (total_efectivas / total_dias) if total_dias > 0 else 0.0

    ratio = (
        (total_efectivas + total_visita_fallida_cge) / total_efectivas
        if total_efectivas > 0
        else 1.0
    )
    ajustado = oficial * ratio

    return {
        "promedio_efectivas_oficial": round(oficial, 2),
        "promedio_efectivas_ponderado": round(ponderado, 2),
        "promedio_efectivas_ajustado_sin_cge": round(ajustado, 2),
        "total_dias_brigada": int(total_dias),
        "total_brigadas_unicas": len(brigadas),
    }
