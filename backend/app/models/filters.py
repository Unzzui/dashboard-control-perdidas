from fastapi import Query
from typing import Optional


class FilterParams:
    def __init__(
        self,
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
        self.año = año
        self.mes = mes
        self.dia = dia
        self.zona = zona
        self.regional = regional
        self.supervisor = supervisor
        self.estado = estado
        self.tratamiento = tratamiento
        self.tipo_campana = tipo_campana
        self.nombre_asignado = nombre_asignado
