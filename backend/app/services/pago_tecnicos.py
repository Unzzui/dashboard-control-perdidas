import unicodedata
import pandas as pd
import numpy as np
from app.config import PRECIOS_PATH, META_EFECTIVAS_MES, ZONA_DATASET_TO_PRECIOS
from app.services.tecnicos import normalizar_nombre


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
      - Usa zona_tecnico (zona de origen) para el lookup de precio.
      - Comuna del técnico: la comuna donde más inspecciones hizo en su zona origen.
      - Efectivas Mes = Normales + CNR Medida (Falla) + CNR Intervención (Hurto) + VF CGE.
      - Efectivas Sábados = mismo cálculo restringido a sábados (dayofweek=5).
      - Efectivas Hábiles = Efectivas Mes - Efectivas Sábados.
      - Monto Hábil = Precio Base × (Efectivas Hábiles / 160), capped at Precio Base.
      - Monto Sábado = (Precio Base / 160) × Efectivas Sábados.
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
    df["es_cnr_medida"] = ((rv == "CNR") & (tipo_cnr == "CNR Falla")).astype(int)
    df["es_cnr_interv"] = ((rv == "CNR") & (tipo_cnr == "CNR Hurto")).astype(int)
    df["es_vf_cge"] = (
        (rv == "Visita fallida") &
        (
            rf.isin(["Sitio eriazo", "Sin empalme", "Desconectado en BT/MT"]) |
            rf.str.contains("Sin acceso medidor", case=False, na=False)
        )
    ).astype(int)
    df["es_efectiva"] = (df["es_normal"] + df["es_cnr_medida"] + df["es_cnr_interv"] + df["es_vf_cge"]).clip(upper=1)
    df["es_visita_total"] = (
        (rv == "Normal") | (rv == "CNR") | (rv == "Visita fallida") | (rv == "Mantenimiento Medidor")
    ).astype(int)

    # Sábado = dayofweek 5
    df["es_sabado"] = (df["Fecha ejecución"].dt.dayofweek == 5).astype(int)

    # Comuna normalizada
    df["comuna_norm"] = df["Comuna"].apply(_normalizar_comuna)

    # Métricas totales por técnico
    df["normal_sab"]      = df["es_normal"] * df["es_sabado"]
    df["cnr_med_sab"]     = df["es_cnr_medida"] * df["es_sabado"]
    df["cnr_int_sab"]     = df["es_cnr_interv"] * df["es_sabado"]
    df["vf_cge_sab"]      = df["es_vf_cge"] * df["es_sabado"]
    df["efectiva_sab"]    = df["es_efectiva"] * df["es_sabado"]

    agg = df.groupby("Nombre asignado", observed=True).agg(
        zona_tecnico=("zona_tecnico", "first"),
        regional_tecnico=("regional_tecnico", "first"),
        normales=("es_normal", "sum"),
        cnr_medida=("es_cnr_medida", "sum"),
        cnr_intervencion=("es_cnr_interv", "sum"),
        vf_cge=("es_vf_cge", "sum"),
        efectivas_mes=("es_efectiva", "sum"),
        visitas_totales=("es_visita_total", "sum"),
        normales_sab=("normal_sab", "sum"),
        cnr_medida_sab=("cnr_med_sab", "sum"),
        cnr_interv_sab=("cnr_int_sab", "sum"),
        vf_cge_sab=("vf_cge_sab", "sum"),
        efectivas_sabado=("efectiva_sab", "sum"),
    ).reset_index()

    # Comuna predominante por técnico dentro de su zona origen
    zi = df["zona_inspeccion"].astype(str)
    zt = df["zona_tecnico"].astype(str)
    df_propio = df[zi == zt]
    if df_propio.empty:
        df_propio = df  # fallback: cualquier comuna donde trabajó
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

    # Lookup precio
    precios = _get_precios()
    precios_zona = []
    precios_base = []
    comunas_match = []
    for _, row in agg.iterrows():
        zona_dataset = str(row["zona_tecnico"]) if pd.notna(row["zona_tecnico"]) else ""
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
    agg["cumple_meta"] = agg["efectivas_mes"] >= META_EFECTIVAS_MES

    # Montos
    valor_efectiva = agg["precio_base"] / META_EFECTIVAS_MES
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
            "regional": str(r["regional_tecnico"]) if pd.notna(r["regional_tecnico"]) else "",
            "zona": str(r["zona_tecnico"]) if pd.notna(r["zona_tecnico"]) else "",
            "zona_precios": r["zona_precios"],
            "comuna": r["comuna_match"],
            "normales_mes": int(r["normales"]),
            "cnr_medida_mes": int(r["cnr_medida"]),
            "cnr_intervencion_mes": int(r["cnr_intervencion"]),
            "vf_cge_mes": int(r["vf_cge"]),
            "efectivas_mes": int(r["efectivas_mes"]),
            "pct_efectividad": float(r["pct_efectividad"]),
            "normales_sabado": int(r["normales_sab"]),
            "cnr_medida_sabado": int(r["cnr_medida_sab"]),
            "cnr_intervencion_sabado": int(r["cnr_interv_sab"]),
            "vf_cge_sabado": int(r["vf_cge_sab"]),
            "efectivas_sabado": int(r["efectivas_sabado"]),
            "efectivas_habiles": int(r["efectivas_habiles"]),
            "concatenar": r["concatenar"],
            "precio_base": int(r["precio_base"]),
            "monto_habil": int(r["monto_habil"]),
            "monto_sabado": int(r["monto_sabado"]),
            "total_pago": int(r["total_pago"]),
            "cumple_meta": bool(r["cumple_meta"]),
        })

    out.sort(key=lambda x: (x["zona"], -x["total_pago"]))
    return out
