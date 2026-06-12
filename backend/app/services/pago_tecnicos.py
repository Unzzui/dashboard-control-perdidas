import unicodedata
import pandas as pd
import numpy as np
from app.config import PRECIOS_PATH, META_EFECTIVAS_MES, ZONA_DATASET_TO_PRECIOS
from app.services.tecnicos import normalizar_nombre
from app.services.calendario_mes import compute_estructura_mes, compute_meta_efectivas


# Brigadas que cobran SIEMPRE por su zona administrativa (zona_tecnico),
# aunque hayan trabajado mayoritariamente en otra zona — son casos de
# apoyo entre zonas con acuerdo de mantener la tarifa de origen.
#
# Mantener esta lista actualizada mes a mes según los acuerdos vigentes.
# Los nombres deben venir normalizados con .strip().title() (igual que la
# columna "Nombre asignado" después de pasar por normalizar_nombre()).
HONRAR_ZONA_ADMINISTRATIVA: set[str] = {
    "Kevin Andres Vergara Galleguillos",
}


_precios_df: pd.DataFrame | None = None


def _normalizar_comuna(txt) -> str:
    if not isinstance(txt, str):
        return ""
    s = unicodedata.normalize("NFD", txt).encode("ascii", "ignore").decode("ascii")
    return s.upper().strip()


def _get_precios() -> pd.DataFrame:
    global _precios_df
    if _precios_df is None:
        _precios_df = pd.read_parquet(PRECIOS_PATH)
        if "comuna_norm" not in _precios_df.columns:
            _precios_df["comuna_norm"] = _precios_df["Comuna"].apply(_normalizar_comuna)
    return _precios_df


def _lookup_precio(zona_precios: str, comuna_norm: str, precios: pd.DataFrame) -> tuple[int, str]:
    """Lookup (Zona, Comuna). Si no encuentra comuna, devuelve precio mediano de la zona."""
    if not zona_precios:
        return 0, ""
    z_df = precios[precios["Zona"] == zona_precios]
    if z_df.empty:
        return 0, ""
    if comuna_norm:
        match = z_df[z_df["comuna_norm"] == comuna_norm]
        if not match.empty:
            row = match.iloc[0]
            return int(row["Precio Base"]), str(row["Comuna"])
    # fallback: mediana de la zona
    precio_mediano = int(z_df["Precio Base"].median())
    comuna_repr = str(z_df.iloc[0]["Comuna"])
    return precio_mediano, comuna_repr


def calculate_pago_tecnicos(filtered: pd.DataFrame) -> list:
    """
    Calcula pago mensual por técnico.

    Reglas:
      - Asigna EECC=OCA GLOBAL, Tipo Brigada=1F, Ctta/TUSAN=Ctta para todos (provisional).
      - Usa la ZONA DE TRABAJO (modo de zona_inspeccion) para el lookup de precio.
        Esto cubre casos de apoyo donde el técnico trabaja la mayor parte del
        periodo en una zona distinta a su zona de origen y debe cobrar la tarifa
        de esa zona (no la administrativa).
      - Comuna del técnico: la comuna donde más inspecciones hizo dentro de su
        zona de trabajo predominante.
      - Efectivas Mes = Normales + CNR Medida (Falla) + CNR Intervención (Hurto) + VF CGE.
      - Efectivas Sábados = mismo cálculo restringido a sábados (dayofweek=5).
      - Efectivas Hábiles = Efectivas Mes - Efectivas Sábados.
      - Meta dinámica: 8 ef/día × días hábiles del mes visualizado (cae a 160 si no hay calendario).
      - Monto Hábil = Precio Base × (Efectivas Hábiles / Meta), capped at Precio Base.
      - Monto Sábado = (Precio Base / Meta) × Efectivas Sábados.
      - Total a pago = Monto Hábil + Monto Sábado.
    """
    if filtered.empty:
        return []

    df = filtered.copy()
    df["Nombre asignado"] = df["Nombre asignado"].apply(normalizar_nombre)

    # Excluir BOTs y filas sin técnico asignado
    df = df[~df["Nombre asignado"].fillna("").str.contains("BOT", case=False, na=False)]
    df = df[df["Nombre asignado"].notna() & (df["Nombre asignado"] != "")]

    if df.empty:
        return []

    # Booleans para clasificación
    rv = df["Resultado visita"]
    rf = df["Resultado final"]
    tipo_cnr = df.get("Tipo_CNR.Tipo de CNR", pd.Series([""] * len(df), index=df.index))

    df["es_normal"] = (rv == "Normal").astype(int)
    # CNR Medida / Intervención: usar Tipo_CNR.Tipo de CNR cuando está poblado.
    # Fallback (cuando el tipo está vacío) por Resultado final, derivado del
    # cruce empírico con los CNR ya clasificados (>90% de precisión):
    #   - "Falla interna" / "Administrativo"           → CNR Falla (Medida)
    #   - "Conexión irregular" / "Medidor intervenido" → CNR Hurto (Intervención)
    # En EDP 26-abr→25-may había 77 CNR sin tipo (10 en sábado) que quedaban
    # fuera de las efectivas — el EP del jefe sí los cuenta.
    tipo_vacio = tipo_cnr.fillna("").astype(str).str.strip() == ""
    rf_medida = rf.isin(["Falla interna", "Administrativo"])
    rf_hurto = rf.isin(["Conexión irregular", "Medidor intervenido"])
    df["es_cnr_medida"] = (
        (rv == "CNR") & ((tipo_cnr == "CNR Falla") | (tipo_vacio & rf_medida))
    ).astype(int)
    df["es_cnr_interv"] = (
        (rv == "CNR") & ((tipo_cnr == "CNR Hurto") | (tipo_vacio & rf_hurto))
    ).astype(int)
    # VF CGE: usar la WHITELIST por Resultado final del EP modelo del jefe.
    # La columna "Responsabilidad" del consolidado tiene errores puntuales
    # (ej. aviso 120035720630: "Casa deshabitada" marcada como Responsabilidad
    # Contratista cuando el EP la considera CGE). La whitelist por Resultado
    # final es estable y replica exactamente el criterio del modelo.
    VF_CGE_RESULTADOS = {
        "Casa deshabitada",
        "Desconectado en BT/MT",
        "Condición insegura (Física del empalme)",
        "Sitio eriazo",
        "Sin empalme",
        "Sin acceso por caja tortuga",
    }
    df["es_vf_cge"] = (
        (rv == "Visita fallida") & rf.isin(VF_CGE_RESULTADOS)
    ).astype(int)
    # Mantenimiento Medidor cuenta como efectiva (criterio alineado con
    # detalle_tecnico.py y tecnicos.py: Efectivas = Normal + CNR + VF CGE + Mant.).
    df["es_mant"] = (rv == "Mantenimiento Medidor").astype(int)
    df["es_efectiva"] = (
        df["es_normal"] + df["es_cnr_medida"] + df["es_cnr_interv"]
        + df["es_vf_cge"] + df["es_mant"]
    ).clip(upper=1)
    df["es_visita_total"] = (
        (rv == "Normal") | (rv == "CNR") | (rv == "Visita fallida") | (rv == "Mantenimiento Medidor")
    ).astype(int)

    # Sábado = dayofweek 5
    df["es_sabado"] = (df["Fecha ejecución"].dt.dayofweek == 5).astype(int)

    # Último mes con datos (el que se visualiza en el calendario)
    fechas_validas = df["Fecha ejecución"].dropna()
    if not fechas_validas.empty:
        ultimo_periodo = fechas_validas.dt.to_period("M").max()
        año_cal = int(ultimo_periodo.year)
        mes_cal = int(ultimo_periodo.month)
    else:
        año_cal = None
        mes_cal = None

    # Meta dinámica: 8 efectivas/día × días hábiles del mes visualizado.
    # Fallback al legacy 160 cuando no se puede determinar el periodo.
    if año_cal is not None and mes_cal is not None:
        estructura = compute_estructura_mes(año_cal, mes_cal)
        meta_efectivas = compute_meta_efectivas(estructura["total_habiles"])
    else:
        meta_efectivas = META_EFECTIVAS_MES
    if meta_efectivas <= 0:
        meta_efectivas = META_EFECTIVAS_MES

    df["_dia_mes"] = df["Fecha ejecución"].dt.day
    df["_año_mes_match"] = (
        (df["Fecha ejecución"].dt.year == año_cal) &
        (df["Fecha ejecución"].dt.month == mes_cal)
    ) if año_cal is not None else False

    # Comuna normalizada
    df["comuna_norm"] = df["Comuna"].apply(_normalizar_comuna)

    # Métricas totales por técnico
    df["normal_sab"]      = df["es_normal"] * df["es_sabado"]
    df["cnr_med_sab"]     = df["es_cnr_medida"] * df["es_sabado"]
    df["cnr_int_sab"]     = df["es_cnr_interv"] * df["es_sabado"]
    df["vf_cge_sab"]      = df["es_vf_cge"] * df["es_sabado"]
    df["mant_sab"]        = df["es_mant"] * df["es_sabado"]
    df["efectiva_sab"]    = df["es_efectiva"] * df["es_sabado"]

    agg = df.groupby("Nombre asignado", observed=True).agg(
        zona_tecnico_origen=("zona_tecnico", "first"),
        regional_tecnico_origen=("regional_tecnico", "first"),
        normales=("es_normal", "sum"),
        cnr_medida=("es_cnr_medida", "sum"),
        cnr_intervencion=("es_cnr_interv", "sum"),
        vf_cge=("es_vf_cge", "sum"),
        mantenimiento=("es_mant", "sum"),
        efectivas_mes=("es_efectiva", "sum"),
        visitas_totales=("es_visita_total", "sum"),
        normales_sab=("normal_sab", "sum"),
        cnr_medida_sab=("cnr_med_sab", "sum"),
        cnr_interv_sab=("cnr_int_sab", "sum"),
        vf_cge_sab=("vf_cge_sab", "sum"),
        mantenimiento_sab=("mant_sab", "sum"),
        efectivas_sabado=("efectiva_sab", "sum"),
    ).reset_index()

    # Agregación separada para días trabajados del último mes con datos
    if año_cal is not None:
        df_mes = df[df["_año_mes_match"]]
        if not df_mes.empty:
            dias_por_tec = (
                df_mes.groupby("Nombre asignado", observed=True)["_dia_mes"]
                .apply(lambda s: sorted(set(int(x) for x in s.dropna())))
                .reset_index(name="dias_trabajados")
            )
            # sábados trabajados (días únicos con es_sabado=1)
            sabs_por_tec = (
                df_mes[df_mes["es_sabado"] == 1]
                .groupby("Nombre asignado", observed=True)["_dia_mes"]
                .apply(lambda s: len(set(int(x) for x in s.dropna())))
                .reset_index(name="sabados_trabajados_count")
            )
        else:
            dias_por_tec = pd.DataFrame(columns=["Nombre asignado", "dias_trabajados"])
            sabs_por_tec = pd.DataFrame(columns=["Nombre asignado", "sabados_trabajados_count"])
    else:
        dias_por_tec = pd.DataFrame(columns=["Nombre asignado", "dias_trabajados"])
        sabs_por_tec = pd.DataFrame(columns=["Nombre asignado", "sabados_trabajados_count"])

    agg = agg.merge(dias_por_tec, on="Nombre asignado", how="left")
    agg = agg.merge(sabs_por_tec, on="Nombre asignado", how="left")
    agg["dias_trabajados"] = agg["dias_trabajados"].apply(lambda v: v if isinstance(v, list) else [])
    agg["sabados_trabajados_count"] = agg["sabados_trabajados_count"].fillna(0).astype(int)

    # Fechas trabajadas (ISO YYYY-MM-DD) sobre TODO el df filtrado — no se restringe
    # al "último periodo". El calendario en modo Cierre EDP necesita días de los DOS
    # meses involucrados (26 del mes anterior → 25 del mes destino).
    df_iso = df.copy()
    df_iso["_fecha_iso"] = df_iso["Fecha ejecución"].dt.strftime("%Y-%m-%d")
    fechas_por_tec = (
        df_iso.dropna(subset=["_fecha_iso"])
        .groupby("Nombre asignado", observed=True)["_fecha_iso"]
        .apply(lambda s: sorted(set(s.dropna().tolist())))
        .reset_index(name="fechas_trabajadas")
    )
    agg = agg.merge(fechas_por_tec, on="Nombre asignado", how="left")
    agg["fechas_trabajadas"] = agg["fechas_trabajadas"].apply(lambda v: v if isinstance(v, list) else [])

    # ------------------------------------------------------------------
    # Zona y Comuna predominantes basadas en DONDE TRABAJÓ MÁS la brigada,
    # NO en su asignación administrativa (zona_tecnico). Cubre los casos
    # de apoyo donde un técnico trabaja la mayor parte del periodo en una
    # zona distinta a la suya y debería cobrar la tarifa de esa zona.
    # ------------------------------------------------------------------
    # 1) Zona donde más trabajó: modo de zona_inspeccion.
    df_z = df[df["zona_inspeccion"].astype(str).str.strip() != ""]
    zona_pred = (
        df_z.groupby(["Nombre asignado", "zona_inspeccion"], observed=True)
        .size()
        .reset_index(name="n")
        .sort_values(["Nombre asignado", "n"], ascending=[True, False])
        .drop_duplicates("Nombre asignado", keep="first")
        [["Nombre asignado", "zona_inspeccion"]]
        .rename(columns={"zona_inspeccion": "zona_trabajo"})
    )

    # 2) Regional asociada (modo de regional_inspeccion dentro de la zona predominante).
    #    Como cada zona pertenece a una sola regional, basta con tomar el modo simple.
    regional_pred = (
        df_z.groupby(["Nombre asignado", "regional_inspeccion"], observed=True)
        .size()
        .reset_index(name="n")
        .sort_values(["Nombre asignado", "n"], ascending=[True, False])
        .drop_duplicates("Nombre asignado", keep="first")
        [["Nombre asignado", "regional_inspeccion"]]
        .rename(columns={"regional_inspeccion": "regional_trabajo"})
    )

    agg = agg.merge(zona_pred, on="Nombre asignado", how="left")
    agg = agg.merge(regional_pred, on="Nombre asignado", how="left")
    # Fallback: si por alguna razón no hay zona_inspeccion para un técnico
    # (caso defensivo), usa la zona de origen administrativa.
    agg["zona_trabajo"] = agg["zona_trabajo"].fillna(agg["zona_tecnico_origen"])
    agg["regional_trabajo"] = agg["regional_trabajo"].fillna(agg["regional_tecnico_origen"])

    # Excepciones de zona administrativa: brigadas en HONRAR_ZONA_ADMINISTRATIVA
    # cobran SIEMPRE por su zona_tecnico aunque hayan trabajado en otra zona.
    # Sobrescribe la zona/regional de trabajo SOLO para esos nombres.
    # Casteamos a object/str: las columnas vienen como Categorical con
    # categorías distintas y pandas no permite la asignación directa.
    agg["zona_trabajo"] = agg["zona_trabajo"].astype("object")
    agg["regional_trabajo"] = agg["regional_trabajo"].astype("object")
    mask_override = agg["Nombre asignado"].isin(HONRAR_ZONA_ADMINISTRATIVA)
    if mask_override.any():
        agg.loc[mask_override, "zona_trabajo"] = agg.loc[mask_override, "zona_tecnico_origen"].astype("object").values
        agg.loc[mask_override, "regional_trabajo"] = agg.loc[mask_override, "regional_tecnico_origen"].astype("object").values

    # 3) Comuna predominante por técnico DENTRO de su zona de trabajo (no de origen).
    df_con_zona = df.merge(
        agg[["Nombre asignado", "zona_trabajo"]],
        on="Nombre asignado",
        how="left",
    )
    df_propio = df_con_zona[
        df_con_zona["zona_inspeccion"].astype(str) == df_con_zona["zona_trabajo"].astype(str)
    ]
    if df_propio.empty:
        df_propio = df_con_zona  # fallback defensivo
    comuna_pred = (
        df_propio.groupby(["Nombre asignado", "comuna_norm", "Comuna"], observed=True)
        .size()
        .reset_index(name="n")
        .sort_values(["Nombre asignado", "n"], ascending=[True, False])
        .drop_duplicates("Nombre asignado", keep="first")
        [["Nombre asignado", "comuna_norm", "Comuna"]]
        .rename(columns={"Comuna": "comuna_principal"})
    )
    agg = agg.merge(comuna_pred, on="Nombre asignado", how="left")
    agg["comuna_norm"] = agg["comuna_norm"].fillna("")
    agg["comuna_principal"] = agg["comuna_principal"].fillna("")

    # Lookup precio: usa la zona DONDE MÁS TRABAJÓ la brigada (no la zona origen).
    precios = _get_precios()
    precios_zona = []
    precios_base = []
    comunas_match = []
    for _, row in agg.iterrows():
        zona_dataset = str(row["zona_trabajo"]) if pd.notna(row["zona_trabajo"]) else ""
        zona_precios = ZONA_DATASET_TO_PRECIOS.get(zona_dataset, "")
        precio, comuna_match = _lookup_precio(zona_precios, row["comuna_norm"], precios)
        precios_zona.append(zona_precios)
        precios_base.append(precio)
        comunas_match.append(comuna_match if comuna_match else row["comuna_principal"])

    agg["zona_precios"] = precios_zona
    agg["precio_base"] = precios_base
    agg["comuna_match"] = comunas_match

    # Cálculos derivados
    agg["efectivas_habiles"] = (agg["efectivas_mes"] - agg["efectivas_sabado"]).clip(lower=0)
    agg["pct_efectividad"] = np.where(
        agg["visitas_totales"] > 0,
        (agg["efectivas_mes"] / agg["visitas_totales"] * 100).round(1),
        0.0,
    )
    agg["cumple_meta"] = agg["efectivas_mes"] >= meta_efectivas

    # Montos (meta dinámica)
    valor_efectiva = agg["precio_base"] / meta_efectivas
    monto_habil_raw = valor_efectiva * agg["efectivas_habiles"]
    agg["monto_habil"] = np.minimum(monto_habil_raw, agg["precio_base"]).round().astype(int)
    agg["monto_sabado"] = (valor_efectiva * agg["efectivas_sabado"]).round().astype(int)
    agg["total_pago"] = (agg["monto_habil"] + agg["monto_sabado"]).astype(int)

    # Concatenar (clave de lookup, útil para exportar / debug)
    agg["concatenar"] = (
        "OCA GLOBAL1F" + agg["zona_precios"].fillna("") + agg["comuna_match"].fillna("")
    )

    # Estructura de salida
    out = []
    for _, r in agg.iterrows():
        out.append({
            "nombre": r["Nombre asignado"],
            "eecc": "OCA GLOBAL",
            "ctta_tusan": "Ctta",
            "tipo_brigada": "1F",
            "regional": str(r["regional_trabajo"]) if pd.notna(r["regional_trabajo"]) else "",
            "zona": str(r["zona_trabajo"]) if pd.notna(r["zona_trabajo"]) else "",
            "zona_precios": r["zona_precios"],
            "comuna": r["comuna_match"],
            "normales_mes": int(r["normales"]),
            "cnr_medida_mes": int(r["cnr_medida"]),
            "cnr_intervencion_mes": int(r["cnr_intervencion"]),
            "vf_cge_mes": int(r["vf_cge"]),
            "mantenimiento_mes": int(r["mantenimiento"]),
            "efectivas_mes": int(r["efectivas_mes"]),
            "pct_efectividad": float(r["pct_efectividad"]),
            "normales_sabado": int(r["normales_sab"]),
            "cnr_medida_sabado": int(r["cnr_medida_sab"]),
            "cnr_intervencion_sabado": int(r["cnr_interv_sab"]),
            "vf_cge_sabado": int(r["vf_cge_sab"]),
            "mantenimiento_sabado": int(r["mantenimiento_sab"]),
            "efectivas_sabado": int(r["efectivas_sabado"]),
            "efectivas_habiles": int(r["efectivas_habiles"]),
            "concatenar": r["concatenar"],
            "precio_base": int(r["precio_base"]),
            "monto_habil": int(r["monto_habil"]),
            "monto_sabado": int(r["monto_sabado"]),
            "total_pago": int(r["total_pago"]),
            "cumple_meta": bool(r["cumple_meta"]),
            "meta_efectivas": int(meta_efectivas),
            "dias_trabajados": list(r["dias_trabajados"]) if isinstance(r["dias_trabajados"], list) else [],
            "dias_trabajados_count": int(len(r["dias_trabajados"])) if isinstance(r["dias_trabajados"], list) else 0,
            "sabados_trabajados_count": int(r["sabados_trabajados_count"]),
            "fechas_trabajadas": list(r["fechas_trabajadas"]) if isinstance(r["fechas_trabajadas"], list) else [],
        })

    out.sort(key=lambda x: (x["zona"], -x["total_pago"]))
    return out
