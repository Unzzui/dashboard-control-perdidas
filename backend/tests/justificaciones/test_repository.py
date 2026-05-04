import pytest
from app.services.justificaciones import repository as repo


# ----- Analistas -----

def test_create_analista_returns_row_with_id(conn):
    a = repo.create_analista(conn, nombre="diego.bravo")
    assert a["id"] is not None
    assert a["nombre"] == "diego.bravo"
    assert a["activo"] == 1
    assert a["created_at"] is not None


def test_create_analista_duplicate_raises(conn):
    repo.create_analista(conn, nombre="diego.bravo")
    with pytest.raises(repo.AnalistaDuplicadoError):
        repo.create_analista(conn, nombre="diego.bravo")


def test_list_analistas_filtra_por_activos(conn):
    repo.create_analista(conn, nombre="diego.bravo")
    repo.create_analista(conn, nombre="ana.perez")
    a = repo.create_analista(conn, nombre="luis.gomez")
    repo.update_analista_activo(conn, analista_id=a["id"], activo=False)

    todos = repo.list_analistas(conn, solo_activos=False)
    activos = repo.list_analistas(conn, solo_activos=True)

    assert len(todos) == 3
    assert len(activos) == 2
    nombres_activos = {x["nombre"] for x in activos}
    assert "luis.gomez" not in nombres_activos


def test_get_analista_by_nombre_devuelve_none_si_no_existe(conn):
    assert repo.get_analista_by_nombre(conn, "no.existe") is None


def test_update_analista_activo_no_existente_raises(conn):
    with pytest.raises(repo.AnalistaNoExisteError):
        repo.update_analista_activo(conn, analista_id=999, activo=False)
