import pandas as pd


def calculate_resultados_fallidos(df: pd.DataFrame) -> list:
    vf_df = df[df['Resultado visita'] == 'Visita fallida']
    if vf_df.empty:
        return []

    grouped = (
        vf_df.groupby('Resultado final')['Responsabilidad']
        .value_counts()
        .unstack(fill_value=0)
    )

    data = []
    for resultado, row in grouped.iterrows():
        if pd.isna(resultado) or not resultado:
            continue
        cge = int(row.get('Responsabilidad CGE', 0))
        oca = int(row.get('Responsabilidad Contratista', 0))
        total = cge + oca
        if total == 0:
            continue
        data.append({
            "resultado": str(resultado),
            "cantidad": total,
            "cantidad_cge": cge,
            "cantidad_oca": oca,
        })

    return sorted(data, key=lambda x: x['cantidad'], reverse=True)


def calculate_resultados_fallidos_por_zona(df: pd.DataFrame) -> dict:
    """
    Calcula los resultados de visitas fallidas agrupados por zona.
    Retorna un diccionario donde cada clave es una zona y el valor es una lista de resultados.
    """
    result = {}

    if 'Resultado visita' not in df.columns or 'zona' not in df.columns:
        return result

    vf_df = df[df['Resultado visita'] == 'Visita fallida'].copy()
    vf_df = vf_df[vf_df['zona'] != 'No Asignados']

    if vf_df.empty:
        return result

    for zona in vf_df['zona'].unique():
        zona_df = vf_df[vf_df['zona'] == zona]
        grouped = (
            zona_df.groupby('Resultado final')['Responsabilidad']
            .value_counts()
            .unstack(fill_value=0)
        )

        zona_data = []
        for resultado, row in grouped.iterrows():
            if pd.isna(resultado) or not resultado:
                continue
            cge = int(row.get('Responsabilidad CGE', 0))
            oca = int(row.get('Responsabilidad Contratista', 0))
            total = cge + oca
            if total == 0:
                continue
            zona_data.append({
                "resultado": str(resultado),
                "cantidad": total,
                "cantidad_cge": cge,
                "cantidad_oca": oca,
            })

        zona_data = sorted(zona_data, key=lambda x: x['cantidad'], reverse=True)
        result[zona] = zona_data

    return result
