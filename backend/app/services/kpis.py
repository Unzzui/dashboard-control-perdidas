import pandas as pd


def calculate_kpis(filtered: pd.DataFrame) -> dict:
    total = len(filtered)
    resultado_counts = filtered['Resultado visita'].value_counts()
    total_normal = int(resultado_counts.get('Normal', 0))
    total_cnr = int(resultado_counts.get('CNR', 0))
    total_visita_fallida = int(resultado_counts.get('Visita fallida', 0))
    total_efectivas = total_normal + total_cnr
    cnr_tipo = filtered[filtered['Resultado visita'] == 'CNR']['Tipo_CNR.Tipo de CNR'].value_counts()
    cnr_falla = int(cnr_tipo.get('CNR Falla', 0))
    cnr_hurto = int(cnr_tipo.get('CNR Hurto', 0))
    kwh_recuperado = int(filtered['kWh CNR'].sum())
    pct_efectivas = (total_efectivas / total * 100) if total > 0 else 0
    pct_cnr = (total_cnr / total_efectivas * 100) if total_efectivas > 0 else 0
    pct_visita_fallida = (total_visita_fallida / total * 100) if total > 0 else 0
    pct_cnr_falla = (cnr_falla / total_cnr * 100) if total_cnr > 0 else 0
    pct_cnr_hurto = (cnr_hurto / total_cnr * 100) if total_cnr > 0 else 0

    return {
        "total_registros": total,
        "total_normal": total_normal,
        "total_cnr": total_cnr,
        "pct_cnr": pct_cnr,
        "total_visita_fallida": total_visita_fallida,
        "pct_visita_fallida": pct_visita_fallida,
        "total_efectivas": total_efectivas,
        "pct_efectivas": pct_efectivas,
        "cnr_falla": cnr_falla,
        "pct_cnr_falla": pct_cnr_falla,
        "cnr_hurto": cnr_hurto,
        "pct_cnr_hurto": pct_cnr_hurto,
        "kwh_recuperado": kwh_recuperado,
    }
