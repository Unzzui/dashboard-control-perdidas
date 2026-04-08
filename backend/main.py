from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from pathlib import Path
from typing import Optional
from datetime import datetime
import numpy as np

app = FastAPI(
    title="Control de Pérdidas API",
    description="API para el dashboard de Control de Pérdidas OCA Global - TUSAN",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load data
DATA_PATH = Path(__file__).parent.parent.parent / "prueba_bi_control_perdidas" / "data" / "parquet" / "resultado_consolidado.parquet"

df_global: pd.DataFrame = None

def get_dataframe() -> pd.DataFrame:
    global df_global
    if df_global is None:
        df_global = pd.read_parquet(DATA_PATH)
        # Clean and prepare data
        df_global['Fecha ejecución'] = pd.to_datetime(df_global['Fecha ejecución'], errors='coerce')
        df_global['año'] = df_global['Fecha ejecución'].dt.year
        df_global['mes'] = df_global['Fecha ejecución'].dt.month
        df_global['mes_nombre'] = df_global['Fecha ejecución'].dt.strftime('%B')
        df_global['dia'] = df_global['Fecha ejecución'].dt.day

        # Map resultado visita
        df_global['resultado_clasificado'] = df_global['Resultado visita'].apply(
            lambda x: 'Normal' if x == 'Normal' else (
                'CNR' if x == 'CNR' else (
                    'Visita fallida' if x == 'Visita fallida' else 'Otro'
                )
            )
        )
    return df_global

def apply_filters(df: pd.DataFrame,
                  año: Optional[int] = None,
                  mes: Optional[str] = None,
                  dia: Optional[int] = None,
                  zona: Optional[str] = None,
                  regional: Optional[str] = None,
                  supervisor: Optional[str] = None,
                  estado: Optional[str] = None,
                  tratamiento: Optional[str] = None,
                  tipo_campana: Optional[str] = None,
                  nombre_asignado: Optional[str] = None) -> pd.DataFrame:

    filtered = df.copy()

    if año:
        filtered = filtered[filtered['año'] == año]
    if mes:
        filtered = filtered[filtered['mes_nombre'].str.lower() == mes.lower()]
    if dia:
        filtered = filtered[filtered['dia'] == dia]
    if zona:
        filtered = filtered[filtered['zona'] == zona]
    if regional:
        filtered = filtered[filtered['Regional'] == regional]
    if supervisor:
        filtered = filtered[filtered['Supervisor'] == supervisor]
    if estado:
        filtered = filtered[filtered['Estado'] == estado]
    if tratamiento:
        filtered = filtered[filtered['Tratamiento'] == tratamiento]
    if tipo_campana:
        filtered = filtered[filtered['Tipo de Campaña'] == tipo_campana]
    if nombre_asignado:
        filtered = filtered[filtered['Nombre asignado'] == nombre_asignado]

    return filtered


@app.get("/api/v1/filters")
def get_filters():
    """Get all available filter options"""
    df = get_dataframe()

    meses_orden = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

    meses_disponibles = df['mes_nombre'].dropna().unique().tolist()
    meses_ordenados = [m for m in meses_orden if m in [x.lower() for x in meses_disponibles]]

    return {
        "años": sorted([int(x) for x in df['año'].dropna().unique() if not pd.isna(x)], reverse=True),
        "meses": meses_ordenados,
        "dias": sorted([int(x) for x in df['dia'].dropna().unique() if not pd.isna(x)]),
        "zonas": sorted([x for x in df['zona'].dropna().unique() if x and x != 'No Asignados']),
        "regionales": sorted([x for x in df['Regional'].dropna().unique() if x]),
        "supervisores": sorted([x for x in df['Supervisor'].dropna().unique() if x]),
        "estados": sorted([x for x in df['Estado'].dropna().unique() if x]),
        "tratamientos": sorted([x for x in df['Tratamiento'].dropna().unique() if x]),
        "tipos_campana": sorted([x for x in df['Tipo de Campaña'].dropna().unique() if x]),
        "nombres_asignados": sorted([x for x in df['Nombre asignado'].dropna().unique() if x and 'BOT' not in x])[:100],
    }


@app.get("/api/v1/dashboard")
def get_dashboard(
    año: Optional[int] = Query(None),
    mes: Optional[str] = Query(None),
    dia: Optional[int] = Query(None),
    zona: Optional[str] = Query(None),
    regional: Optional[str] = Query(None),
    supervisor: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    tratamiento: Optional[str] = Query(None),
    tipo_campana: Optional[str] = Query(None),
    nombre_asignado: Optional[str] = Query(None),
):
    """Get all dashboard data"""
    df = get_dataframe()
    filtered = apply_filters(df, año, mes, dia, zona, regional, supervisor,
                             estado, tratamiento, tipo_campana, nombre_asignado)

    # Calculate KPIs
    total = len(filtered)

    # Count by resultado visita
    resultado_counts = filtered['Resultado visita'].value_counts()
    total_normal = int(resultado_counts.get('Normal', 0))
    total_cnr = int(resultado_counts.get('CNR', 0))
    total_visita_fallida = int(resultado_counts.get('Visita fallida', 0))
    total_efectivas = total_normal + total_cnr

    # CNR types
    cnr_tipo = filtered[filtered['Resultado visita'] == 'CNR']['Tipo_CNR.Tipo de CNR'].value_counts()
    cnr_falla = int(cnr_tipo.get('CNR Falla', 0))
    cnr_hurto = int(cnr_tipo.get('CNR Hurto', 0))

    # kWh
    kwh_recuperado = int(filtered['kWh CNR'].sum())

    # Percentages
    pct_efectivas = (total_efectivas / total * 100) if total > 0 else 0
    pct_cnr = (total_cnr / total_efectivas * 100) if total_efectivas > 0 else 0
    pct_visita_fallida = (total_visita_fallida / total * 100) if total > 0 else 0
    pct_cnr_falla = (cnr_falla / total_cnr * 100) if total_cnr > 0 else 0
    pct_cnr_hurto = (cnr_hurto / total_cnr * 100) if total_cnr > 0 else 0

    kpis = {
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

    # Stats by Zona
    zonas_data = []
    zonas_filtered = filtered[filtered['zona'] != 'No Asignados']
    for zona_name in zonas_filtered['zona'].dropna().unique():
        zona_df = zonas_filtered[zonas_filtered['zona'] == zona_name]
        z_resultado = zona_df['Resultado visita'].value_counts()
        z_normal = int(z_resultado.get('Normal', 0))
        z_cnr = int(z_resultado.get('CNR', 0))
        z_vf = int(z_resultado.get('Visita fallida', 0))
        z_efectivas = z_normal + z_cnr
        z_total = z_efectivas + z_vf

        zonas_data.append({
            "zona": zona_name,
            "normal": z_normal,
            "cnr": z_cnr,
            "pct_cnr": (z_cnr / z_efectivas * 100) if z_efectivas > 0 else 0,
            "visita_fallida": z_vf,
            "pct_visita_fallida": (z_vf / z_total * 100) if z_total > 0 else 0,
            "efectivas": z_efectivas,
            "pct_efectivas": (z_efectivas / z_total * 100) if z_total > 0 else 0,
        })

    zonas_data = sorted(zonas_data, key=lambda x: x['efectivas'], reverse=True)

    # Daily stats
    daily_data = []
    if 'Fecha ejecución' in filtered.columns:
        daily_df = filtered.dropna(subset=['Fecha ejecución']).copy()
        daily_df['fecha_str'] = daily_df['Fecha ejecución'].dt.strftime('%Y-%m-%d')

        for fecha in daily_df['fecha_str'].unique():
            fecha_df = daily_df[daily_df['fecha_str'] == fecha]
            d_resultado = fecha_df['Resultado visita'].value_counts()

            daily_data.append({
                "fecha": fecha,
                "dia": int(pd.to_datetime(fecha).day),
                "cnr": int(d_resultado.get('CNR', 0)),
                "normal": int(d_resultado.get('Normal', 0)),
                "visita_fallida": int(d_resultado.get('Visita fallida', 0)),
            })

        daily_data = sorted(daily_data, key=lambda x: x['fecha'])[-30:]  # Last 30 days

    # Monthly stats
    mensual_data = []
    meses_map = {1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril', 5: 'mayo', 6: 'junio',
                 7: 'julio', 8: 'agosto', 9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre'}

    for mes_num in sorted(filtered['mes'].dropna().unique()):
        mes_df = filtered[filtered['mes'] == mes_num]
        m_resultado = mes_df['Resultado visita'].value_counts()
        m_normal = int(m_resultado.get('Normal', 0))
        m_cnr = int(m_resultado.get('CNR', 0))
        m_vf = int(m_resultado.get('Visita fallida', 0))
        m_efectivas = m_normal + m_cnr
        m_total = m_efectivas + m_vf

        # CNR types for month
        m_cnr_tipo = mes_df[mes_df['Resultado visita'] == 'CNR']['Tipo_CNR.Tipo de CNR'].value_counts()
        m_cnr_falla = int(m_cnr_tipo.get('CNR Falla', 0))
        m_cnr_hurto = int(m_cnr_tipo.get('CNR Hurto', 0))

        mensual_data.append({
            "mes": meses_map.get(int(mes_num), str(mes_num)),
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

    # Technician ranking
    tecnicos_data = []
    # Filter only executors (not BOT)
    ejecutores = filtered[~filtered['Nombre asignado'].str.contains('BOT', na=False)]

    for zona_name in ejecutores['zona'].dropna().unique():
        if zona_name == 'No Asignados':
            continue
        zona_df = ejecutores[ejecutores['zona'] == zona_name]

        for nombre in zona_df['Nombre asignado'].dropna().unique():
            tecnico_df = zona_df[zona_df['Nombre asignado'] == nombre]
            t_resultado = tecnico_df['Resultado visita'].value_counts()
            t_cnr = int(t_resultado.get('CNR', 0))
            t_normal = int(t_resultado.get('Normal', 0))
            t_efectivas = t_cnr + t_normal

            # Calculate unique days worked
            dias_trabajados = tecnico_df['Fecha ejecución'].dt.date.nunique()
            dias_trabajados = max(dias_trabajados, 1)

            tecnicos_data.append({
                "zona": zona_name,
                "nombre": nombre,
                "cnr": t_cnr,
                "promedio_cnr": t_cnr / dias_trabajados,
                "efectivas": t_efectivas,
                "promedio_efectivas": t_efectivas / dias_trabajados,
            })

    tecnicos_data = sorted(tecnicos_data, key=lambda x: x['cnr'], reverse=True)[:50]

    # Campaign stats
    campanas_data = []
    for desc in filtered['Descripción del aviso'].dropna().unique():
        camp_df = filtered[filtered['Descripción del aviso'] == desc]
        c_resultado = camp_df['Resultado visita'].value_counts()
        c_normal = int(c_resultado.get('Normal', 0))
        c_cnr = int(c_resultado.get('CNR', 0))
        c_vf = int(c_resultado.get('Visita fallida', 0))
        c_efectivas = c_normal + c_cnr
        c_total = c_efectivas + c_vf

        if c_total < 10:  # Skip small campaigns
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

    # Normalizations by zona
    normalizaciones_data = []
    cnr_df = filtered[filtered['Resultado visita'] == 'CNR']

    for zona_name in cnr_df['zona'].dropna().unique():
        if zona_name == 'No Asignados':
            continue
        zona_df = cnr_df[cnr_df['zona'] == zona_name]
        trat_counts = zona_df['Tratamiento'].value_counts()
        normalizado = int(trat_counts.get('Normalizado', 0))
        no_normalizado = int(trat_counts.get('No normalizado', 0))
        total_trat = normalizado + no_normalizado

        if total_trat == 0:
            continue

        normalizaciones_data.append({
            "zona": zona_name,
            "no_normalizado": no_normalizado,
            "pct_no_normalizado": (no_normalizado / total_trat * 100) if total_trat > 0 else 0,
            "normalizado": normalizado,
            "pct_normalizado": (normalizado / total_trat * 100) if total_trat > 0 else 0,
            "total": total_trat,
        })

    normalizaciones_data = sorted(normalizaciones_data, key=lambda x: x['total'], reverse=True)

    # Visitas fallidas by responsabilidad
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

    # Production by zona
    produccion_data = []
    # Meta por brigada mensual
    META_POR_BRIGADA = 6500000

    brigadas_por_zona = {
        "01. ARICA": 1,
        "04. COQUIMBO": 7,
        "05. QUINTA MELIPILLA": 6,
        "07. RANCAGUA": 11,
        "08. COLCHAGUA - CARDENAL CARO": 8,
        "09. MAULE NORTE": 2,
        "10. MAULE SUR": 4,
        "11. CONCEPCION": 6,
    }

    for zona_name in filtered['zona'].dropna().unique():
        if zona_name == 'No Asignados':
            continue
        zona_df = filtered[filtered['zona'] == zona_name]

        # Calculate production from Valor Unitario
        produccion = zona_df['Valor Unitario'].dropna().sum()
        produccion = int(produccion) if not pd.isna(produccion) else 0

        brigadas = brigadas_por_zona.get(zona_name, 1)
        meta = brigadas * META_POR_BRIGADA

        z_cnr = int(zona_df[zona_df['Resultado visita'] == 'CNR'].shape[0])
        monto_cnr = produccion  # Simplified

        produccion_data.append({
            "zona": zona_name,
            "brigadas_activas": brigadas,
            "meta_produccion": meta,
            "produccion": produccion,
            "pct_produccion": (produccion / meta * 100) if meta > 0 else 0,
            "cnr": z_cnr,
            "monto_cnr": monto_cnr,
            "promedio_monto_cnr": (monto_cnr / z_cnr) if z_cnr > 0 else 0,
        })

    produccion_data = sorted(produccion_data, key=lambda x: x['produccion'], reverse=True)

    return {
        "kpis": kpis,
        "zonas": zonas_data,
        "daily": daily_data,
        "mensual": mensual_data,
        "tecnicos": tecnicos_data,
        "campanas": campanas_data,
        "normalizaciones": normalizaciones_data,
        "visitas_fallidas_responsabilidad": vf_resp_data,
        "produccion": produccion_data,
    }


@app.get("/api/v1/geo")
def get_geo_data(
    año: Optional[int] = Query(None),
    mes: Optional[str] = Query(None),
    zona: Optional[str] = Query(None),
    limit: int = Query(1000),
):
    """Get geo coordinates for map"""
    df = get_dataframe()
    filtered = apply_filters(df, año=año, mes=mes, zona=zona)

    # Filter rows with valid coordinates
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

    return {"points": points}


@app.get("/")
def root():
    return {
        "message": "Control de Pérdidas API",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
