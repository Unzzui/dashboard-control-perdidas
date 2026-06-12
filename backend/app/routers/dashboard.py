from typing import Optional
import pandas as pd
from fastapi import APIRouter, Depends, Query
from app.dependencies import get_dataframe, apply_filters
from app.models.filters import FilterParams
from app.services.kpis import calculate_kpis
from app.services.zonas import calculate_zonas
from app.services.daily import calculate_daily, calculate_daily_por_zona
from app.services.mensual import calculate_mensual
from app.services.tecnicos import calculate_tecnicos
from app.services.campanas import calculate_campanas
from app.services.normalizaciones import calculate_normalizaciones
from app.services.visitas_fallidas import calculate_visitas_fallidas
from app.services.produccion import calculate_produccion
from app.services.pago_tecnicos import calculate_pago_tecnicos
from app.services.tecnicos import normalizar_nombre
from app.services.resultados_fallidos import calculate_resultados_fallidos, calculate_resultados_fallidos_por_zona
from app.services.analisis_comparativo import calculate_analisis_comparativo
from app.services.alertas_operativas import calculate_alertas_operativas
from app.services.analisis_jornada import calculate_analisis_jornada_mensual, calculate_jornada_tecnico_detalle
from app.services.calendario_mes import build_calendario_mes
from app.services.promedio_efectivas import calculate_promedio_efectivas

router = APIRouter()


@router.get("/api/v1/dashboard")
def get_dashboard(params: FilterParams = Depends()):
    df = get_dataframe()
    filtered = apply_filters(df, params)

    kpis = calculate_kpis(filtered)
    tecnicos = calculate_tecnicos(filtered)

    # Single source of truth para "promedio efectivas/día" (alineado con Control Metas).
    # Se inyecta dentro de kpis para que cualquier vista lo consuma desde un solo lugar.
    kpis.update(
        calculate_promedio_efectivas(tecnicos, kpis.get("total_visita_fallida_cge", 0))
    )

    return {
        "kpis": kpis,
        "zonas": calculate_zonas(filtered),
        "daily": calculate_daily(filtered),
        "daily_por_zona": calculate_daily_por_zona(filtered),
        "mensual": calculate_mensual(filtered),
        "tecnicos": tecnicos,
        "campanas": calculate_campanas(filtered),
        "normalizaciones": calculate_normalizaciones(filtered),
        "visitas_fallidas_responsabilidad": calculate_visitas_fallidas(filtered),
        "produccion": calculate_produccion(filtered),
        "pago_tecnicos": calculate_pago_tecnicos(filtered),
        "calendario_mes": build_calendario_mes(filtered),
        "resultados_fallidos": calculate_resultados_fallidos(filtered),
        "resultados_fallidos_por_zona": calculate_resultados_fallidos_por_zona(filtered),
    }


def _params_sin_periodo(params: FilterParams) -> FilterParams:
    """Devuelve una copia de params con año/mes/día anulados (para cierre EDP)."""
    p = FilterParams.__new__(FilterParams)
    p.año = None
    p.mes = None
    p.dia = None
    p.zona = params.zona
    p.regional = params.regional
    p.supervisor = params.supervisor
    p.estado = params.estado
    p.tratamiento = params.tratamiento
    p.tipo_campana = params.tipo_campana
    p.nombre_asignado = params.nombre_asignado
    return p


def _rango_cierre_edp(mes_cierre: str) -> tuple[pd.Timestamp, pd.Timestamp]:
    """
    Devuelve (fecha_inicio, fecha_fin) para el periodo de cierre EDP CGE
    correspondiente al mes_cierre (formato 'YYYY-MM').
    Periodo: del día 26 del mes anterior al día 25 del mes_cierre, ambos inclusive.
    Ejemplo: mes_cierre='2026-04' → (2026-03-26, 2026-04-25).
    """
    año, mes = (int(x) for x in mes_cierre.split("-"))
    fecha_fin = pd.Timestamp(year=año, month=mes, day=25)
    if mes == 1:
        fecha_inicio = pd.Timestamp(year=año - 1, month=12, day=26)
    else:
        fecha_inicio = pd.Timestamp(year=año, month=mes - 1, day=26)
    return fecha_inicio, fecha_fin


def _aplicar_cierre_edp(df: pd.DataFrame, mes_cierre: str) -> pd.DataFrame:
    """Filtra df a las filas con Fecha ejecución dentro del rango EDP del mes_cierre."""
    if "Fecha ejecución" not in df.columns:
        return df
    fecha_inicio, fecha_fin = _rango_cierre_edp(mes_cierre)
    # fin del día 25: 25 23:59:59
    fecha_fin_inclusive = fecha_fin + pd.Timedelta(days=1) - pd.Timedelta(seconds=1)
    return df[
        (df["Fecha ejecución"] >= fecha_inicio) &
        (df["Fecha ejecución"] <= fecha_fin_inclusive)
    ]


@router.get("/api/v1/produccion/pago-tecnicos")
def get_pago_tecnicos(
    mes_cierre: Optional[str] = Query(
        None,
        pattern=r"^\d{4}-\d{2}$",
        description="Si se entrega (YYYY-MM), activa el modo cierre EDP CGE: "
                    "filtra a inspecciones entre el 26 del mes anterior y el 25 del mes_cierre, "
                    "ignorando los filtros de año/mes/día estándar.",
    ),
    params: FilterParams = Depends(),
):
    """Cálculo de pago mensual por técnico (OCA GLOBAL / 1F)."""
    df = get_dataframe()
    if mes_cierre:
        filtered = apply_filters(df, _params_sin_periodo(params))
        filtered = _aplicar_cierre_edp(filtered, mes_cierre)
    else:
        filtered = apply_filters(df, params)
    return calculate_pago_tecnicos(filtered)


@router.get("/api/v1/produccion/raw")
def get_pago_raw(
    mes_cierre: Optional[str] = Query(
        None,
        pattern=r"^\d{4}-\d{2}$",
        description="Si se entrega (YYYY-MM), activa el modo cierre EDP CGE.",
    ),
    params: FilterParams = Depends(),
):
    """
    Devuelve TODAS las columnas del parquet para las filas filtradas.
    Es la fuente única que respalda el cálculo de pago en el Excel:
    el usuario puede reproducir manualmente cualquier conteo desde aquí.

    Las columnas clave que necesita el cálculo (Fecha ejecución, Nombre
    asignado, Resultado visita, Resultado final, Tipo_CNR.Tipo de CNR)
    se ordenan al inicio para mayor visibilidad.
    """
    df = get_dataframe()
    if mes_cierre:
        filtered = apply_filters(df, _params_sin_periodo(params))
        filtered = _aplicar_cierre_edp(filtered, mes_cierre)
    else:
        filtered = apply_filters(df, params)

    # Orden: columnas clave del cálculo primero, luego el resto en su orden original.
    CLAVE = [
        "Fecha ejecución", "Nombre asignado",
        "Resultado visita", "Resultado final", "Tipo_CNR.Tipo de CNR",
        "Tipo de CNR",
        "zona_tecnico", "regional_tecnico",
        "zona_inspeccion", "regional_inspeccion",
        "Comuna", "Dirección Servicio",
        "Aviso", "ID Medida",
        "kWh CNR",
        "Tratamiento", "Tipo de Campaña", "Estado",
        "Hora inicio", "Hora fin", "Supervisor",
    ]
    presentes = list(filtered.columns)
    ordenadas = [c for c in CLAVE if c in presentes]
    resto = [c for c in presentes if c not in ordenadas]
    cols_present = ordenadas + resto

    out = filtered[cols_present].copy()

    # Normaliza "Nombre asignado" con .strip().title() — MISMA lógica que
    # pago_tecnicos.calculate_pago_tecnicos. Sin esto, los COUNTIFS del Excel
    # contra Raw Parquet fallan cuando el nombre original tiene espacios al
    # final o casing distinto (Detalle Técnicos usa la versión normalizada).
    if "Nombre asignado" in out.columns:
        out["Nombre asignado"] = out["Nombre asignado"].apply(
            lambda v: normalizar_nombre(v) if isinstance(v, str) else v
        )

    # Normaliza todas las columnas datetime a string YYYY-MM-DD (compatibles
    # con JSON y con las fórmulas de Excel que parten del string).
    for col in out.columns:
        if pd.api.types.is_datetime64_any_dtype(out[col]):
            out[col] = pd.to_datetime(out[col], errors="coerce").dt.strftime("%Y-%m-%d")

    # Convierte NaN/NaT/Inf a None para que JSON los serialice. Reemplazar
    # SOLO con .where no es suficiente porque las columnas float mantienen NaN.
    out = out.replace([float("inf"), float("-inf")], None)

    rango = None
    if mes_cierre:
        fi, ff = _rango_cierre_edp(mes_cierre)
        rango = {"desde": fi.strftime("%Y-%m-%d"), "hasta": ff.strftime("%Y-%m-%d")}

    # Construye los rows limpiando NaN/NaT por valor (más robusto que .where
    # para dataframes con dtypes mixtos como objet/float/datetime).
    records = out.to_dict(orient="records")
    clean_rows = [
        {k: (None if pd.isna(v) else v) for k, v in row.items()}
        for row in records
    ]

    return {
        "total": len(out),
        "mes_cierre": mes_cierre,
        "rango": rango,
        "columnas": cols_present,
        "rows": clean_rows,
    }


@router.get("/api/v1/analisis-comparativo")
def get_analisis_comparativo(params: FilterParams = Depends()):
    """
    Endpoint para análisis comparativo real entre dos períodos.
    Compara métricas de zonas y técnicos entre período actual y anterior.
    """
    df = get_dataframe()
    filtered = apply_filters(df, params)

    # Extraer año y meses de los parámetros
    año = params.año if params.año else 2026
    meses = params.mes if params.mes else []

    return calculate_analisis_comparativo(filtered, año, meses)


@router.get("/api/v1/analisis-jornada/mensual")
def get_analisis_jornada_mensual(params: FilterParams = Depends()):
    """Análisis de jornada agregado por (técnico, día) y agrupado por zona, sobre el rango filtrado."""
    df = get_dataframe()
    filtered = apply_filters(df, params)
    return calculate_analisis_jornada_mensual(filtered)


@router.get("/api/v1/analisis-jornada/tecnico/{nombre}")
def get_jornada_tecnico_detalle(nombre: str, params: FilterParams = Depends()):
    """Detalle día a día de las jornadas de un técnico en el periodo filtrado."""
    df = get_dataframe()
    filtered = apply_filters(df, params)
    return calculate_jornada_tecnico_detalle(filtered, nombre)


@router.get("/api/v1/alertas-operativas")
def get_alertas_operativas(params: FilterParams = Depends()):
    """
    Endpoint para alertas operativas diarias.
    Identifica técnicos inactivos, metas no cumplidas, problemas de jornada, etc.
    """
    df = get_dataframe()
    filtered = apply_filters(df, params)

    # Extraer año y meses de los parámetros
    año = params.año if params.año else 2026
    meses = params.mes if params.mes else []

    return calculate_alertas_operativas(filtered, año, meses)
