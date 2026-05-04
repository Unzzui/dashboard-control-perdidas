import pytest
from pathlib import Path
from app.services.justificaciones.db import get_conn, init_db


@pytest.fixture
def conn():
    """Conexión SQLite in-memory inicializada con el schema. Se cierra al final del test."""
    c = get_conn(db_path=Path(":memory:"))
    init_db(conn=c)
    yield c
    c.close()
