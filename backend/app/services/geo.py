import pandas as pd


def calculate_geo(filtered: pd.DataFrame, limit: int = 1000) -> list:
    geo_df = filtered.dropna(subset=['Coord X usuario', 'Coord Y usuario'])
    geo_df = geo_df[geo_df['Coord X usuario'] != 0]
    geo_df = geo_df.head(limit)
    points = []
    for _, row in geo_df.iterrows():
        points.append({
            "lat": float(row['Coord X usuario']),
            "lng": float(row['Coord Y usuario']),
            "resultado": str(row.get('Resultado visita', '')),
            "zona": str(row.get('zona', '')),
            "aviso": str(row.get('Aviso', '')),
        })
    return points
