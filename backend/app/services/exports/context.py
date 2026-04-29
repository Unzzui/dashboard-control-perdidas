from dataclasses import dataclass
from typing import Any


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
