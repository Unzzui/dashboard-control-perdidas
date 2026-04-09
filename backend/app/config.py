from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / "data" / "resultado_consolidado.parquet"

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

MESES_MAP = {
    1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril',
    5: 'mayo', 6: 'junio', 7: 'julio', 8: 'agosto',
    9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre',
}
