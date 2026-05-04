# backend/tests/justificaciones/test_router.py
"""
Tests de los routers HTTP. Usa TestClient + DB in-memory inyectada vía override.
"""
import sqlite3
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.justificaciones.db import init_db, DDL
from app.routers import justificaciones as just_router
from app.routers import analistas as anal_router


@pytest.fixture
def client(monkeypatch):
    """TestClient con conexión SQLite in-memory persistente para todo el test."""
    # check_same_thread=False requerido: FastAPI ejecuta handlers en un thread pool
    # distinto al thread donde el fixture crea la conexión.
    test_conn = sqlite3.connect(":memory:", check_same_thread=False)
    test_conn.row_factory = sqlite3.Row
    test_conn.execute("PRAGMA foreign_keys = ON")
    init_db(conn=test_conn)

    def override_get_conn():
        return test_conn

    app.dependency_overrides[just_router.get_conn_dep] = override_get_conn
    app.dependency_overrides[anal_router.get_conn_dep] = override_get_conn

    yield TestClient(app)

    app.dependency_overrides.clear()
    test_conn.close()


# ----- Analistas -----

def test_post_analista_crea(client):
    r = client.post("/api/v1/analistas", json={"nombre": "diego.bravo"})
    assert r.status_code == 201
    body = r.json()
    assert body["nombre"] == "diego.bravo"
    assert body["activo"] == 1


def test_post_analista_duplicado_devuelve_409(client):
    client.post("/api/v1/analistas", json={"nombre": "diego.bravo"})
    r = client.post("/api/v1/analistas", json={"nombre": "diego.bravo"})
    assert r.status_code == 409


def test_get_analistas_filtra_activos(client):
    client.post("/api/v1/analistas", json={"nombre": "a"})
    r2 = client.post("/api/v1/analistas", json={"nombre": "b"})
    b_id = r2.json()["id"]
    client.patch(f"/api/v1/analistas/{b_id}", json={"activo": 0})

    r = client.get("/api/v1/analistas?activos=true")
    assert r.status_code == 200
    nombres = [x["nombre"] for x in r.json()]
    assert nombres == ["a"]

    r2 = client.get("/api/v1/analistas")
    assert len(r2.json()) == 2


def test_patch_analista_no_existente_404(client):
    r = client.patch("/api/v1/analistas/9999", json={"activo": 0})
    assert r.status_code == 404
