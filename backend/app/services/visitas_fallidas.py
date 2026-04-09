import pandas as pd


def calculate_visitas_fallidas(filtered: pd.DataFrame) -> list:
    vf_resp_data = []
    vf_df = filtered[filtered['Resultado visita'] == 'Visita fallida']
    for desc in vf_df['Descripción del aviso'].dropna().unique():
        desc_df = vf_df[vf_df['Descripción del aviso'] == desc]
        resp_counts = desc_df['Responsabilidad'].value_counts()
        r_cge = int(resp_counts.get('Responsabilidad CGE', 0))
        r_contratista = int(resp_counts.get('Responsabilidad Contratista', 0))
        total_resp = r_cge + r_contratista
        if total_resp < 5:
            continue
        vf_resp_data.append({
            "descripcion": desc[:50] + '...' if len(desc) > 50 else desc,
            "responsabilidad_cge": r_cge,
            "pct_cge": (r_cge / total_resp * 100) if total_resp > 0 else 0,
            "responsabilidad_contratista": r_contratista,
            "pct_contratista": (r_contratista / total_resp * 100) if total_resp > 0 else 0,
            "total": total_resp,
        })
    vf_resp_data = sorted(vf_resp_data, key=lambda x: x['total'], reverse=True)[:20]
    return vf_resp_data
