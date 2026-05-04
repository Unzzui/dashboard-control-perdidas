import sqlite3
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent.parent.parent / "data" / "justificaciones.db"

DDL = """
CREATE TABLE IF NOT EXISTS analistas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT      NOT NULL UNIQUE,
  activo      INTEGER   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS justificaciones (
  id               INTEGER  PRIMARY KEY AUTOINCREMENT,
  fecha            DATE     NOT NULL,
  tecnico_nombre   TEXT     NOT NULL,
  zona_origen      TEXT,
  tipo_evento      TEXT     NOT NULL
                            CHECK (tipo_evento IN ('dia_no_trabajado','baja_produccion')),
  motivo           TEXT     NOT NULL,
  comentario       TEXT,
  produccion_real  INTEGER  NOT NULL,
  meta_diaria      INTEGER  NOT NULL,
  estado_antes     TEXT     NOT NULL,
  estado_despues   TEXT     NOT NULL DEFAULT 'justificado',
  es_futuro        INTEGER  NOT NULL DEFAULT 0,
  usuario_registro TEXT     NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP,
  UNIQUE(tecnico_nombre, fecha)
);

CREATE INDEX IF NOT EXISTS idx_just_fecha       ON justificaciones(fecha);
CREATE INDEX IF NOT EXISTS idx_just_tecnico     ON justificaciones(tecnico_nombre);
CREATE INDEX IF NOT EXISTS idx_just_tipo_evento ON justificaciones(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_just_motivo      ON justificaciones(motivo);

CREATE TABLE IF NOT EXISTS justificaciones_audit (
  id                INTEGER  PRIMARY KEY AUTOINCREMENT,
  justificacion_id  INTEGER  NOT NULL,
  accion            TEXT     NOT NULL CHECK (accion IN ('create','update','delete')),
  snapshot_json     TEXT     NOT NULL,
  diff_json         TEXT,
  usuario           TEXT     NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_just_id  ON justificaciones_audit(justificacion_id);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON justificaciones_audit(created_at);
"""


def get_conn(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """
    Devuelve una conexión SQLite con row_factory configurado.
    Si db_path es None, usa DB_PATH (producción). Para tests, pasar Path(":memory:").
    """
    path = db_path if db_path is not None else DB_PATH
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: Optional[sqlite3.Connection] = None) -> None:
    """
    Crea las tablas si no existen. Idempotente.
    Si conn es None, abre y cierra una conexión nueva.
    """
    own_conn = conn is None
    if own_conn:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = get_conn()
    try:
        conn.executescript(DDL)
        conn.commit()
    finally:
        if own_conn:
            conn.close()
