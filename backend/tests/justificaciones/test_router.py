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


# ----- Justificaciones -----

JUST_PAYLOAD = {
    "fecha": "2026-05-07",
    "tecnico_nombre": "JAIRO PEREZ",
    "zona_origen": "07. RANCAGUA",
    "motivo": "licencia_medica",
    "comentario": None,
    "produccion_real": 0,
    "meta_diaria": 8,
    "es_futuro": False,
    "usuario_registro": "diego.bravo",
}


@pytest.fixture
def client_con_analista(client):
    client.post("/api/v1/analistas", json={"nombre": "diego.bravo"})
    return client


def test_post_justificacion_crea(client_con_analista):
    r = client_con_analista.post("/api/v1/justificaciones", json=JUST_PAYLOAD)
    assert r.status_code == 201
    body = r.json()
    assert body["id"] is not None
    assert body["tipo_evento"] == "dia_no_trabajado"
    assert body["estado_antes"] == "sin_trabajo"


def test_post_justificacion_duplicada_409(client_con_analista):
    client_con_analista.post("/api/v1/justificaciones", json=JUST_PAYLOAD)
    r = client_con_analista.post("/api/v1/justificaciones", json=JUST_PAYLOAD)
    assert r.status_code == 409
    body = r.json()
    # detail puede ser un objeto con id_existente
    assert "id_existente" in body.get("detail", {}) or "id_existente" in body


def test_post_justificacion_motivo_invalido_422(client_con_analista):
    payload = {**JUST_PAYLOAD, "motivo": "cliente_ausente"}  # solo baja_produccion
    r = client_con_analista.post("/api/v1/justificaciones", json=payload)
    assert r.status_code == 422


def test_post_justificacion_fin_de_semana_422(client_con_analista):
    payload = {**JUST_PAYLOAD, "fecha": "2026-05-09"}  # sábado
    r = client_con_analista.post("/api/v1/justificaciones", json=payload)
    assert r.status_code == 422


def test_patch_justificacion(client_con_analista):
    r = client_con_analista.post("/api/v1/justificaciones", json=JUST_PAYLOAD)
    jid = r.json()["id"]
    r2 = client_con_analista.patch(
        f"/api/v1/justificaciones/{jid}",
        json={"motivo": "clima", "usuario_registro": "diego.bravo"},
    )
    assert r2.status_code == 200
    assert r2.json()["motivo"] == "clima"


def test_delete_justificacion(client_con_analista):
    r = client_con_analista.post("/api/v1/justificaciones", json=JUST_PAYLOAD)
    jid = r.json()["id"]
    r2 = client_con_analista.delete(
        f"/api/v1/justificaciones/{jid}?usuario_registro=diego.bravo"
    )
    assert r2.status_code == 204


def test_get_justificaciones_persona_mes(client_con_analista):
    client_con_analista.post("/api/v1/justificaciones", json=JUST_PAYLOAD)
    client_con_analista.post(
        "/api/v1/justificaciones",
        json={**JUST_PAYLOAD, "fecha": "2026-05-14"},
    )
    r = client_con_analista.get(
        "/api/v1/justificaciones/persona/JAIRO PEREZ?mes=2026-05"
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["justificaciones"]) == 2


def test_get_audit_devuelve_historial(client_con_analista):
    r = client_con_analista.post("/api/v1/justificaciones", json=JUST_PAYLOAD)
    jid = r.json()["id"]
    client_con_analista.patch(
        f"/api/v1/justificaciones/{jid}",
        json={"motivo": "clima", "usuario_registro": "diego.bravo"},
    )
    r2 = client_con_analista.get(f"/api/v1/justificaciones/{jid}/audit")
    assert r2.status_code == 200
    audit = r2.json()["audit"]
    assert len(audit) == 2
    assert audit[0]["accion"] == "create"
    assert audit[1]["accion"] == "update"


def test_get_catalogos(client):
    r = client.get("/api/v1/justificaciones/catalogos")
    assert r.status_code == 200
    body = r.json()
    assert len(body["motivos_no_trabajado"]) == 11
    assert body["umbral_baja_produccion"] == 0.5
    assert body["meta_diaria"] == 8
