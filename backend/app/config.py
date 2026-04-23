from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / "data" / "resultado_consolidado.parquet"
PRECIOS_PATH = Path(__file__).parent.parent / "data" / "precios_base.parquet"

META_POR_BRIGADA = 6500000

# Meta mensual de visitas efectivas por técnico (8 ef/día × 20 días hábiles)
META_EFECTIVAS_MES = 160

# Mapeo Zona dataset (con código y mayúsculas) → Zona del parquet de precios
ZONA_DATASET_TO_PRECIOS = {
    "01. ARICA": "Arica-Iquique",
    "01. IQUIQUE": "Arica-Iquique",
    "02. ANTOFAGASTA": "Atacama",
    "03. ATACAMA": "Atacama",
    "04. COQUIMBO": "Coquimbo",
    "05. QUINTA MELIPILLA": "Quinta-Melipilla",
    "06. METROPOLITANA": "Quinta-Melipilla",
    "07. RANCAGUA": "Rancagua",
    "08. COLCHAGUA - CARDENAL CARO": "Colchagua-Cardenal Caro",
    "09. MAULE NORTE": "Maule Norte",
    "10. MAULE SUR": "Maule Sur",
    "11. CONCEPCION": "Bio Bio",
}

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
