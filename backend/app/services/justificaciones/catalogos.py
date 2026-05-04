# backend/app/services/justificaciones/catalogos.py
"""
Expone los catálogos al frontend en formato value/label.
"""
from app.config import (
    EFECTIVAS_POR_DIA,
    MOTIVOS_BAJA_PRODUCCION,
    MOTIVOS_LABEL,
    MOTIVOS_NO_TRABAJADO,
    UMBRAL_BAJA_PRODUCCION,
)


def get_catalogos() -> dict:
    return {
        "motivos_no_trabajado": [
            {"value": v, "label": MOTIVOS_LABEL.get(v, v)}
            for v in MOTIVOS_NO_TRABAJADO
        ],
        "motivos_baja_produccion": [
            {"value": v, "label": MOTIVOS_LABEL.get(v, v)}
            for v in MOTIVOS_BAJA_PRODUCCION
        ],
        "umbral_baja_produccion": UMBRAL_BAJA_PRODUCCION,
        "meta_diaria": EFECTIVAS_POR_DIA,
    }
