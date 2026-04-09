import pandas as pd


def calculate_detalle_aviso(df: pd.DataFrame, page: int = 1, page_size: int = 50) -> dict:
    # Select relevant columns
    cols = ['ID Medida', 'Aviso', 'Comuna', 'Unidad de lectura', 'Porción',
            'Descripción del aviso', 'Resultado visita', 'Nombre asignado',
            'zona', 'Estado', 'Fecha ejecución', 'Dirección Servicio']

    available_cols = [c for c in cols if c in df.columns]
    detail_df = df[available_cols].copy()

    total = len(detail_df)
    start = (page - 1) * page_size
    end = start + page_size
    page_df = detail_df.iloc[start:end]

    registros = []
    for _, row in page_df.iterrows():
        registro = {}
        for col in available_cols:
            val = row[col]
            if pd.isna(val):
                registro[col] = None
            elif isinstance(val, (pd.Timestamp,)):
                registro[col] = val.strftime('%Y-%m-%d')
            else:
                registro[col] = str(val) if not isinstance(val, (int, float)) else val
        registros.append(registro)

    # Campañas por comuna
    campanas_comuna = []
    comuna_counts = df.groupby('Comuna')['Descripción del aviso'].count().reset_index()
    comuna_counts.columns = ['comuna', 'cantidad']
    comuna_counts = comuna_counts.sort_values('cantidad', ascending=False).head(20)
    for _, row in comuna_counts.iterrows():
        if pd.isna(row['comuna']) or not row['comuna']:
            continue
        campanas_comuna.append({
            "comuna": str(row['comuna']),
            "cantidad": int(row['cantidad']),
        })

    return {
        "registros": registros,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "campanas_comuna": campanas_comuna,
    }
