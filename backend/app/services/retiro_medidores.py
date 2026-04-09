import pandas as pd


def calculate_retiro_medidores(df: pd.DataFrame) -> dict:
    # Filter rows with meter lab info - where Estado de envío is not empty
    medidor_df = df[df['Estado de envío'].notna() & (df['Estado de envío'] != '')]

    # Days of delay by zona
    atraso_por_zona = []
    for zona_name in sorted(medidor_df['zona'].dropna().unique()):
        if zona_name == 'No Asignados' or not zona_name:
            continue
        zona_df = medidor_df[medidor_df['zona'] == zona_name]
        atraso_counts = zona_df['Control de atraso'].value_counts()

        dentro_plazo = int(atraso_counts.get('Dentro de plazo', 0))
        entre_3_7 = int(atraso_counts.get('Entre 03 y 07 días de atraso', 0))
        mas_7 = int(zona_df[~zona_df['Control de atraso'].isin(['Dentro de plazo', 'Entre 03 y 07 días de atraso'])].shape[0]) if len(zona_df) > 0 else 0
        total = dentro_plazo + entre_3_7 + mas_7

        atraso_por_zona.append({
            "zona": zona_name,
            "dentro_plazo": dentro_plazo,
            "entre_3_7": entre_3_7,
            "mas_7": mas_7,
            "total": total,
        })

    atraso_por_zona = sorted(atraso_por_zona, key=lambda x: x['total'], reverse=True)

    # Responsible technicians detail
    responsables = []
    for _, row in medidor_df.head(100).iterrows():
        zona = str(row.get('zona', ''))
        if zona == 'No Asignados' or not zona:
            continue
        responsables.append({
            "zona": zona,
            "id_medida": int(row.get('ID Medida', 0)),
            "aviso": int(row.get('Aviso', 0)),
            "tecnico": str(row.get('Nombre asignado', '')),
            "estado_envio": str(row.get('Estado de envío', '')),
            "control_atraso": str(row.get('Control de atraso', '')),
            "dias_atraso": float(row.get('Días de atraso', 0)) if pd.notna(row.get('Días de atraso')) else 0,
        })

    # Daily retiro chart
    retiro_diario = []
    if 'Fecha ejecución' in medidor_df.columns:
        daily_df = medidor_df.dropna(subset=['Fecha ejecución']).copy()
        daily_df['fecha_str'] = daily_df['Fecha ejecución'].dt.strftime('%Y-%m-%d')
        daily_counts = daily_df.groupby('fecha_str').size().reset_index(name='cantidad')
        for _, row in daily_counts.iterrows():
            retiro_diario.append({
                "fecha": row['fecha_str'],
                "dia": int(pd.to_datetime(row['fecha_str']).day),
                "cantidad": int(row['cantidad']),
            })
        retiro_diario = sorted(retiro_diario, key=lambda x: x['fecha'])[-30:]

    return {
        "atraso_por_zona": atraso_por_zona,
        "responsables": responsables,
        "retiro_diario": retiro_diario,
    }
