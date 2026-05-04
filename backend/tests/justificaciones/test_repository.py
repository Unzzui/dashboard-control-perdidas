import json
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


# ----- Justificaciones -----

JUST_BASE = {
    "fecha": "2026-05-07",
    "tecnico_nombre": "JAIRO PEREZ",
    "zona_origen": "07. RANCAGUA",
    "tipo_evento": "dia_no_trabajado",
    "motivo": "licencia_medica",
    "comentario": "Licencia informada por supervisor",
    "produccion_real": 0,
    "meta_diaria": 8,
    "estado_antes": "sin_trabajo",
    "estado_despues": "justificado",
    "es_futuro": False,
    "usuario_registro": "diego.bravo",
}


def test_create_justificacion_inserta_y_escribe_audit(conn):
    j = repo.create_justificacion(conn, **JUST_BASE)
    assert j["id"] is not None
    assert j["fecha"] == "2026-05-07"
    assert j["tecnico_nombre"] == "JAIRO PEREZ"

    audits = repo.get_audit_by_justificacion_id(conn, j["id"])
    assert len(audits) == 1
    assert audits[0]["accion"] == "create"
    assert audits[0]["usuario"] == "diego.bravo"
    snap = json.loads(audits[0]["snapshot_json"])
    assert snap["motivo"] == "licencia_medica"


def test_create_justificacion_conflicto_unique(conn):
    repo.create_justificacion(conn, **JUST_BASE)
    with pytest.raises(repo.JustificacionDuplicadaError) as exc_info:
        repo.create_justificacion(conn, **JUST_BASE)
    assert exc_info.value.id_existente is not None


def test_update_justificacion_escribe_audit_con_diff(conn):
    j = repo.create_justificacion(conn, **JUST_BASE)
    actualizada = repo.update_justificacion(
        conn,
        justificacion_id=j["id"],
        cambios={"motivo": "clima", "comentario": "Tormenta"},
        usuario_registro="ana.perez",
    )
    assert actualizada["motivo"] == "clima"
    assert actualizada["comentario"] == "Tormenta"
    assert actualizada["updated_at"] is not None

    audits = repo.get_audit_by_justificacion_id(conn, j["id"])
    assert len(audits) == 2
    assert audits[-1]["accion"] == "update"
    assert audits[-1]["usuario"] == "ana.perez"
    diff = json.loads(audits[-1]["diff_json"])
    assert diff["motivo"] == {"antes": "licencia_medica", "despues": "clima"}
    assert diff["comentario"]["despues"] == "Tormenta"


def test_update_justificacion_no_existente_raises(conn):
    with pytest.raises(repo.JustificacionNoExisteError):
        repo.update_justificacion(
            conn, justificacion_id=999, cambios={"motivo": "clima"},
            usuario_registro="diego.bravo"
        )


def test_delete_justificacion_borra_y_escribe_audit(conn):
    j = repo.create_justificacion(conn, **JUST_BASE)
    repo.delete_justificacion(conn, justificacion_id=j["id"], usuario_registro="diego.bravo")

    rows = conn.execute(
        "SELECT * FROM justificaciones WHERE id = ?", (j["id"],)
    ).fetchall()
    assert len(rows) == 0

    audits = repo.get_audit_by_justificacion_id(conn, j["id"])
    assert len(audits) == 2
    assert audits[-1]["accion"] == "delete"
    snap = json.loads(audits[-1]["snapshot_json"])
    # snapshot del delete debe tener el estado pre-borrado
    assert snap["motivo"] == "licencia_medica"


def test_delete_justificacion_no_existente_raises(conn):
    with pytest.raises(repo.JustificacionNoExisteError):
        repo.delete_justificacion(
            conn, justificacion_id=999, usuario_registro="diego.bravo"
        )


def test_get_justificaciones_by_persona_mes_filtra_correctamente(conn):
    repo.create_justificacion(conn, **{**JUST_BASE, "fecha": "2026-05-07"})
    repo.create_justificacion(conn, **{**JUST_BASE, "fecha": "2026-05-14"})
    repo.create_justificacion(conn, **{**JUST_BASE, "fecha": "2026-04-30"})  # otro mes
    repo.create_justificacion(conn, **{**JUST_BASE, "fecha": "2026-05-21",
                                       "tecnico_nombre": "OTRO"})

    rows = repo.get_justificaciones_by_persona_mes(
        conn, tecnico_nombre="JAIRO PEREZ", mes="2026-05"
    )
    fechas = sorted([r["fecha"] for r in rows])
    assert fechas == ["2026-05-07", "2026-05-14"]
