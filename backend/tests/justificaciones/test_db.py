def test_init_db_creates_all_tables(conn):
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    table_names = [r["name"] for r in rows]
    assert "analistas" in table_names
    assert "justificaciones" in table_names
    assert "justificaciones_audit" in table_names


def test_init_db_is_idempotent(conn):
    from app.services.justificaciones.db import init_db
    # Ejecutar una segunda vez no debe fallar
    init_db(conn=conn)
    init_db(conn=conn)
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    table_names = [r["name"] for r in rows]
    # Cada tabla aparece una sola vez
    assert table_names.count("analistas") == 1
    assert table_names.count("justificaciones") == 1


def test_unique_tecnico_fecha_constraint(conn):
    conn.execute(
        "INSERT INTO justificaciones (fecha, tecnico_nombre, tipo_evento, motivo, "
        "produccion_real, meta_diaria, estado_antes, usuario_registro) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ("2026-05-07", "JAIRO PEREZ", "dia_no_trabajado", "licencia_medica",
         0, 8, "sin_trabajo", "diego.bravo")
    )
    conn.commit()
    import sqlite3
    import pytest
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            "INSERT INTO justificaciones (fecha, tecnico_nombre, tipo_evento, motivo, "
            "produccion_real, meta_diaria, estado_antes, usuario_registro) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("2026-05-07", "JAIRO PEREZ", "dia_no_trabajado", "clima",
             0, 8, "sin_trabajo", "diego.bravo")
        )
        conn.commit()
