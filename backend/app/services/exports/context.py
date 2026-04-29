from dataclasses import dataclass


@dataclass
class MesData:
    """Datos consolidados de un mes para el informe."""
    año: int
    mes: int
    mes_nombre: str
    kpis: dict
    tecnicos: list
    zonas: list
    daily: list
    produccion_total: float
    visitas_fallidas_resp: list
    resultados_fallidos: list
    alertas: dict
    calendario: dict | None
    promedio_efectivas_oficial: float
    brigadas_unicas: int


@dataclass
class InformeContext:
    """Contexto completo del informe: mes actual + mes anterior (para comparativos)."""
    actual: MesData
    anterior: MesData | None  # None si no hay mes anterior con datos

    @property
    def delta_brigadas(self) -> int:
        if self.anterior is None:
            return 0
        return self.actual.brigadas_unicas - self.anterior.brigadas_unicas


import pandas as pd

from app.config import MESES_MAP
from app.dependencies import get_dataframe
from app.services.kpis import calculate_kpis
from app.services.tecnicos import calculate_tecnicos
from app.services.zonas import calculate_zonas
from app.services.daily import calculate_daily
from app.services.pago_tecnicos import calculate_pago_tecnicos
from app.services.visitas_fallidas import calculate_visitas_fallidas
from app.services.resultados_fallidos import calculate_resultados_fallidos
from app.services.alertas_operativas import calculate_alertas_operativas
from app.services.calendario_mes import compute_estructura_mes, compute_meta_efectivas
from app.services.promedio_efectivas import calculate_promedio_efectivas


def _filter_mes(df: pd.DataFrame, año: int, mes: int) -> pd.DataFrame:
    return df[(df['año'] == año) & (df['mes'] == mes)].copy()


def _previous_month(año: int, mes: int) -> tuple[int, int]:
    if mes == 1:
        return año - 1, 12
    return año, mes - 1


def _build_mes_data(filtered: pd.DataFrame, año: int, mes: int) -> MesData:
    mes_nombre = MESES_MAP.get(mes, str(mes)).capitalize()
    kpis = calculate_kpis(filtered)
    tecnicos = calculate_tecnicos(filtered)
    kpis.update(calculate_promedio_efectivas(tecnicos, kpis.get("total_visita_fallida_cge", 0)))

    pago = calculate_pago_tecnicos(filtered)
    produccion_total = sum(t.get("total_pago", 0) for t in pago)

    estructura = compute_estructura_mes(año, numero_mes=mes)
    calendario = {
        **estructura,
        "meta_efectivas": compute_meta_efectivas(estructura["total_habiles"]),
    }

    return MesData(
        año=año,
        mes=mes,
        mes_nombre=mes_nombre,
        kpis=kpis,
        tecnicos=tecnicos,
        zonas=calculate_zonas(filtered),
        daily=calculate_daily(filtered),
        produccion_total=produccion_total,
        visitas_fallidas_resp=calculate_visitas_fallidas(filtered),
        resultados_fallidos=calculate_resultados_fallidos(filtered),
        alertas=calculate_alertas_operativas(filtered, año, [mes_nombre.lower()]),
        calendario=calendario,
        promedio_efectivas_oficial=float(kpis.get("promedio_efectivas_oficial", 0.0)),
        brigadas_unicas=int(kpis.get("total_brigadas_unicas", 0)),
    )


def build_context(año: int, mes: int) -> InformeContext:
    """
    Construye el InformeContext consolidando datos del mes actual y mes anterior.
    Lanza ValueError si el mes solicitado no tiene datos.
    """
    df = get_dataframe()
    filtered_actual = _filter_mes(df, año, mes)
    if filtered_actual.empty:
        raise ValueError(f"No hay datos para {año}-{mes:02d}")

    actual = _build_mes_data(filtered_actual, año, mes)

    año_prev, mes_prev = _previous_month(año, mes)
    filtered_prev = _filter_mes(df, año_prev, mes_prev)
    anterior = _build_mes_data(filtered_prev, año_prev, mes_prev) if not filtered_prev.empty else None

    return InformeContext(actual=actual, anterior=anterior)
