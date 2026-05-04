import pytest
from app.services.justificaciones import service, repository as repo


@pytest.fixture
def analista_activo(conn):
    return repo.create_analista(conn, nombre="diego.bravo")


def test_crear_justificacion_dia_no_trabajado_ok(conn, analista_activo):
    j = service.crear_justificacion(
        conn,
        fecha="2026-05-07",  # jueves
        tecnico_nombre="JAIRO PEREZ",
        zona_origen="07. RANCAGUA",
        produccion_real=0,
        meta_diaria=8,
        motivo="licencia_medica",
        comentario=None,
        usuario_registro="diego.bravo",
        es_futuro=False,
    )
    assert j["tipo_evento"] == "dia_no_trabajado"
    assert j["estado_antes"] == "sin_trabajo"


def test_crear_justificacion_baja_produccion_ok(conn, analista_activo):
    j = service.crear_justificacion(
        conn,
        fecha="2026-05-07",
        tecnico_nombre="JAIRO PEREZ",
        zona_origen="07. RANCAGUA",
        produccion_real=2,
        meta_diaria=8,
        motivo="cliente_ausente",
        comentario=None,
        usuario_registro="diego.bravo",
        es_futuro=False,
    )
    assert j["tipo_evento"] == "baja_produccion"
    assert j["estado_antes"] == "baja_produccion"


def test_crear_justificacion_motivo_no_corresponde_a_tipo_falla(conn, analista_activo):
    with pytest.raises(service.MotivoInvalidoError):
        service.crear_justificacion(
            conn,
            fecha="2026-05-07",
            tecnico_nombre="JAIRO PEREZ",
            zona_origen="07. RANCAGUA",
            produccion_real=0,                      # implica dia_no_trabajado
            meta_diaria=8,
            motivo="cliente_ausente",               # solo válido para baja_produccion
            comentario=None,
            usuario_registro="diego.bravo",
            es_futuro=False,
        )


def test_crear_justificacion_motivo_otro_requiere_comentario(conn, analista_activo):
    with pytest.raises(service.ComentarioRequeridoError):
        service.crear_justificacion(
            conn,
            fecha="2026-05-07",
            tecnico_nombre="JAIRO PEREZ",
            zona_origen="07. RANCAGUA",
            produccion_real=0,
            meta_diaria=8,
            motivo="otro",
            comentario=None,
            usuario_registro="diego.bravo",
            es_futuro=False,
        )


def test_crear_justificacion_motivo_otro_comentario_corto_falla(conn, analista_activo):
    with pytest.raises(service.ComentarioRequeridoError):
        service.crear_justificacion(
            conn,
            fecha="2026-05-07",
            tecnico_nombre="JAIRO PEREZ",
            zona_origen="07. RANCAGUA",
            produccion_real=0,
            meta_diaria=8,
            motivo="otro",
            comentario="corto",                      # < 10 chars
            usuario_registro="diego.bravo",
            es_futuro=False,
        )


def test_crear_justificacion_analista_inactivo_falla(conn):
    a = repo.create_analista(conn, nombre="inactivo.usr")
    repo.update_analista_activo(conn, analista_id=a["id"], activo=False)
    with pytest.raises(service.AnalistaInactivoError):
        service.crear_justificacion(
            conn,
            fecha="2026-05-07",
            tecnico_nombre="JAIRO PEREZ",
            zona_origen="07. RANCAGUA",
            produccion_real=0,
            meta_diaria=8,
            motivo="licencia_medica",
            comentario=None,
            usuario_registro="inactivo.usr",
            es_futuro=False,
        )


def test_crear_justificacion_fin_de_semana_falla(conn, analista_activo):
    with pytest.raises(service.FechaNoReportableError):
        service.crear_justificacion(
            conn,
            fecha="2026-05-09",  # sábado
            tecnico_nombre="JAIRO PEREZ",
            zona_origen="07. RANCAGUA",
            produccion_real=0,
            meta_diaria=8,
            motivo="licencia_medica",
            comentario=None,
            usuario_registro="diego.bravo",
            es_futuro=False,
        )


def test_crear_justificacion_feriado_falla(conn, analista_activo):
    with pytest.raises(service.FechaNoReportableError):
        service.crear_justificacion(
            conn,
            fecha="2026-05-01",  # Día del trabajador
            tecnico_nombre="JAIRO PEREZ",
            zona_origen="07. RANCAGUA",
            produccion_real=0,
            meta_diaria=8,
            motivo="licencia_medica",
            comentario=None,
            usuario_registro="diego.bravo",
            es_futuro=False,
        )


def test_actualizar_justificacion_valida_motivo_y_analista(conn, analista_activo):
    j = service.crear_justificacion(
        conn,
        fecha="2026-05-07",
        tecnico_nombre="JAIRO PEREZ",
        zona_origen="07. RANCAGUA",
        produccion_real=0,
        meta_diaria=8,
        motivo="licencia_medica",
        comentario=None,
        usuario_registro="diego.bravo",
        es_futuro=False,
    )
    actualizada = service.actualizar_justificacion(
        conn,
        justificacion_id=j["id"],
        cambios={"motivo": "clima", "comentario": "Tormenta fuerte"},
        usuario_registro="diego.bravo",
    )
    assert actualizada["motivo"] == "clima"


def test_actualizar_a_motivo_invalido_para_tipo_evento_falla(conn, analista_activo):
    j = service.crear_justificacion(
        conn,
        fecha="2026-05-07",
        tecnico_nombre="JAIRO PEREZ",
        zona_origen="07. RANCAGUA",
        produccion_real=0,
        meta_diaria=8,
        motivo="licencia_medica",
        comentario=None,
        usuario_registro="diego.bravo",
        es_futuro=False,
    )
    with pytest.raises(service.MotivoInvalidoError):
        service.actualizar_justificacion(
            conn,
            justificacion_id=j["id"],
            cambios={"motivo": "cliente_ausente"},  # no aplica a dia_no_trabajado
            usuario_registro="diego.bravo",
        )


def test_eliminar_justificacion_valida_analista(conn, analista_activo):
    j = service.crear_justificacion(
        conn,
        fecha="2026-05-07",
        tecnico_nombre="JAIRO PEREZ",
        zona_origen="07. RANCAGUA",
        produccion_real=0,
        meta_diaria=8,
        motivo="licencia_medica",
        comentario=None,
        usuario_registro="diego.bravo",
        es_futuro=False,
    )
    service.eliminar_justificacion(
        conn, justificacion_id=j["id"], usuario_registro="diego.bravo"
    )
    assert repo.get_justificacion_by_id(conn, j["id"]) is None
