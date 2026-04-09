import pandas as pd


def calculate_resultados_fallidos(df: pd.DataFrame) -> list:
    vf_df = df[df['Resultado visita'] == 'Visita fallida']
    resultado_counts = vf_df['Resultado final'].value_counts()

    data = []
    for resultado, count in resultado_counts.items():
        if pd.isna(resultado) or not resultado:
            continue
        data.append({
            "resultado": str(resultado),
            "cantidad": int(count),
        })

    return sorted(data, key=lambda x: x['cantidad'], reverse=True)[:15]
