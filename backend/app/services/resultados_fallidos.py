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


def calculate_resultados_fallidos_por_zona(df: pd.DataFrame) -> dict:
    """
    Calcula los resultados de visitas fallidas agrupados por zona.
    Retorna un diccionario donde cada clave es una zona y el valor es una lista de resultados.
    """
    result = {}

    if 'Resultado visita' not in df.columns or 'zona' not in df.columns:
        return result

    vf_df = df[df['Resultado visita'] == 'Visita fallida'].copy()

    # Excluir "No Asignados"
    vf_df = vf_df[vf_df['zona'] != 'No Asignados']

    if vf_df.empty:
        return result

    # Agrupar por zona
    for zona in vf_df['zona'].unique():
        zona_df = vf_df[vf_df['zona'] == zona]
        resultado_counts = zona_df['Resultado final'].value_counts()

        zona_data = []
        for resultado, count in resultado_counts.items():
            if pd.isna(resultado) or not resultado:
                continue
            zona_data.append({
                "resultado": str(resultado),
                "cantidad": int(count),
            })

        # Ordenar por cantidad y tomar top 15
        zona_data = sorted(zona_data, key=lambda x: x['cantidad'], reverse=True)[:15]
        result[zona] = zona_data

    return result
