import pandas as pd
from app.config import MESES_MAP


def calculate_mensual(filtered: pd.DataFrame) -> list:
    mensual_data = []
    for mes_num in sorted(filtered['mes'].dropna().unique()):
        mes_df = filtered[filtered['mes'] == mes_num]
        m_resultado = mes_df['Resultado visita'].value_counts()
        m_normal = int(m_resultado.get('Normal', 0))
        m_cnr = int(m_resultado.get('CNR', 0))
        m_vf = int(m_resultado.get('Visita fallida', 0))
        m_efectivas = m_normal + m_cnr
        m_total = m_efectivas + m_vf
        m_cnr_tipo = mes_df[mes_df['Resultado visita'] == 'CNR']['Tipo_CNR.Tipo de CNR'].value_counts()
        m_cnr_falla = int(m_cnr_tipo.get('CNR Falla', 0))
        m_cnr_hurto = int(m_cnr_tipo.get('CNR Hurto', 0))
        mensual_data.append({
            "mes": MESES_MAP.get(int(mes_num), str(mes_num)),
            "normal": m_normal,
            "cnr_falla": m_cnr_falla,
            "pct_cnr_falla": (m_cnr_falla / m_cnr * 100) if m_cnr > 0 else 0,
            "cnr_hurto": m_cnr_hurto,
            "pct_cnr_hurto": (m_cnr_hurto / m_cnr * 100) if m_cnr > 0 else 0,
            "cnr": m_cnr,
            "pct_cnr": (m_cnr / m_efectivas * 100) if m_efectivas > 0 else 0,
            "efectivas": m_efectivas,
            "pct_efectivas": (m_efectivas / m_total * 100) if m_total > 0 else 0,
            "visita_fallida": m_vf,
            "pct_visita_fallida": (m_vf / m_total * 100) if m_total > 0 else 0,
        })
    return mensual_data
