from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / "data" / "resultado_consolidado.parquet"
PRECIOS_PATH = Path(__file__).parent.parent / "data" / "precios_base.parquet"

META_POR_BRIGADA = 6500000

# Promedio diario objetivo de visitas efectivas por técnico.
EFECTIVAS_POR_DIA = 8

# Meta mensual base (legacy fallback). El cálculo real es dinámico:
# meta_efectivas = EFECTIVAS_POR_DIA × días hábiles del mes visualizado.
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

# Feriados chilenos oficiales.
# Fuente: lista oficial de feriados legales publicada por el Gobierno de Chile.
# Formato: { año: set[(mes, día)] }
FERIADOS_CL: dict[int, set[tuple[int, int]]] = {
    2025: {
        (1, 1),   # Año Nuevo
        (4, 18),  # Viernes Santo
        (4, 19),  # Sábado Santo
        (5, 1),   # Día del Trabajador
        (5, 21),  # Día de las Glorias Navales
        (6, 20),  # Día de los Pueblos Indígenas
        (6, 29),  # San Pedro y San Pablo
        (7, 16),  # Virgen del Carmen
        (8, 15),  # Asunción de la Virgen
        (9, 18),  # Independencia Nacional
        (9, 19),  # Glorias del Ejército
        (10, 12), # Encuentro de Dos Mundos
        (10, 31), # Día de las Iglesias Evangélicas
        (11, 1),  # Día de Todos los Santos
        (12, 8),  # Inmaculada Concepción
        (12, 14), # Elecciones Presidenciales 2a vuelta
        (12, 25), # Navidad
    },
    2026: {
        (1, 1),   # Año Nuevo
        (4, 3),   # Viernes Santo
        (4, 4),   # Sábado Santo
        (5, 1),   # Día del Trabajador
        (5, 21),  # Día de las Glorias Navales
        (6, 29),  # San Pedro y San Pablo
        (7, 16),  # Virgen del Carmen
        (8, 15),  # Asunción de la Virgen
        (9, 18),  # Independencia Nacional
        (9, 19),  # Glorias del Ejército
        (10, 12), # Encuentro de Dos Mundos
        (10, 31), # Día de las Iglesias Evangélicas
        (11, 1),  # Día de Todos los Santos
        (12, 8),  # Inmaculada Concepción
        (12, 25), # Navidad
    },
}
