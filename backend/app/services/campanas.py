import pandas as pd


def calculate_campanas(filtered: pd.DataFrame) -> list:
    campanas_data = []
    for desc in filtered['Descripción del aviso'].dropna().unique():
        camp_df = filtered[filtered['Descripción del aviso'] == desc]
        c_resultado = camp_df['Resultado visita'].value_counts()
        c_normal = int(c_resultado.get('Normal', 0))
        c_cnr = int(c_resultado.get('CNR', 0))
        c_vf = int(c_resultado.get('Visita fallida', 0))
        c_efectivas = c_normal + c_cnr
        c_total = c_efectivas + c_vf
        if c_total < 10:
            continue
        c_cnr_tipo = camp_df[camp_df['Resultado visita'] == 'CNR']['Tipo_CNR.Tipo de CNR'].value_counts()
        c_cnr_falla = int(c_cnr_tipo.get('CNR Falla', 0))
        c_cnr_hurto = int(c_cnr_tipo.get('CNR Hurto', 0))
        campanas_data.append({
            "descripcion": desc[:60] + '...' if len(desc) > 60 else desc,
            "normal": c_normal,
            "cnr": c_cnr,
            "pct_cnr": (c_cnr / c_efectivas * 100) if c_efectivas > 0 else 0,
            "efectivas": c_efectivas,
            "pct_efectivas": (c_efectivas / c_total * 100) if c_total > 0 else 0,
            "visita_fallida": c_vf,
            "pct_visita_fallida": (c_vf / c_total * 100) if c_total > 0 else 0,
            "cnr_falla": c_cnr_falla,
            "pct_cnr_falla": (c_cnr_falla / c_cnr * 100) if c_cnr > 0 else 0,
            "cnr_hurto": c_cnr_hurto,
            "pct_cnr_hurto": (c_cnr_hurto / c_cnr * 100) if c_cnr > 0 else 0,
        })
    campanas_data = sorted(campanas_data, key=lambda x: x['efectivas'], reverse=True)[:30]
    return campanas_data
