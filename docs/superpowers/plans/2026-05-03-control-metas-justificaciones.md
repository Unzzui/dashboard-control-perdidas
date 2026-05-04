# Control de Metas — Justificaciones (Fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el sistema de justificación de días no trabajados y de baja producción para el modal por persona en Control de Metas, con persistencia SQLite, auditoría, y métricas de cumplimiento ajustado.

**Architecture:** Backend FastAPI con paquete nuevo `services/justificaciones/` (db + repository + service + catalogos) y dos routers (`/api/v1/justificaciones`, `/api/v1/analistas`). Frontend Next.js refactoriza el modal embebido de `ControlMetas.tsx` en componentes nuevos bajo `views/control-metas/` (CalendarioMes + ResumenMes + DiaPanel + JustificacionForm + JustificacionFicha) y agrega vista de configuración de analistas.

**Tech Stack:** FastAPI 0.109+, SQLite (stdlib `sqlite3`), Pandas 2.x, pytest 8.x. Next.js 14, React 18, TypeScript 5, Tailwind 3.

**Spec source:** `docs/superpowers/specs/2026-05-03-control-metas-justificaciones-design.md`

---

## File Structure

### Backend — archivos nuevos

| Path | Responsabilidad |
|---|---|
| `backend/app/services/justificaciones/__init__.py` | Marker de paquete |
| `backend/app/services/justificaciones/db.py` | Conexión SQLite + DDL idempotente |
| `backend/app/services/justificaciones/repository.py` | CRUD puro (sin lógica de negocio) |
| `backend/app/services/justificaciones/service.py` | Validaciones + audit + cruces parquet/sqlite |
| `backend/app/services/justificaciones/catalogos.py` | Exposición de catálogos para el frontend |
| `backend/app/routers/justificaciones.py` | Endpoints REST + Pydantic schemas |
| `backend/app/routers/analistas.py` | CRUD analistas |
| `backend/tests/justificaciones/__init__.py` | Marker |
| `backend/tests/justificaciones/conftest.py` | Fixture de conexión in-memory |
| `backend/tests/justificaciones/test_repository.py` | CRUD + audit |
| `backend/tests/justificaciones/test_service.py` | Validaciones de dominio |
| `backend/tests/justificaciones/test_resumen.py` | Cálculo cumplimiento ajustado |
| `backend/tests/justificaciones/test_router.py` | Endpoints HTTP |

### Backend — archivos a modificar

| Path | Cambio |
|---|---|
| `backend/app/config.py` | +UMBRAL_BAJA_PRODUCCION, +MOTIVOS_*, +MOTIVOS_LABEL |
| `backend/app/main.py` | +init_db() en startup, +router justificaciones, +router analistas |
| `backend/.gitignore` | +`app/data/justificaciones.db` |

### Frontend — archivos nuevos

| Path | Responsabilidad |
|---|---|
| `frontend/src/components/views/control-metas/PersonaModal.tsx` | Modal de 2 columnas (orquestador) |
| `frontend/src/components/views/control-metas/CalendarioMes.tsx` | Calendario grande + estados + overlay |
| `frontend/src/components/views/control-metas/ResumenMes.tsx` | KPIs + estado del mes (panel default) |
| `frontend/src/components/views/control-metas/DiaPanel.tsx` | Panel derecho contextual |
| `frontend/src/components/views/control-metas/JustificacionForm.tsx` | Formulario crear/editar |
| `frontend/src/components/views/control-metas/JustificacionFicha.tsx` | Ficha lectura + historial |
| `frontend/src/components/views/configuracion/AnalistasView.tsx` | CRUD analistas |
| `frontend/src/lib/api/justificaciones.ts` | Cliente HTTP tipado |
| `frontend/src/lib/api/analistas.ts` | Cliente HTTP tipado |

### Frontend — archivos a modificar

| Path | Cambio |
|---|---|
| `frontend/src/types/index.ts` | +Justificacion, +Analista, +Auditoria, +ResumenMes, +CatalogosJustificacion |
| `frontend/src/components/views/ControlMetas.tsx` | Reemplazar bloque modal embebido por `<PersonaModal>` |
| `frontend/src/components/layout/Sidebar.tsx` | +sección "Configuración" con item "Analistas" |
| `frontend/src/app/page.tsx` | +case 'analistas' en `renderContent()` |

---

## Task 1 — Backend: SQLite setup + test harness

**Files:**
- Create: `backend/app/services/justificaciones/__init__.py`
- Create: `backend/app/services/justificaciones/db.py`
- Create: `backend/tests/justificaciones/__init__.py`
- Create: `backend/tests/justificaciones/conftest.py`
- Create: `backend/tests/justificaciones/test_db.py`
- Modify: `backend/.gitignore`

- [ ] **Step 1.1: Crear marker de paquete**

```python
# backend/app/services/justificaciones/__init__.py
```
(archivo vacío)

- [ ] **Step 1.2: Crear `db.py` con DDL idempotente**

```python
# backend/app/services/justificaciones/db.py
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
```

- [ ] **Step 1.3: Crear conftest con fixture in-memory**

```python
# backend/tests/justificaciones/__init__.py
```
(archivo vacío)

```python
# backend/tests/justificaciones/conftest.py
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
```

- [ ] **Step 1.4: Escribir test del DDL**

```python
# backend/tests/justificaciones/test_db.py
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
```

- [ ] **Step 1.5: Correr tests**

```bash
cd backend && pytest tests/justificaciones/test_db.py -v
```
Expected: 3 passed.

- [ ] **Step 1.6: Agregar entrada a `.gitignore`**

Edita `backend/.gitignore` (o créalo si no existe) y agrega al final:
```
app/data/justificaciones.db
app/data/justificaciones.db-journal
```

- [ ] **Step 1.7: Commit**

```bash
cd backend && git add app/services/justificaciones/ tests/justificaciones/ .gitignore && \
git commit -m "feat(justificaciones): SQLite schema y harness de tests"
```

---

## Task 2 — Backend: catálogos en config.py

**Files:**
- Modify: `backend/app/config.py`

- [ ] **Step 2.1: Agregar constantes al final de `config.py`**

Agrega al final del archivo `backend/app/config.py`:

```python
# ========================================================================
# JUSTIFICACIONES (Fase 1)
# ========================================================================

UMBRAL_BAJA_PRODUCCION = 0.5  # 50% de meta diaria → < 4 efectivas con meta 8

MOTIVOS_NO_TRABAJADO = [
    "licencia_medica",
    "permiso_administrativo",
    "feriado_interno",
    "falta_asignacion",
    "problema_operativo",
    "clima",
    "vehiculo_no_disponible",
    "falta_materiales",
    "capacitacion",
    "error_carga_datos",
    "otro",
]

MOTIVOS_BAJA_PRODUCCION = [
    "baja_asignacion",
    "alta_dispersion_geografica",
    "problemas_acceso",
    "cliente_ausente",
    "rechazo_terreno",
    "clima",
    "problemas_conectividad",
    "problemas_app",
    "traslados_excesivos",
    "jornada_parcial",
    "otro",
]

MOTIVOS_LABEL = {
    "licencia_medica": "Licencia médica",
    "permiso_administrativo": "Permiso administrativo",
    "feriado_interno": "Feriado interno",
    "falta_asignacion": "Falta de asignación",
    "problema_operativo": "Problema operativo",
    "clima": "Clima",
    "vehiculo_no_disponible": "Vehículo no disponible",
    "falta_materiales": "Falta de materiales",
    "capacitacion": "Capacitación",
    "error_carga_datos": "Error de carga de datos",
    "otro": "Otro motivo",
    "baja_asignacion": "Baja asignación de trabajo",
    "alta_dispersion_geografica": "Alta dispersión geográfica",
    "problemas_acceso": "Problemas de acceso",
    "cliente_ausente": "Cliente ausente",
    "rechazo_terreno": "Rechazo en terreno",
    "problemas_conectividad": "Problemas de conectividad",
    "problemas_app": "Problemas con la app",
    "traslados_excesivos": "Traslados excesivos",
    "jornada_parcial": "Jornada parcial",
}
```

- [ ] **Step 2.2: Verificar que importan sin error**

```bash
cd backend && python -c "from app.config import UMBRAL_BAJA_PRODUCCION, MOTIVOS_NO_TRABAJADO, MOTIVOS_BAJA_PRODUCCION, MOTIVOS_LABEL; print(len(MOTIVOS_NO_TRABAJADO), len(MOTIVOS_BAJA_PRODUCCION), len(MOTIVOS_LABEL))"
```
Expected output: `11 11 20`

- [ ] **Step 2.3: Commit**

```bash
cd backend && git add app/config.py && \
git commit -m "feat(justificaciones): catálogos de motivos y umbral de baja producción"
```

---

## Task 3 — Backend: Repository de analistas

**Files:**
- Create: `backend/app/services/justificaciones/repository.py` (parcial — solo funciones de analistas)
- Create/append: `backend/tests/justificaciones/test_repository.py`

- [ ] **Step 3.1: Escribir tests primero**

```python
# backend/tests/justificaciones/test_repository.py
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
```

- [ ] **Step 3.2: Correr tests, ver que fallan**

```bash
cd backend && pytest tests/justificaciones/test_repository.py -v
```
Expected: errores de import / atributo (módulo `repository` no existe).

- [ ] **Step 3.3: Implementar repository.py (parte analistas)**

```python
# backend/app/services/justificaciones/repository.py
"""
CRUD puro sobre SQLite. Sin lógica de negocio.
Cada función recibe la conexión por parámetro (inyectable para tests).
"""
import sqlite3
from typing import Optional


# ============================================================================
# Excepciones del dominio del repository
# ============================================================================

class AnalistaDuplicadoError(Exception):
    """Ya existe un analista con ese nombre."""


class AnalistaNoExisteError(Exception):
    """No existe analista con ese id."""


# ============================================================================
# Analistas
# ============================================================================

def create_analista(conn: sqlite3.Connection, nombre: str) -> sqlite3.Row:
    try:
        cur = conn.execute(
            "INSERT INTO analistas (nombre) VALUES (?)",
            (nombre,),
        )
        conn.commit()
        return _get_analista_by_id(conn, cur.lastrowid)
    except sqlite3.IntegrityError as exc:
        if "UNIQUE" in str(exc):
            raise AnalistaDuplicadoError(nombre) from exc
        raise


def get_analista_by_nombre(conn: sqlite3.Connection, nombre: str) -> Optional[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM analistas WHERE nombre = ?", (nombre,)
    ).fetchone()


def list_analistas(conn: sqlite3.Connection, solo_activos: bool = False) -> list[sqlite3.Row]:
    if solo_activos:
        rows = conn.execute(
            "SELECT * FROM analistas WHERE activo = 1 ORDER BY nombre"
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM analistas ORDER BY nombre").fetchall()
    return list(rows)


def update_analista_activo(
    conn: sqlite3.Connection, analista_id: int, activo: bool
) -> sqlite3.Row:
    cur = conn.execute(
        "UPDATE analistas SET activo = ? WHERE id = ?",
        (1 if activo else 0, analista_id),
    )
    if cur.rowcount == 0:
        raise AnalistaNoExisteError(analista_id)
    conn.commit()
    return _get_analista_by_id(conn, analista_id)


def _get_analista_by_id(conn: sqlite3.Connection, analista_id: int) -> sqlite3.Row:
    return conn.execute(
        "SELECT * FROM analistas WHERE id = ?", (analista_id,)
    ).fetchone()
```

- [ ] **Step 3.4: Correr tests, verificar que pasan**

```bash
cd backend && pytest tests/justificaciones/test_repository.py -v
```
Expected: 5 passed.

- [ ] **Step 3.5: Commit**

```bash
cd backend && git add app/services/justificaciones/repository.py tests/justificaciones/test_repository.py && \
git commit -m "feat(justificaciones): repository de analistas con CRUD"
```

---

## Task 4 — Backend: Repository de justificaciones + audit

**Files:**
- Modify: `backend/app/services/justificaciones/repository.py` (agregar funciones)
- Modify: `backend/tests/justificaciones/test_repository.py` (agregar tests)

- [ ] **Step 4.1: Agregar tests al final de `test_repository.py`**

```python
# Append a backend/tests/justificaciones/test_repository.py

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
    import json
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
    import json
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
    import json
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
```

- [ ] **Step 4.2: Correr tests, ver que fallan**

```bash
cd backend && pytest tests/justificaciones/test_repository.py -v
```
Expected: errores en los tests nuevos (funciones no existen).

- [ ] **Step 4.3: Implementar funciones de justificaciones en `repository.py`**

Agrega al final de `backend/app/services/justificaciones/repository.py`:

```python
import json
from datetime import datetime


class JustificacionDuplicadaError(Exception):
    """Ya existe justificación para (tecnico, fecha)."""
    def __init__(self, id_existente: int):
        super().__init__(f"Ya existe justificacion id={id_existente}")
        self.id_existente = id_existente


class JustificacionNoExisteError(Exception):
    """No existe justificación con ese id."""


_JUST_FIELDS = (
    "fecha", "tecnico_nombre", "zona_origen", "tipo_evento", "motivo",
    "comentario", "produccion_real", "meta_diaria", "estado_antes",
    "estado_despues", "es_futuro", "usuario_registro",
)


def create_justificacion(
    conn: sqlite3.Connection,
    *,
    fecha: str,
    tecnico_nombre: str,
    zona_origen: Optional[str],
    tipo_evento: str,
    motivo: str,
    comentario: Optional[str],
    produccion_real: int,
    meta_diaria: int,
    estado_antes: str,
    estado_despues: str = "justificado",
    es_futuro: bool = False,
    usuario_registro: str,
) -> sqlite3.Row:
    try:
        cur = conn.execute(
            """
            INSERT INTO justificaciones
            (fecha, tecnico_nombre, zona_origen, tipo_evento, motivo, comentario,
             produccion_real, meta_diaria, estado_antes, estado_despues, es_futuro,
             usuario_registro)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (fecha, tecnico_nombre, zona_origen, tipo_evento, motivo, comentario,
             produccion_real, meta_diaria, estado_antes, estado_despues,
             1 if es_futuro else 0, usuario_registro),
        )
        new_id = cur.lastrowid
        row = _get_justificacion_by_id(conn, new_id)
        _write_audit(conn, justificacion_id=new_id, accion="create",
                     snapshot=_row_to_dict(row), diff=None,
                     usuario=usuario_registro)
        conn.commit()
        return row
    except sqlite3.IntegrityError as exc:
        if "UNIQUE" in str(exc):
            existente = conn.execute(
                "SELECT id FROM justificaciones WHERE tecnico_nombre = ? AND fecha = ?",
                (tecnico_nombre, fecha),
            ).fetchone()
            raise JustificacionDuplicadaError(id_existente=existente["id"]) from exc
        raise


def update_justificacion(
    conn: sqlite3.Connection,
    *,
    justificacion_id: int,
    cambios: dict,
    usuario_registro: str,
) -> sqlite3.Row:
    actual = _get_justificacion_by_id(conn, justificacion_id)
    if actual is None:
        raise JustificacionNoExisteError(justificacion_id)

    actualizables = {"motivo", "comentario"}
    cambios_validos = {k: v for k, v in cambios.items() if k in actualizables}
    if not cambios_validos:
        return actual

    diff = {}
    for k, nuevo in cambios_validos.items():
        antes = actual[k]
        if antes != nuevo:
            diff[k] = {"antes": antes, "despues": nuevo}

    set_sql = ", ".join(f"{k} = ?" for k in cambios_validos)
    params = list(cambios_validos.values()) + [
        datetime.utcnow().isoformat(timespec="seconds"),
        justificacion_id,
    ]
    conn.execute(
        f"UPDATE justificaciones SET {set_sql}, updated_at = ? WHERE id = ?",
        params,
    )
    nuevo_row = _get_justificacion_by_id(conn, justificacion_id)
    _write_audit(conn, justificacion_id=justificacion_id, accion="update",
                 snapshot=_row_to_dict(nuevo_row), diff=diff,
                 usuario=usuario_registro)
    conn.commit()
    return nuevo_row


def delete_justificacion(
    conn: sqlite3.Connection,
    *,
    justificacion_id: int,
    usuario_registro: str,
) -> None:
    actual = _get_justificacion_by_id(conn, justificacion_id)
    if actual is None:
        raise JustificacionNoExisteError(justificacion_id)

    snapshot = _row_to_dict(actual)
    conn.execute("DELETE FROM justificaciones WHERE id = ?", (justificacion_id,))
    _write_audit(conn, justificacion_id=justificacion_id, accion="delete",
                 snapshot=snapshot, diff=None, usuario=usuario_registro)
    conn.commit()


def get_justificaciones_by_persona_mes(
    conn: sqlite3.Connection, *, tecnico_nombre: str, mes: str
) -> list[sqlite3.Row]:
    """mes: 'YYYY-MM'. Devuelve filas cuya fecha cae en ese mes."""
    rows = conn.execute(
        """
        SELECT * FROM justificaciones
        WHERE tecnico_nombre = ?
          AND substr(fecha, 1, 7) = ?
        ORDER BY fecha
        """,
        (tecnico_nombre, mes),
    ).fetchall()
    return list(rows)


def get_justificacion_by_id(
    conn: sqlite3.Connection, justificacion_id: int
) -> Optional[sqlite3.Row]:
    return _get_justificacion_by_id(conn, justificacion_id)


def get_audit_by_justificacion_id(
    conn: sqlite3.Connection, justificacion_id: int
) -> list[sqlite3.Row]:
    rows = conn.execute(
        "SELECT * FROM justificaciones_audit WHERE justificacion_id = ? "
        "ORDER BY created_at, id",
        (justificacion_id,),
    ).fetchall()
    return list(rows)


# ----------------------------------------------------------------------------
# Helpers internos
# ----------------------------------------------------------------------------

def _get_justificacion_by_id(
    conn: sqlite3.Connection, justificacion_id: int
) -> Optional[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM justificaciones WHERE id = ?", (justificacion_id,)
    ).fetchone()


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}


def _write_audit(
    conn: sqlite3.Connection,
    *,
    justificacion_id: int,
    accion: str,
    snapshot: dict,
    diff: Optional[dict],
    usuario: str,
) -> None:
    conn.execute(
        "INSERT INTO justificaciones_audit "
        "(justificacion_id, accion, snapshot_json, diff_json, usuario) "
        "VALUES (?, ?, ?, ?, ?)",
        (justificacion_id, accion, json.dumps(snapshot, default=str),
         json.dumps(diff, default=str) if diff is not None else None,
         usuario),
    )
```

- [ ] **Step 4.4: Correr tests**

```bash
cd backend && pytest tests/justificaciones/test_repository.py -v
```
Expected: 12 passed (5 analistas + 7 justificaciones).

- [ ] **Step 4.5: Commit**

```bash
cd backend && git add app/services/justificaciones/repository.py tests/justificaciones/test_repository.py && \
git commit -m "feat(justificaciones): repository de justificaciones con audit log"
```

---

## Task 5 — Backend: Service con validaciones

**Files:**
- Create: `backend/app/services/justificaciones/service.py`
- Create: `backend/tests/justificaciones/test_service.py`

- [ ] **Step 5.1: Escribir tests primero**

```python
# backend/tests/justificaciones/test_service.py
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
```

- [ ] **Step 5.2: Correr tests, ver que fallan**

```bash
cd backend && pytest tests/justificaciones/test_service.py -v
```
Expected: errores de import (módulo `service` no existe).

- [ ] **Step 5.3: Implementar `service.py`**

```python
# backend/app/services/justificaciones/service.py
"""
Lógica de dominio para justificaciones.
Aplica validaciones, infiere campos derivados, escribe audit a través del repository.
"""
import sqlite3
from datetime import date, datetime
from typing import Optional

from app.config import (
    EFECTIVAS_POR_DIA,
    FERIADOS_CL,
    MOTIVOS_BAJA_PRODUCCION,
    MOTIVOS_NO_TRABAJADO,
    UMBRAL_BAJA_PRODUCCION,
)
from app.services.justificaciones import repository as repo


# ============================================================================
# Excepciones de validación
# ============================================================================

class JustificacionValidationError(Exception):
    """Base para errores de validación de dominio."""


class MotivoInvalidoError(JustificacionValidationError):
    """El motivo no pertenece al catálogo del tipo_evento."""


class ComentarioRequeridoError(JustificacionValidationError):
    """Comentario obligatorio (≥10 chars) cuando motivo == 'otro'."""


class AnalistaInactivoError(JustificacionValidationError):
    """El analista no existe o está inactivo."""


class FechaNoReportableError(JustificacionValidationError):
    """Fin de semana o feriado: no es día reportable."""


class TipoEventoNoCalculableError(JustificacionValidationError):
    """produccion_real está fuera del rango justificable."""


# ============================================================================
# API pública
# ============================================================================

def crear_justificacion(
    conn: sqlite3.Connection,
    *,
    fecha: str,
    tecnico_nombre: str,
    zona_origen: Optional[str],
    produccion_real: int,
    meta_diaria: int,
    motivo: str,
    comentario: Optional[str],
    usuario_registro: str,
    es_futuro: bool,
) -> sqlite3.Row:
    _validar_fecha_reportable(fecha)
    _validar_analista_activo(conn, usuario_registro)
    tipo_evento = _inferir_tipo_evento(produccion_real, meta_diaria)
    estado_antes = "sin_trabajo" if tipo_evento == "dia_no_trabajado" else "baja_produccion"
    _validar_motivo(motivo, tipo_evento)
    _validar_comentario_si_otro(motivo, comentario)

    return repo.create_justificacion(
        conn,
        fecha=fecha,
        tecnico_nombre=tecnico_nombre,
        zona_origen=zona_origen,
        tipo_evento=tipo_evento,
        motivo=motivo,
        comentario=comentario,
        produccion_real=produccion_real,
        meta_diaria=meta_diaria,
        estado_antes=estado_antes,
        es_futuro=es_futuro,
        usuario_registro=usuario_registro,
    )


def actualizar_justificacion(
    conn: sqlite3.Connection,
    *,
    justificacion_id: int,
    cambios: dict,
    usuario_registro: str,
) -> sqlite3.Row:
    _validar_analista_activo(conn, usuario_registro)
    actual = repo.get_justificacion_by_id(conn, justificacion_id)
    if actual is None:
        raise repo.JustificacionNoExisteError(justificacion_id)

    nuevo_motivo = cambios.get("motivo", actual["motivo"])
    nuevo_comentario = cambios.get("comentario", actual["comentario"])
    _validar_motivo(nuevo_motivo, actual["tipo_evento"])
    _validar_comentario_si_otro(nuevo_motivo, nuevo_comentario)

    return repo.update_justificacion(
        conn,
        justificacion_id=justificacion_id,
        cambios=cambios,
        usuario_registro=usuario_registro,
    )


def eliminar_justificacion(
    conn: sqlite3.Connection,
    *,
    justificacion_id: int,
    usuario_registro: str,
) -> None:
    _validar_analista_activo(conn, usuario_registro)
    repo.delete_justificacion(
        conn, justificacion_id=justificacion_id, usuario_registro=usuario_registro
    )


# ============================================================================
# Validaciones internas
# ============================================================================

def _inferir_tipo_evento(produccion_real: int, meta_diaria: int) -> str:
    umbral = UMBRAL_BAJA_PRODUCCION * meta_diaria
    if produccion_real == 0:
        return "dia_no_trabajado"
    if 0 < produccion_real < umbral:
        return "baja_produccion"
    raise TipoEventoNoCalculableError(
        f"produccion_real={produccion_real} no es justificable "
        f"(meta={meta_diaria}, umbral={umbral})"
    )


def _validar_motivo(motivo: str, tipo_evento: str) -> None:
    catalogo = (
        MOTIVOS_NO_TRABAJADO if tipo_evento == "dia_no_trabajado"
        else MOTIVOS_BAJA_PRODUCCION
    )
    if motivo not in catalogo:
        raise MotivoInvalidoError(
            f"motivo='{motivo}' no aplica a tipo_evento='{tipo_evento}'"
        )


def _validar_comentario_si_otro(motivo: str, comentario: Optional[str]) -> None:
    if motivo != "otro":
        return
    if not comentario or len(comentario.strip()) < 10:
        raise ComentarioRequeridoError(
            "Cuando motivo='otro', el comentario es obligatorio (mín 10 chars)"
        )


def _validar_analista_activo(conn: sqlite3.Connection, nombre: str) -> None:
    a = repo.get_analista_by_nombre(conn, nombre)
    if a is None or a["activo"] != 1:
        raise AnalistaInactivoError(f"analista '{nombre}' no existe o está inactivo")


def _validar_fecha_reportable(fecha_str: str) -> None:
    fecha = datetime.strptime(fecha_str, "%Y-%m-%d").date()
    if fecha.weekday() >= 5:
        raise FechaNoReportableError(f"{fecha_str} es fin de semana")
    feriados_año = FERIADOS_CL.get(fecha.year, set())
    if (fecha.month, fecha.day) in feriados_año:
        raise FechaNoReportableError(f"{fecha_str} es feriado oficial")
```

- [ ] **Step 5.4: Correr tests**

```bash
cd backend && pytest tests/justificaciones/test_service.py -v
```
Expected: 11 passed.

- [ ] **Step 5.5: Commit**

```bash
cd backend && git add app/services/justificaciones/service.py tests/justificaciones/test_service.py && \
git commit -m "feat(justificaciones): service layer con validaciones de dominio"
```

---

## Task 6 — Backend: Service de resumen (cruce parquet + sqlite)

**Files:**
- Modify: `backend/app/services/justificaciones/service.py` (agregar función)
- Create: `backend/tests/justificaciones/test_resumen.py`

- [ ] **Step 6.1: Escribir test del resumen**

```python
# backend/tests/justificaciones/test_resumen.py
"""
Tests del cálculo de resumen mensual (cruce parquet + sqlite).
Usa un calendario falso para no depender del dataset real.
"""
import pytest
from app.services.justificaciones import service, repository as repo


@pytest.fixture
def analista(conn):
    return repo.create_analista(conn, nombre="diego.bravo")


# Calendario sintético: 22 días hábiles, 5 sin trabajo, 3 con baja, 14 ok.
CALENDARIO_FAKE = {
    "calendario": [
        # 5 días sin trabajo (sin_trabajo, hábiles, no futuros)
        {"fecha": "2026-05-04", "es_habil": True, "es_futuro": False, "trabajo": False},
        {"fecha": "2026-05-05", "es_habil": True, "es_futuro": False, "trabajo": False},
        {"fecha": "2026-05-06", "es_habil": True, "es_futuro": False, "trabajo": False},
        {"fecha": "2026-05-07", "es_habil": True, "es_futuro": False, "trabajo": False},
        {"fecha": "2026-05-08", "es_habil": True, "es_futuro": False, "trabajo": False},
        # 3 días con baja producción (trabajaron < 4)
        {"fecha": "2026-05-11", "es_habil": True, "es_futuro": False, "trabajo": True},
        {"fecha": "2026-05-12", "es_habil": True, "es_futuro": False, "trabajo": True},
        {"fecha": "2026-05-13", "es_habil": True, "es_futuro": False, "trabajo": True},
        # 14 días ok (≥ 4)
        *[
            {"fecha": f"2026-05-{d:02d}", "es_habil": True, "es_futuro": False, "trabajo": True}
            for d in (14, 15, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29, 1, 4)
            # nota: alguno se repite arriba; el dict de dias_efectivas resuelve el real
        ],
    ],
    "dias": [
        {"fecha": "2026-05-11", "efectivas": 2},
        {"fecha": "2026-05-12", "efectivas": 3},
        {"fecha": "2026-05-13", "efectivas": 1},
        {"fecha": "2026-05-14", "efectivas": 8},
        {"fecha": "2026-05-15", "efectivas": 9},
        {"fecha": "2026-05-18", "efectivas": 7},
        {"fecha": "2026-05-19", "efectivas": 8},
        {"fecha": "2026-05-20", "efectivas": 8},
        {"fecha": "2026-05-22", "efectivas": 10},
        {"fecha": "2026-05-25", "efectivas": 8},
        {"fecha": "2026-05-26", "efectivas": 8},
        {"fecha": "2026-05-27", "efectivas": 9},
        {"fecha": "2026-05-28", "efectivas": 8},
        {"fecha": "2026-05-29", "efectivas": 8},
    ],
    "total_dias": 14,
}


def test_resumen_sin_justificaciones(conn, analista):
    r = service.calcular_resumen(
        conn,
        tecnico_nombre="JAIRO PEREZ",
        mes="2026-05",
        calendario_data=CALENDARIO_FAKE,
        meta_diaria=8,
        dias_habiles_mes=22,
    )
    assert r["dias_no_trabajados_total"] == 5
    assert r["dias_no_trabajados_justificados"] == 0
    assert r["dias_baja_produccion_total"] == 3
    assert r["dias_baja_produccion_justificados"] == 0
    assert r["dias_pendientes_justificar"] == 8
    assert r["efectivas_totales"] == 2 + 3 + 1 + 8 + 9 + 7 + 8 + 8 + 10 + 8 + 8 + 9 + 8 + 8
    assert r["cumplimiento_real"] == pytest.approx(106 / (22 * 8))


def test_resumen_con_justificaciones_ajusta_cumplimiento(conn, analista):
    # Justificar 5 días no trabajados como dia_no_trabajado
    for fecha in ("2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07", "2026-05-08"):
        service.crear_justificacion(
            conn, fecha=fecha, tecnico_nombre="JAIRO PEREZ",
            zona_origen="07. RANCAGUA", produccion_real=0, meta_diaria=8,
            motivo="licencia_medica", comentario=None,
            usuario_registro="diego.bravo", es_futuro=False,
        )
    # Justificar 1 día de baja
    service.crear_justificacion(
        conn, fecha="2026-05-11", tecnico_nombre="JAIRO PEREZ",
        zona_origen="07. RANCAGUA", produccion_real=2, meta_diaria=8,
        motivo="cliente_ausente", comentario=None,
        usuario_registro="diego.bravo", es_futuro=False,
    )

    r = service.calcular_resumen(
        conn,
        tecnico_nombre="JAIRO PEREZ",
        mes="2026-05",
        calendario_data=CALENDARIO_FAKE,
        meta_diaria=8,
        dias_habiles_mes=22,
    )
    assert r["dias_no_trabajados_justificados"] == 5
    assert r["dias_baja_produccion_justificados"] == 1
    assert r["dias_pendientes_justificar"] == 2  # 8 totales - 6 justificados
    # Días hábiles efectivos = 22 - 5 = 17. Cumplimiento ajustado = 106 / (17*8)
    assert r["cumplimiento_ajustado"] == pytest.approx(106 / (17 * 8))


def test_resumen_no_cuenta_dias_futuros_en_pendientes(conn, analista):
    cal = {
        "calendario": [
            {"fecha": "2026-05-04", "es_habil": True, "es_futuro": False, "trabajo": False},
            {"fecha": "2026-05-25", "es_habil": True, "es_futuro": True, "trabajo": False},
        ],
        "dias": [],
        "total_dias": 0,
    }
    r = service.calcular_resumen(
        conn, tecnico_nombre="JAIRO PEREZ", mes="2026-05",
        calendario_data=cal, meta_diaria=8, dias_habiles_mes=2,
    )
    assert r["dias_no_trabajados_total"] == 1  # solo el no-futuro cuenta
    assert r["dias_pendientes_justificar"] == 1
```

- [ ] **Step 6.2: Correr test, ver que falla**

```bash
cd backend && pytest tests/justificaciones/test_resumen.py -v
```
Expected: error de atributo (`calcular_resumen` no existe).

- [ ] **Step 6.3: Agregar `calcular_resumen` a `service.py`**

Agrega al final de `backend/app/services/justificaciones/service.py`:

```python
# ============================================================================
# Resumen mensual (cruce calendario + justificaciones)
# ============================================================================

def calcular_resumen(
    conn: sqlite3.Connection,
    *,
    tecnico_nombre: str,
    mes: str,                       # 'YYYY-MM'
    calendario_data: dict,          # output de calculate_detalle_tecnico_diario
    meta_diaria: int,
    dias_habiles_mes: int,
) -> dict:
    """
    Cruza el calendario de un técnico (parquet) con sus justificaciones (SQLite)
    y devuelve métricas derivadas.
    """
    umbral_baja = UMBRAL_BAJA_PRODUCCION * meta_diaria
    dias_efectivas = {d["fecha"]: d["efectivas"] for d in calendario_data.get("dias", [])}

    dias_no_trabajados: set[str] = set()
    dias_baja: set[str] = set()
    efectivas_totales = 0

    for c in calendario_data.get("calendario", []):
        if not c["es_habil"] or c["es_futuro"]:
            continue
        if not c["trabajo"]:
            dias_no_trabajados.add(c["fecha"])
        else:
            efectivas = dias_efectivas.get(c["fecha"], 0)
            efectivas_totales += efectivas
            if 0 < efectivas < umbral_baja:
                dias_baja.add(c["fecha"])

    # Sumar efectivas de días que estaban en `dias` pero no aparecen en calendario hábil
    # (no debería pasar, pero es defensivo)
    for fecha, ef in dias_efectivas.items():
        if not any(c["fecha"] == fecha for c in calendario_data.get("calendario", [])):
            efectivas_totales += ef

    justificaciones = repo.get_justificaciones_by_persona_mes(
        conn, tecnico_nombre=tecnico_nombre, mes=mes
    )
    just_no_trab_fechas = {
        j["fecha"] for j in justificaciones if j["tipo_evento"] == "dia_no_trabajado"
    }
    just_baja_fechas = {
        j["fecha"] for j in justificaciones if j["tipo_evento"] == "baja_produccion"
    }

    just_no_trab_count = len(dias_no_trabajados & just_no_trab_fechas)
    just_baja_count = len(dias_baja & just_baja_fechas)
    pendientes = (len(dias_no_trabajados) - just_no_trab_count) + (
        len(dias_baja) - just_baja_count
    )

    dias_habiles_efectivos = max(1, dias_habiles_mes - just_no_trab_count)
    meta_total = meta_diaria * dias_habiles_mes
    meta_ajustada = meta_diaria * dias_habiles_efectivos

    cumplimiento_real = efectivas_totales / meta_total if meta_total else 0.0
    cumplimiento_ajustado = efectivas_totales / meta_ajustada if meta_ajustada else 0.0
    efectivas_ajustadas = efectivas_totales / dias_habiles_efectivos

    return {
        "dias_no_trabajados_total": len(dias_no_trabajados),
        "dias_no_trabajados_justificados": just_no_trab_count,
        "dias_baja_produccion_total": len(dias_baja),
        "dias_baja_produccion_justificados": just_baja_count,
        "dias_pendientes_justificar": pendientes,
        "efectivas_totales": efectivas_totales,
        "efectivas_ajustadas": round(efectivas_ajustadas, 2),
        "cumplimiento_real": round(cumplimiento_real, 4),
        "cumplimiento_ajustado": round(cumplimiento_ajustado, 4),
    }
```

- [ ] **Step 6.4: Correr tests**

```bash
cd backend && pytest tests/justificaciones/test_resumen.py -v
```
Expected: 3 passed.

- [ ] **Step 6.5: Commit**

```bash
cd backend && git add app/services/justificaciones/service.py tests/justificaciones/test_resumen.py && \
git commit -m "feat(justificaciones): cálculo de resumen mensual con cumplimiento ajustado"
```

---

## Task 7 — Backend: Catálogos endpoint (helper)

**Files:**
- Create: `backend/app/services/justificaciones/catalogos.py`

- [ ] **Step 7.1: Crear módulo `catalogos.py`**

```python
# backend/app/services/justificaciones/catalogos.py
"""
Expone los catálogos al frontend en formato value/label.
"""
from app.config import (
    EFECTIVAS_POR_DIA,
    MOTIVOS_BAJA_PRODUCCION,
    MOTIVOS_LABEL,
    MOTIVOS_NO_TRABAJADO,
    UMBRAL_BAJA_PRODUCCION,
)


def get_catalogos() -> dict:
    return {
        "motivos_no_trabajado": [
            {"value": v, "label": MOTIVOS_LABEL.get(v, v)}
            for v in MOTIVOS_NO_TRABAJADO
        ],
        "motivos_baja_produccion": [
            {"value": v, "label": MOTIVOS_LABEL.get(v, v)}
            for v in MOTIVOS_BAJA_PRODUCCION
        ],
        "umbral_baja_produccion": UMBRAL_BAJA_PRODUCCION,
        "meta_diaria": EFECTIVAS_POR_DIA,
    }
```

- [ ] **Step 7.2: Verificar import**

```bash
cd backend && python -c "from app.services.justificaciones.catalogos import get_catalogos; c = get_catalogos(); print(len(c['motivos_no_trabajado']), c['umbral_baja_produccion'])"
```
Expected: `11 0.5`

- [ ] **Step 7.3: Commit**

```bash
cd backend && git add app/services/justificaciones/catalogos.py && \
git commit -m "feat(justificaciones): helper de catálogos para el frontend"
```

---

## Task 8 — Backend: Router de analistas

**Files:**
- Create: `backend/app/routers/analistas.py`
- Create: `backend/tests/justificaciones/test_router.py` (parte analistas)

- [ ] **Step 8.1: Escribir tests del router**

```python
# backend/tests/justificaciones/test_router.py
"""
Tests de los routers HTTP. Usa TestClient + DB in-memory inyectada vía override.
"""
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.services.justificaciones.db import get_conn, init_db
from app.routers import justificaciones as just_router
from app.routers import analistas as anal_router


@pytest.fixture
def client(monkeypatch):
    """TestClient con conexión SQLite in-memory persistente para todo el test."""
    test_conn = get_conn(db_path=Path(":memory:"))
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
```

- [ ] **Step 8.2: Implementar `routers/analistas.py`**

```python
# backend/app/routers/analistas.py
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.services.justificaciones import repository as repo
from app.services.justificaciones.db import get_conn

router = APIRouter()


def get_conn_dep() -> sqlite3.Connection:
    """Dependency para abrir/cerrar conexión por request."""
    conn = get_conn()
    try:
        yield conn
    finally:
        conn.close()


class AnalistaCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)


class AnalistaUpdate(BaseModel):
    activo: int = Field(..., ge=0, le=1)


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}


@router.get("/api/v1/analistas")
def list_analistas(
    activos: bool = False, conn: sqlite3.Connection = Depends(get_conn_dep)
):
    rows = repo.list_analistas(conn, solo_activos=activos)
    return [_row_to_dict(r) for r in rows]


@router.post("/api/v1/analistas", status_code=201)
def create_analista(
    payload: AnalistaCreate, conn: sqlite3.Connection = Depends(get_conn_dep)
):
    try:
        row = repo.create_analista(conn, nombre=payload.nombre)
    except repo.AnalistaDuplicadoError:
        raise HTTPException(status_code=409, detail="Analista ya existe")
    return _row_to_dict(row)


@router.patch("/api/v1/analistas/{analista_id}")
def update_analista(
    analista_id: int,
    payload: AnalistaUpdate,
    conn: sqlite3.Connection = Depends(get_conn_dep),
):
    try:
        row = repo.update_analista_activo(
            conn, analista_id=analista_id, activo=bool(payload.activo)
        )
    except repo.AnalistaNoExisteError:
        raise HTTPException(status_code=404, detail="Analista no existe")
    return _row_to_dict(row)
```

- [ ] **Step 8.3: Registrar router en `main.py`**

Edita `backend/app/main.py`:

Cambia esta línea:
```python
from app.routers import dashboard, filters, geo, retiro_medidores, detalle_aviso, control_diario, detalle_tecnico
```
por:
```python
from app.routers import dashboard, filters, geo, retiro_medidores, detalle_aviso, control_diario, detalle_tecnico, analistas
```

Y agrega después de `app.include_router(detalle_tecnico.router)`:
```python
app.include_router(analistas.router)
```

- [ ] **Step 8.4: Correr tests**

```bash
cd backend && pytest tests/justificaciones/test_router.py -v
```
Expected: 4 passed.

- [ ] **Step 8.5: Commit**

```bash
cd backend && git add app/routers/analistas.py app/main.py tests/justificaciones/test_router.py && \
git commit -m "feat(justificaciones): router REST de analistas"
```

---

## Task 9 — Backend: Router de justificaciones

**Files:**
- Create: `backend/app/routers/justificaciones.py`
- Modify: `backend/tests/justificaciones/test_router.py` (agregar tests)
- Modify: `backend/app/main.py`

- [ ] **Step 9.1: Agregar tests al final de `test_router.py`**

```python
# Append a backend/tests/justificaciones/test_router.py

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
    assert "id_existente" in r.json()


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
```

- [ ] **Step 9.2: Implementar `routers/justificaciones.py`**

```python
# backend/app/routers/justificaciones.py
import json
import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.dependencies import apply_filters, get_dataframe
from app.models.filters import FilterParams
from app.services.detalle_tecnico import calculate_detalle_tecnico_diario
from app.services.justificaciones import repository as repo
from app.services.justificaciones import service
from app.services.justificaciones.catalogos import get_catalogos
from app.services.justificaciones.db import get_conn
from app.config import EFECTIVAS_POR_DIA, FERIADOS_CL

router = APIRouter()


def get_conn_dep() -> sqlite3.Connection:
    conn = get_conn()
    try:
        yield conn
    finally:
        conn.close()


# ============================================================================
# Schemas
# ============================================================================

class JustificacionCreate(BaseModel):
    fecha: str
    tecnico_nombre: str
    zona_origen: Optional[str] = None
    motivo: str
    comentario: Optional[str] = None
    produccion_real: int = Field(..., ge=0)
    meta_diaria: int = Field(..., gt=0)
    es_futuro: bool = False
    usuario_registro: str


class JustificacionUpdate(BaseModel):
    motivo: Optional[str] = None
    comentario: Optional[str] = None
    usuario_registro: str


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}


# ============================================================================
# Endpoints CRUD
# ============================================================================

@router.get("/api/v1/justificaciones/catalogos")
def catalogos():
    return get_catalogos()


@router.post("/api/v1/justificaciones", status_code=201)
def create_justificacion(
    payload: JustificacionCreate,
    conn: sqlite3.Connection = Depends(get_conn_dep),
):
    try:
        row = service.crear_justificacion(
            conn,
            fecha=payload.fecha,
            tecnico_nombre=payload.tecnico_nombre,
            zona_origen=payload.zona_origen,
            produccion_real=payload.produccion_real,
            meta_diaria=payload.meta_diaria,
            motivo=payload.motivo,
            comentario=payload.comentario,
            usuario_registro=payload.usuario_registro,
            es_futuro=payload.es_futuro,
        )
    except repo.JustificacionDuplicadaError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Ya existe justificación para esa fecha",
                "id_existente": exc.id_existente,
            },
        )
    except service.JustificacionValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return _row_to_dict(row)


@router.patch("/api/v1/justificaciones/{jid}")
def update_justificacion(
    jid: int,
    payload: JustificacionUpdate,
    conn: sqlite3.Connection = Depends(get_conn_dep),
):
    cambios = {k: v for k, v in payload.dict(exclude={"usuario_registro"}).items()
               if v is not None}
    try:
        row = service.actualizar_justificacion(
            conn, justificacion_id=jid, cambios=cambios,
            usuario_registro=payload.usuario_registro,
        )
    except repo.JustificacionNoExisteError:
        raise HTTPException(status_code=404, detail="Justificación no existe")
    except service.JustificacionValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return _row_to_dict(row)


@router.delete("/api/v1/justificaciones/{jid}", status_code=204)
def delete_justificacion(
    jid: int,
    usuario_registro: str = Query(..., min_length=1),
    conn: sqlite3.Connection = Depends(get_conn_dep),
):
    try:
        service.eliminar_justificacion(
            conn, justificacion_id=jid, usuario_registro=usuario_registro
        )
    except repo.JustificacionNoExisteError:
        raise HTTPException(status_code=404, detail="Justificación no existe")
    except service.AnalistaInactivoError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/api/v1/justificaciones/persona/{tecnico_nombre}")
def get_justificaciones_persona(
    tecnico_nombre: str,
    mes: str = Query(..., regex=r"^\d{4}-\d{2}$"),
    conn: sqlite3.Connection = Depends(get_conn_dep),
):
    rows = repo.get_justificaciones_by_persona_mes(
        conn, tecnico_nombre=tecnico_nombre, mes=mes
    )
    return {
        "tecnico_nombre": tecnico_nombre,
        "mes": mes,
        "justificaciones": [_row_to_dict(r) for r in rows],
    }


@router.get("/api/v1/justificaciones/persona/{tecnico_nombre}/resumen")
def get_resumen_persona(
    tecnico_nombre: str,
    mes: str = Query(..., regex=r"^\d{4}-\d{2}$"),
    params: FilterParams = Depends(),
    conn: sqlite3.Connection = Depends(get_conn_dep),
):
    df = get_dataframe()
    filtered = apply_filters(df, params)
    cal = calculate_detalle_tecnico_diario(filtered, tecnico_nombre, None)

    año, mes_num = (int(x) for x in mes.split("-"))
    feriados = FERIADOS_CL.get(año, set())
    import calendar as cal_mod
    _, dias_en_mes = cal_mod.monthrange(año, mes_num)
    dias_habiles = sum(
        1 for d in range(1, dias_en_mes + 1)
        if cal_mod.weekday(año, mes_num, d) < 5 and (mes_num, d) not in feriados
    )

    return service.calcular_resumen(
        conn,
        tecnico_nombre=tecnico_nombre,
        mes=mes,
        calendario_data=cal,
        meta_diaria=EFECTIVAS_POR_DIA,
        dias_habiles_mes=dias_habiles,
    )


@router.get("/api/v1/justificaciones/{jid}/audit")
def get_audit(jid: int, conn: sqlite3.Connection = Depends(get_conn_dep)):
    rows = repo.get_audit_by_justificacion_id(conn, jid)
    return {
        "justificacion_id": jid,
        "audit": [
            {
                "accion": r["accion"],
                "snapshot_json": json.loads(r["snapshot_json"]),
                "diff_json": json.loads(r["diff_json"]) if r["diff_json"] else None,
                "usuario": r["usuario"],
                "created_at": r["created_at"],
            }
            for r in rows
        ],
    }
```

- [ ] **Step 9.3: Registrar router en `main.py`**

Edita `backend/app/main.py`:

Actualiza el import:
```python
from app.routers import dashboard, filters, geo, retiro_medidores, detalle_aviso, control_diario, detalle_tecnico, analistas, justificaciones
```

Agrega después de `app.include_router(analistas.router)`:
```python
app.include_router(justificaciones.router)
```

- [ ] **Step 9.4: Correr tests**

```bash
cd backend && pytest tests/justificaciones/ -v
```
Expected: todos los tests anteriores + 9 nuevos = pasa todo.

- [ ] **Step 9.5: Commit**

```bash
cd backend && git add app/routers/justificaciones.py app/main.py tests/justificaciones/test_router.py && \
git commit -m "feat(justificaciones): router REST con CRUD, audit, resumen y catálogos"
```

---

## Task 10 — Backend: Wire init_db() en startup

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 10.1: Agregar evento startup**

Edita `backend/app/main.py`. Agrega antes de `# CORS`:

```python
from app.services.justificaciones.db import init_db


@app.on_event("startup")
def on_startup():
    init_db()
```

- [ ] **Step 10.2: Levantar el server y verificar que la BD se crea**

```bash
cd backend && rm -f app/data/justificaciones.db && uvicorn app.main:app --host 127.0.0.1 --port 8000 &
sleep 3
ls -la app/data/justificaciones.db
curl -s http://127.0.0.1:8000/api/v1/justificaciones/catalogos | head -c 200
kill %1
```
Expected: archivo `justificaciones.db` existe, catálogos vienen en JSON.

- [ ] **Step 10.3: Commit**

```bash
cd backend && git add app/main.py && \
git commit -m "feat(justificaciones): inicializar DB al startup del backend"
```

---

## Task 11 — Frontend: Tipos y clientes API

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/lib/api/justificaciones.ts`
- Create: `frontend/src/lib/api/analistas.ts`

- [ ] **Step 11.1: Agregar tipos al final de `types/index.ts`**

Agrega al final de `frontend/src/types/index.ts`:

```typescript
// ============================================================================
// Justificaciones (Fase 1)
// ============================================================================

export type TipoEventoJustificacion = 'dia_no_trabajado' | 'baja_produccion';
export type EstadoAntesJustificacion = 'sin_trabajo' | 'baja_produccion';

export interface Justificacion {
  id: number;
  fecha: string;                       // YYYY-MM-DD
  tecnico_nombre: string;
  zona_origen: string | null;
  tipo_evento: TipoEventoJustificacion;
  motivo: string;
  comentario: string | null;
  produccion_real: number;
  meta_diaria: number;
  estado_antes: EstadoAntesJustificacion;
  estado_despues: 'justificado';
  es_futuro: 0 | 1;
  usuario_registro: string;
  created_at: string;
  updated_at: string | null;
}

export interface Analista {
  id: number;
  nombre: string;
  activo: 0 | 1;
  created_at: string;
}

export interface CatalogoMotivo {
  value: string;
  label: string;
}

export interface CatalogosJustificacion {
  motivos_no_trabajado: CatalogoMotivo[];
  motivos_baja_produccion: CatalogoMotivo[];
  umbral_baja_produccion: number;     // 0.5
  meta_diaria: number;                // 8
}

export interface ResumenMesPersona {
  dias_no_trabajados_total: number;
  dias_no_trabajados_justificados: number;
  dias_baja_produccion_total: number;
  dias_baja_produccion_justificados: number;
  dias_pendientes_justificar: number;
  efectivas_totales: number;
  efectivas_ajustadas: number;
  cumplimiento_real: number;          // 0..1
  cumplimiento_ajustado: number;      // 0..1
}

export interface AuditEntry {
  accion: 'create' | 'update' | 'delete';
  snapshot_json: Record<string, unknown>;
  diff_json: Record<string, { antes: unknown; despues: unknown }> | null;
  usuario: string;
  created_at: string;
}
```

- [ ] **Step 11.2: Crear `lib/api/justificaciones.ts`**

Crea el archivo `frontend/src/lib/api/justificaciones.ts` con la siguiente implementación. Esta replica el patrón de `lib/api.ts` (fetch directo con `API_BASE = ''`) y devuelve errores tipados:

```typescript
import {
  Justificacion,
  AuditEntry,
  ResumenMesPersona,
  CatalogosJustificacion,
  Filters,
} from '@/types';

const API_BASE = '';

export class APIError extends Error {
  constructor(public status: number, public payload: unknown, message: string) {
    super(message);
  }
}

async function request<T>(
  endpoint: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let payload: unknown = null;
    try { payload = await res.json(); } catch { /* ignore */ }
    throw new APIError(res.status, payload, `API error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface JustificacionCreatePayload {
  fecha: string;
  tecnico_nombre: string;
  zona_origen: string | null;
  motivo: string;
  comentario: string | null;
  produccion_real: number;
  meta_diaria: number;
  es_futuro: boolean;
  usuario_registro: string;
}

export interface JustificacionUpdatePayload {
  motivo?: string;
  comentario?: string | null;
  usuario_registro: string;
}

export function getCatalogos(): Promise<CatalogosJustificacion> {
  return request('/api/v1/justificaciones/catalogos');
}

export function createJustificacion(
  payload: JustificacionCreatePayload
): Promise<Justificacion> {
  return request('/api/v1/justificaciones', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateJustificacion(
  id: number,
  payload: JustificacionUpdatePayload
): Promise<Justificacion> {
  return request(`/api/v1/justificaciones/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteJustificacion(
  id: number,
  usuarioRegistro: string
): Promise<void> {
  return request(
    `/api/v1/justificaciones/${id}?usuario_registro=${encodeURIComponent(usuarioRegistro)}`,
    { method: 'DELETE' }
  );
}

export function getJustificacionesPersona(
  tecnicoNombre: string,
  mes: string
): Promise<{ tecnico_nombre: string; mes: string; justificaciones: Justificacion[] }> {
  const enc = encodeURIComponent(tecnicoNombre);
  return request(`/api/v1/justificaciones/persona/${enc}?mes=${mes}`);
}

function buildFilterQS(filters: Partial<Filters>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) {
      if (v.length > 0) params.append(k, v.join(','));
    } else if (typeof v === 'string' && v === '') {
      return;
    } else {
      params.append(k, String(v));
    }
  });
  return params.toString();
}

export function getResumenPersona(
  tecnicoNombre: string,
  mes: string,
  filters: Partial<Filters>
): Promise<ResumenMesPersona> {
  const enc = encodeURIComponent(tecnicoNombre);
  const filterQs = buildFilterQS(filters);
  const sep = filterQs ? '&' : '';
  return request(
    `/api/v1/justificaciones/persona/${enc}/resumen?mes=${mes}${sep}${filterQs}`
  );
}

export function getAudit(
  id: number
): Promise<{ justificacion_id: number; audit: AuditEntry[] }> {
  return request(`/api/v1/justificaciones/${id}/audit`);
}
```

- [ ] **Step 11.3: Crear `lib/api/analistas.ts`**

```typescript
// frontend/src/lib/api/analistas.ts
import { Analista } from '@/types';

const API_BASE = '';

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listAnalistas(soloActivos = false): Promise<Analista[]> {
  return request(`/api/v1/analistas${soloActivos ? '?activos=true' : ''}`);
}

export function createAnalista(nombre: string): Promise<Analista> {
  return request('/api/v1/analistas', {
    method: 'POST',
    body: JSON.stringify({ nombre }),
  });
}

export function setAnalistaActivo(id: number, activo: boolean): Promise<Analista> {
  return request(`/api/v1/analistas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ activo: activo ? 1 : 0 }),
  });
}
```

- [ ] **Step 11.4: Verificar que tipo-checkea**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 11.5: Commit**

```bash
cd frontend && git add src/types/index.ts src/lib/api/justificaciones.ts src/lib/api/analistas.ts && \
git commit -m "feat(justificaciones): tipos TS y clientes HTTP"
```

---

## Task 12 — Frontend: Crear stub de `PersonaModal`

**Files:**
- Create: `frontend/src/components/views/control-metas/PersonaModal.tsx` (stub)

Este task crea un stub del nuevo componente. **El modal embebido actual en `ControlMetas.tsx` se mantiene intacto** y NO se reemplaza hasta el Task 17 (donde `PersonaModal` ya tendrá CalendarioMes + DiaPanel + ResumenMes y tiene sentido swappear). Este stub solo asegura que los tasks intermedios (13–16) compilen al importarlo en sus tests/refactors si fuera necesario.

- [ ] **Step 12.1: Crear stub `PersonaModal.tsx`**

```typescript
// frontend/src/components/views/control-metas/PersonaModal.tsx
'use client';

import { Filters } from '@/types';

export interface BrigadaSeleccionada {
  nombre: string;
  zona: string;
  diasTrabajados: number;
  efectivasTotal: number;
  efectivasDia: number;
  proyeccion: number;
  pctAvance: number;
  estado: 'cumplida' | 'en_camino' | 'no_alcanzara';
  kwhRecuperado: number;
  trabajaEnMultiplesZonas: boolean;
}

interface Props {
  brigada: BrigadaSeleccionada;
  filters: Filters;
  metaEfectivasMes: number;
  todasLasBrigadas: BrigadaSeleccionada[];
  onClose: () => void;
  onNavegar: (direccion: 'anterior' | 'siguiente') => void;
}

// Stub: implementación real en Task 17.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function PersonaModal(_props: Props) {
  return null;
}
```

- [ ] **Step 12.2: Verificar tipo-check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: sin errores. (El componente no se usa todavía; ControlMetas.tsx sigue con su modal embebido.)

- [ ] **Step 12.3: Commit**

```bash
git add frontend/src/components/views/control-metas/PersonaModal.tsx && \
git commit -m "feat(control-metas): stub de PersonaModal (impl en Task 17)"
```

---

## Task 13 — Frontend: Componente `CalendarioMes`

**Files:**
- Create: `frontend/src/components/views/control-metas/CalendarioMes.tsx`

- [ ] **Step 13.1: Crear `CalendarioMes.tsx`**

```typescript
// frontend/src/components/views/control-metas/CalendarioMes.tsx
'use client';

import { DetalleTecnicoDiario, Justificacion } from '@/types';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export type EstadoDia =
  | 'trabajado_ok'
  | 'baja_produccion'
  | 'sin_trabajo'
  | 'feriado'
  | 'fin_semana'
  | 'futuro';

export interface DiaCalendario {
  fecha: string;
  dia: number;
  diaSemana: string;
  estado: EstadoDia;
  efectivas: number | null;
  metaDiaria: number;
  justificacion: Justificacion | null;
  esJustificable: boolean;       // true si es candidato a justificar (rojo o amarillo, no futuro)
}

interface Props {
  detalle: DetalleTecnicoDiario;
  justificaciones: Justificacion[];
  metaDiaria: number;
  umbralBajaProduccion: number;   // 0.5
  diaSeleccionado: string | null;
  onSeleccionarDia: (fecha: string) => void;
}

export default function CalendarioMes({
  detalle, justificaciones, metaDiaria, umbralBajaProduccion,
  diaSeleccionado, onSeleccionarDia,
}: Props) {
  if (detalle.calendario.length === 0) return null;

  const dias = construirDias(
    detalle, justificaciones, metaDiaria, umbralBajaProduccion
  );
  const primero = dias[0];
  const [year, month] = primero.fecha.split('-');
  const mesNombre = MESES[parseInt(month, 10) - 1];

  const fechaPrimerDiaMes = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  let offsetSemana = fechaPrimerDiaMes.getDay();
  offsetSemana = offsetSemana === 0 ? 6 : offsetSemana - 1;

  return (
    <div className="bg-white border border-slate-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-800">{mesNombre} {year}</p>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">
          {detalle.total_dias} días trabajados
        </p>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-slate-500 py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: offsetSemana }).map((_, i) => (
          <div key={`empty-${i}`} className="h-16" />
        ))}
        {dias.map(d => (
          <CeldaDia
            key={d.fecha}
            dia={d}
            seleccionado={d.fecha === diaSeleccionado}
            onClick={() => d.esJustificable || d.justificacion ? onSeleccionarDia(d.fecha) : undefined}
          />
        ))}
      </div>

      <Leyenda />
    </div>
  );
}

function CeldaDia({
  dia, seleccionado, onClick,
}: {
  dia: DiaCalendario;
  seleccionado: boolean;
  onClick: () => void;
}) {
  const styles = estiloPorEstado(dia.estado);
  const cursor = (dia.esJustificable || dia.justificacion) ? 'cursor-pointer' : 'cursor-default';
  const ring = seleccionado ? 'ring-2 ring-slate-800' : '';
  const justifBorde = dia.justificacion ? 'border-dashed' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-16 rounded ${styles.bg} ${styles.border} ${justifBorde} ${ring} ${cursor} flex flex-col items-center justify-center gap-0.5 transition hover:scale-[1.02]`}
      title={tooltipDia(dia)}
    >
      <span className={`absolute top-1 left-1.5 text-[10px] font-bold ${styles.text}`}>
        {dia.dia}
      </span>
      {dia.efectivas !== null && (
        <span className={`text-base font-bold ${styles.text}`}>{dia.efectivas}</span>
      )}
      {dia.estado === 'trabajado_ok' || dia.estado === 'baja_produccion' ? (
        <BarraCumplimiento valor={dia.efectivas ?? 0} meta={dia.metaDiaria} />
      ) : null}
      {dia.justificacion && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-700" />
      )}
    </button>
  );
}

function BarraCumplimiento({ valor, meta }: { valor: number; meta: number }) {
  const pct = Math.min(100, (valor / meta) * 100);
  return (
    <div className="absolute bottom-1 left-1 right-1 h-0.5 bg-white/40 rounded-full overflow-hidden">
      <div className="h-full bg-white/80" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Leyenda() {
  return (
    <div className="mt-3 pt-2 border-t border-slate-200 flex flex-wrap gap-3 text-[10px] text-slate-600">
      <Item color="bg-emerald-500" label="Cumplió" />
      <Item color="bg-amber-200 border border-amber-300" label="Baja" />
      <Item color="bg-red-50 border border-red-300" label="Sin trabajo" />
      <Item color="bg-blue-50 border border-blue-200" label="Feriado" />
      <Item color="bg-slate-100" label="Fin sem." />
      <Item color="bg-white border border-slate-200" label="Futuro" />
      <Item color="bg-slate-700 rounded-full w-1.5 h-1.5" label="Justificado" />
    </div>
  );
}

function Item({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded ${color}`} />
      {label}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function construirDias(
  detalle: DetalleTecnicoDiario,
  justificaciones: Justificacion[],
  metaDiaria: number,
  umbralBajaProduccion: number,
): DiaCalendario[] {
  const dataDia = new Map<string, number>();
  detalle.dias.forEach(d => { dataDia.set(d.fecha, d.efectivas); });
  const justifMap = new Map<string, Justificacion>();
  justificaciones.forEach(j => { justifMap.set(j.fecha, j); });

  const umbral = umbralBajaProduccion * metaDiaria;

  return detalle.calendario.map(c => {
    const efectivas = dataDia.has(c.fecha) ? dataDia.get(c.fecha)! : null;
    const justificacion = justifMap.get(c.fecha) ?? null;

    let estado: EstadoDia;
    if (c.es_futuro) estado = 'futuro';
    else if (c.es_feriado) estado = 'feriado';
    else if (!c.es_habil) estado = 'fin_semana';
    else if (!c.trabajo) estado = 'sin_trabajo';
    else if ((efectivas ?? 0) < umbral) estado = 'baja_produccion';
    else estado = 'trabajado_ok';

    const esJustificable =
      (estado === 'sin_trabajo' || estado === 'baja_produccion') && !c.es_futuro;

    return {
      fecha: c.fecha,
      dia: c.dia,
      diaSemana: c.dia_semana,
      estado,
      efectivas,
      metaDiaria,
      justificacion,
      esJustificable,
    };
  });
}

function estiloPorEstado(estado: EstadoDia) {
  switch (estado) {
    case 'trabajado_ok':
      return { bg: 'bg-emerald-500', text: 'text-white', border: '' };
    case 'baja_produccion':
      return { bg: 'bg-amber-200', text: 'text-amber-900', border: 'border border-amber-300' };
    case 'sin_trabajo':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border border-red-300' };
    case 'feriado':
      return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border border-blue-200' };
    case 'fin_semana':
      return { bg: 'bg-slate-100', text: 'text-slate-400', border: '' };
    case 'futuro':
      return { bg: 'bg-white', text: 'text-slate-300', border: 'border border-slate-200' };
  }
}

function tooltipDia(d: DiaCalendario): string {
  const partes = [`${d.diaSemana} ${d.dia}`];
  if (d.efectivas !== null) partes.push(`Efectivas: ${d.efectivas}`);
  if (d.justificacion) partes.push(`Justificado: ${d.justificacion.motivo}`);
  return partes.join(' · ');
}
```

- [ ] **Step 13.2: Verificar tipo-check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 13.3: Commit**

```bash
git add frontend/src/components/views/control-metas/CalendarioMes.tsx && \
git commit -m "feat(control-metas): componente CalendarioMes con estados + overlay"
```

---

## Task 14 — Frontend: Componente `ResumenMes`

**Files:**
- Create: `frontend/src/components/views/control-metas/ResumenMes.tsx`

- [ ] **Step 14.1: Crear `ResumenMes.tsx`**

```typescript
// frontend/src/components/views/control-metas/ResumenMes.tsx
'use client';

import { ResumenMesPersona } from '@/types';

interface Props {
  resumen: ResumenMesPersona | null;
  cargando: boolean;
  diasTrabajados: number;
  efectivasDia: number;
  metaDiaria: number;
}

export default function ResumenMes({
  resumen, cargando, diasTrabajados, efectivasDia, metaDiaria,
}: Props) {
  if (cargando) {
    return <Skeleton />;
  }
  if (!resumen) {
    return <p className="text-slate-400 text-sm">Sin datos del mes.</p>;
  }

  const cumplimientoOk = resumen.cumplimiento_real >= 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <KPI label="Días trabajados" value={diasTrabajados.toString()} />
        <KPI label="Total efectivas" value={resumen.efectivas_totales.toString()} />
        <KPI
          label="Ef/día"
          value={efectivasDia.toFixed(1)}
          tone={efectivasDia >= metaDiaria ? 'success' : 'warning'}
        />
        <KPI
          label="% Avance real"
          value={`${(resumen.cumplimiento_real * 100).toFixed(0)}%`}
          tone={cumplimientoOk ? 'success' : 'warning'}
        />
      </div>

      {resumen.cumplimiento_ajustado !== resumen.cumplimiento_real && (
        <div className="rounded border border-slate-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">
            % Avance ajustado
          </p>
          <p className="text-lg font-bold text-slate-800">
            {(resumen.cumplimiento_ajustado * 100).toFixed(0)}%
          </p>
          <p className="text-[10px] text-slate-500">excluye días justificados</p>
        </div>
      )}

      <div className="border-t border-slate-200 pt-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
          Estado del mes
        </p>
        <Linea
          label="Sin trabajo"
          total={resumen.dias_no_trabajados_total}
          justificados={resumen.dias_no_trabajados_justificados}
          color="bg-red-400"
        />
        <Linea
          label="Baja producción"
          total={resumen.dias_baja_produccion_total}
          justificados={resumen.dias_baja_produccion_justificados}
          color="bg-amber-400"
        />

        {resumen.dias_pendientes_justificar > 0 && (
          <div className="mt-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
            <span className="font-semibold">{resumen.dias_pendientes_justificar}</span>{' '}
            día{resumen.dias_pendientes_justificar > 1 ? 's' : ''} sin justificar
          </div>
        )}
      </div>
    </div>
  );
}

function KPI({
  label, value, tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const text =
    tone === 'success' ? 'text-emerald-600' :
    tone === 'warning' ? 'text-red-600' : 'text-slate-800';
  return (
    <div className="bg-slate-50 rounded p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-xl font-bold ${text}`}>{value}</p>
    </div>
  );
}

function Linea({
  label, total, justificados, color,
}: {
  label: string;
  total: number;
  justificados: number;
  color: string;
}) {
  if (total === 0) return null;
  const pct = (justificados / total) * 100;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[11px] text-slate-700 mb-0.5">
        <span>{label}</span>
        <span>{justificados}/{total} justificados</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-14 bg-slate-100 rounded" />
        ))}
      </div>
      <div className="h-20 bg-slate-100 rounded" />
    </div>
  );
}
```

- [ ] **Step 14.2: Tipo-check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 14.3: Commit**

```bash
git add frontend/src/components/views/control-metas/ResumenMes.tsx && \
git commit -m "feat(control-metas): componente ResumenMes con KPIs y estado del mes"
```

---

## Task 15 — Frontend: Componente `JustificacionForm`

**Files:**
- Create: `frontend/src/components/views/control-metas/JustificacionForm.tsx`

- [ ] **Step 15.1: Crear `JustificacionForm.tsx`**

```typescript
// frontend/src/components/views/control-metas/JustificacionForm.tsx
'use client';

import { useState, useMemo } from 'react';
import { Analista, CatalogoMotivo, TipoEventoJustificacion, Justificacion } from '@/types';

interface Props {
  fecha: string;
  tipoEvento: TipoEventoJustificacion;
  produccionReal: number;
  metaDiaria: number;
  zonaOrigen: string;
  esFuturo: boolean;
  motivosCatalogo: CatalogoMotivo[];
  analistas: Analista[];
  initial?: Justificacion;        // si está, modo "editar"
  onSubmit: (data: {
    motivo: string;
    comentario: string | null;
    usuarioRegistro: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export default function JustificacionForm({
  fecha, tipoEvento, produccionReal, metaDiaria, zonaOrigen, esFuturo,
  motivosCatalogo, analistas, initial, onSubmit, onCancel,
}: Props) {
  const [motivo, setMotivo] = useState(initial?.motivo ?? '');
  const [comentario, setComentario] = useState(initial?.comentario ?? '');
  const [usuario, setUsuario] = useState(initial?.usuario_registro ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comentarioObligatorio = motivo === 'otro';
  const comentarioValido = !comentarioObligatorio
    || (comentario.trim().length >= 10);

  const valido = useMemo(
    () => motivo !== '' && usuario !== '' && comentarioValido,
    [motivo, usuario, comentarioValido]
  );

  const handleSubmit = async () => {
    if (!valido || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await onSubmit({
        motivo,
        comentario: comentario.trim() || null,
        usuarioRegistro: usuario,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Tipo de evento
        </p>
        <div className="text-sm text-slate-800">
          {tipoEvento === 'dia_no_trabajado' ? 'Día no trabajado' : 'Baja producción'}{' '}
          <span className="text-slate-400">(auto)</span>
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Motivo *
        </label>
        <select
          className="w-full text-sm border border-slate-200 rounded px-2 py-1.5"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        >
          <option value="">Selecciona motivo</option>
          {motivosCatalogo.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Comentario {comentarioObligatorio && '*'}
        </label>
        <textarea
          className={`w-full text-sm border rounded px-2 py-1.5 ${
            comentarioObligatorio && !comentarioValido
              ? 'border-red-300' : 'border-slate-200'
          }`}
          rows={3}
          maxLength={500}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder={comentarioObligatorio ? 'Mínimo 10 caracteres' : 'Opcional'}
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Registrado por *
        </label>
        <select
          className="w-full text-sm border border-slate-200 rounded px-2 py-1.5"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        >
          <option value="">Selecciona analista</option>
          {analistas.map(a => (
            <option key={a.id} value={a.nombre}>{a.nombre}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!valido || enviando}
          className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enviando ? 'Guardando…' : esFuturo ? 'Guardar (planificado)' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 15.2: Tipo-check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 15.3: Commit**

```bash
git add frontend/src/components/views/control-metas/JustificacionForm.tsx && \
git commit -m "feat(control-metas): formulario de justificación"
```

---

## Task 16 — Frontend: Componente `JustificacionFicha` con audit

**Files:**
- Create: `frontend/src/components/views/control-metas/JustificacionFicha.tsx`

- [ ] **Step 16.1: Crear `JustificacionFicha.tsx`**

```typescript
// frontend/src/components/views/control-metas/JustificacionFicha.tsx
'use client';

import { useState, useEffect } from 'react';
import { Justificacion, AuditEntry } from '@/types';
import { getAudit } from '@/lib/api/justificaciones';

interface Props {
  justificacion: Justificacion;
  motivosLabel: Record<string, string>;
  onEditar: () => void;
  onEliminar: (usuarioRegistro: string) => Promise<void>;
  analistasParaEliminar: string[];
}

export default function JustificacionFicha({
  justificacion, motivosLabel, onEditar, onEliminar, analistasParaEliminar,
}: Props) {
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [usuarioElim, setUsuarioElim] = useState(analistasParaEliminar[0] ?? '');
  const [eliminando, setEliminando] = useState(false);

  const handleEliminar = async () => {
    if (!usuarioElim) return;
    setEliminando(true);
    try {
      await onEliminar(usuarioElim);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Item label="Motivo" value={motivosLabel[justificacion.motivo] ?? justificacion.motivo} />
        <Item
          label="Tipo"
          value={justificacion.tipo_evento === 'dia_no_trabajado' ? 'Día no trabajado' : 'Baja producción'}
        />
        <Item label="Registrado por" value={justificacion.usuario_registro} />
        <Item label="Fecha registro" value={formatFecha(justificacion.created_at)} />
      </div>

      {justificacion.comentario && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Comentario</p>
          <p className="text-xs text-slate-700 bg-slate-50 rounded p-2 italic">
            “{justificacion.comentario}”
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onEditar}
          className="flex-1 px-3 py-1.5 text-sm border border-slate-300 text-slate-700 rounded hover:bg-slate-50"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => setMostrarConfirm(true)}
          className="flex-1 px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50"
        >
          Eliminar
        </button>
      </div>

      {mostrarConfirm && (
        <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2">
          <p className="text-xs text-red-800">¿Eliminar justificación?</p>
          <select
            className="w-full text-xs border border-red-200 rounded px-2 py-1"
            value={usuarioElim}
            onChange={(e) => setUsuarioElim(e.target.value)}
          >
            {analistasParaEliminar.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleEliminar}
              disabled={eliminando || !usuarioElim}
              className="flex-1 px-2 py-1 text-xs bg-red-600 text-white rounded disabled:opacity-50"
            >
              {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button
              type="button"
              onClick={() => setMostrarConfirm(false)}
              className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <Historial justificacionId={justificacion.id} />
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-slate-800">{value}</p>
    </div>
  );
}

function formatFecha(iso: string): string {
  // 2026-05-03T10:30:00 → 03-05-2026 10:30
  const [date, timeFull] = iso.split('T');
  const [y, m, d] = date.split('-');
  const time = (timeFull ?? '00:00').slice(0, 5);
  return `${d}-${m}-${y} ${time}`;
}

function Historial({ justificacionId }: { justificacionId: number }) {
  const [abierto, setAbierto] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!abierto || entries !== null) return;
    setCargando(true);
    getAudit(justificacionId)
      .then(r => setEntries(r.audit))
      .catch(() => setEntries([]))
      .finally(() => setCargando(false));
  }, [abierto, entries, justificacionId]);

  return (
    <div className="border-t border-slate-200 pt-3">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1"
      >
        Historial {entries && `(${entries.length})`}
        <span>{abierto ? '▾' : '▸'}</span>
      </button>
      {abierto && (
        <div className="mt-2 space-y-1.5 text-[11px] text-slate-600">
          {cargando && <p className="text-slate-400">Cargando…</p>}
          {!cargando && entries && entries.length === 0 && (
            <p className="text-slate-400">Sin historial</p>
          )}
          {entries?.map((e, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <div>
                <span className="text-slate-400">{formatFecha(e.created_at)}</span>{' '}
                <span className="font-medium">{e.usuario}</span>{' '}
                <span className="uppercase text-[9px] bg-slate-200 px-1 rounded">
                  {e.accion}
                </span>
              </div>
              {e.diff_json && (
                <ul className="ml-4 text-[10px] text-slate-500 list-disc">
                  {Object.entries(e.diff_json).map(([campo, val]) => (
                    <li key={campo}>
                      {campo}: {String(val.antes)} → {String(val.despues)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 16.2: Tipo-check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 16.3: Commit**

```bash
git add frontend/src/components/views/control-metas/JustificacionFicha.tsx && \
git commit -m "feat(control-metas): ficha de justificación con audit history"
```

---

## Task 17 — Frontend: `DiaPanel` y reescritura de `PersonaModal`

Este task integra todo: `CalendarioMes`, `ResumenMes`, `JustificacionForm`, `JustificacionFicha` se orquestan dentro de un `PersonaModal` reescrito.

**Files:**
- Create: `frontend/src/components/views/control-metas/DiaPanel.tsx`
- Modify: `frontend/src/components/views/control-metas/PersonaModal.tsx` (reescritura completa)

- [ ] **Step 17.1: Crear `DiaPanel.tsx`**

```typescript
// frontend/src/components/views/control-metas/DiaPanel.tsx
'use client';

import { useState } from 'react';
import { Justificacion, Analista, CatalogosJustificacion } from '@/types';
import { DiaCalendario } from './CalendarioMes';
import JustificacionForm from './JustificacionForm';
import JustificacionFicha from './JustificacionFicha';
import {
  createJustificacion,
  updateJustificacion,
  deleteJustificacion,
  APIError,
} from '@/lib/api/justificaciones';

interface Props {
  dia: DiaCalendario;
  tecnicoNombre: string;
  zonaOrigen: string;
  catalogos: CatalogosJustificacion;
  analistas: Analista[];
  motivosLabel: Record<string, string>;
  onCambioJustificacion: () => void;     // refetch justificaciones+resumen
}

type Modo = 'ficha' | 'crear' | 'editar';

export default function DiaPanel({
  dia, tecnicoNombre, zonaOrigen, catalogos, analistas, motivosLabel,
  onCambioJustificacion,
}: Props) {
  const [modo, setModo] = useState<Modo>(
    dia.justificacion ? 'ficha' : 'crear'
  );

  const tipoEvento = dia.estado === 'sin_trabajo' ? 'dia_no_trabajado' : 'baja_produccion';
  const motivosCatalogo = tipoEvento === 'dia_no_trabajado'
    ? catalogos.motivos_no_trabajado
    : catalogos.motivos_baja_produccion;

  const handleCrear = async (data: {
    motivo: string;
    comentario: string | null;
    usuarioRegistro: string;
  }) => {
    try {
      await createJustificacion({
        fecha: dia.fecha,
        tecnico_nombre: tecnicoNombre,
        zona_origen: zonaOrigen,
        motivo: data.motivo,
        comentario: data.comentario,
        produccion_real: dia.efectivas ?? 0,
        meta_diaria: dia.metaDiaria,
        es_futuro: estaEnFuturo(dia.fecha),
        usuario_registro: data.usuarioRegistro,
      });
      onCambioJustificacion();
    } catch (e: unknown) {
      if (e instanceof APIError && e.status === 409) {
        // ya existe → cambiar a modo editar
        setModo('editar');
        onCambioJustificacion();
        return;
      }
      throw e;
    }
  };

  const handleEditar = async (data: {
    motivo: string;
    comentario: string | null;
    usuarioRegistro: string;
  }) => {
    if (!dia.justificacion) return;
    await updateJustificacion(dia.justificacion.id, {
      motivo: data.motivo,
      comentario: data.comentario,
      usuario_registro: data.usuarioRegistro,
    });
    setModo('ficha');
    onCambioJustificacion();
  };

  const handleEliminar = async (usuarioRegistro: string) => {
    if (!dia.justificacion) return;
    await deleteJustificacion(dia.justificacion.id, usuarioRegistro);
    onCambioJustificacion();
  };

  return (
    <div className="space-y-3">
      <Encabezado dia={dia} />
      <ResumenDelDia dia={dia} />

      {modo === 'ficha' && dia.justificacion && (
        <Seccion titulo="Justificación">
          <JustificacionFicha
            justificacion={dia.justificacion}
            motivosLabel={motivosLabel}
            onEditar={() => setModo('editar')}
            onEliminar={handleEliminar}
            analistasParaEliminar={analistas.map(a => a.nombre)}
          />
        </Seccion>
      )}

      {(modo === 'crear' || modo === 'editar') && (
        <Seccion titulo={modo === 'editar' ? 'Editar justificación' : 'Justificar'}>
          <JustificacionForm
            fecha={dia.fecha}
            tipoEvento={tipoEvento}
            produccionReal={dia.efectivas ?? 0}
            metaDiaria={dia.metaDiaria}
            zonaOrigen={zonaOrigen}
            esFuturo={estaEnFuturo(dia.fecha)}
            motivosCatalogo={motivosCatalogo}
            analistas={analistas}
            initial={modo === 'editar' ? dia.justificacion ?? undefined : undefined}
            onSubmit={modo === 'editar' ? handleEditar : handleCrear}
            onCancel={() => setModo(dia.justificacion ? 'ficha' : 'crear')}
          />
        </Seccion>
      )}
    </div>
  );
}

function Encabezado({ dia }: { dia: DiaCalendario }) {
  const [y, m, d] = dia.fecha.split('-');
  const estadoLabel = labelEstado(dia.estado);
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-400">
        {dia.diaSemana} {parseInt(d, 10)} de mes
      </p>
      <p className="text-sm font-semibold text-slate-800">
        {d}-{m}-{y} · <span className="text-slate-500">{estadoLabel}</span>
        {dia.justificacion && (
          <span className="ml-2 text-emerald-600">✓ Justificado</span>
        )}
      </p>
    </div>
  );
}

function ResumenDelDia({ dia }: { dia: DiaCalendario }) {
  const cumplimiento = dia.efectivas !== null
    ? Math.round((dia.efectivas / dia.metaDiaria) * 100)
    : 0;
  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Producción</p>
        <p className="text-slate-800 font-semibold">{dia.efectivas ?? 0}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Meta</p>
        <p className="text-slate-800 font-semibold">{dia.metaDiaria}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Cumplimiento</p>
        <p className="text-slate-800 font-semibold">{cumplimiento}%</p>
      </div>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-200 pt-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
        {titulo}
      </p>
      {children}
    </div>
  );
}

function labelEstado(estado: DiaCalendario['estado']): string {
  switch (estado) {
    case 'trabajado_ok': return 'Trabajado';
    case 'baja_produccion': return 'Baja producción';
    case 'sin_trabajo': return 'Sin trabajo';
    case 'feriado': return 'Feriado';
    case 'fin_semana': return 'Fin de semana';
    case 'futuro': return 'Día futuro';
  }
}

function estaEnFuturo(fecha: string): boolean {
  const hoy = new Date();
  const f = new Date(fecha);
  hoy.setHours(0, 0, 0, 0);
  f.setHours(0, 0, 0, 0);
  return f.getTime() > hoy.getTime();
}
```

- [ ] **Step 17.2: Reescribir `PersonaModal.tsx` con layout de 2 columnas**

Reemplaza el contenido completo de `frontend/src/components/views/control-metas/PersonaModal.tsx` por:

```typescript
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Filters,
  DetalleTecnicoDiario,
  Justificacion,
  Analista,
  CatalogosJustificacion,
  ResumenMesPersona,
} from '@/types';
import { getDetalleTecnicoDiario } from '@/lib/api';
import {
  getCatalogos,
  getJustificacionesPersona,
  getResumenPersona,
} from '@/lib/api/justificaciones';
import { listAnalistas } from '@/lib/api/analistas';
import CalendarioMes, { DiaCalendario } from './CalendarioMes';
import ResumenMes from './ResumenMes';
import DiaPanel from './DiaPanel';

export interface BrigadaSeleccionada {
  nombre: string;
  zona: string;
  diasTrabajados: number;
  efectivasTotal: number;
  efectivasDia: number;
  proyeccion: number;
  pctAvance: number;
  estado: 'cumplida' | 'en_camino' | 'no_alcanzara';
  kwhRecuperado: number;
  trabajaEnMultiplesZonas: boolean;
}

interface Props {
  brigada: BrigadaSeleccionada;
  filters: Filters;
  metaEfectivasMes: number;
  todasLasBrigadas: BrigadaSeleccionada[];
  onClose: () => void;
  onNavegar: (direccion: 'anterior' | 'siguiente') => void;
}

export default function PersonaModal({
  brigada, filters, metaEfectivasMes, todasLasBrigadas, onClose, onNavegar,
}: Props) {
  const [detalle, setDetalle] = useState<DetalleTecnicoDiario | null>(null);
  const [justificaciones, setJustificaciones] = useState<Justificacion[]>([]);
  const [resumen, setResumen] = useState<ResumenMesPersona | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosJustificacion | null>(null);
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const mes = useMemo(() => deducirMes(detalle), [detalle]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [det, cat, ans] = await Promise.all([
        getDetalleTecnicoDiario(brigada.nombre, null, filters),
        catalogos ? Promise.resolve(catalogos) : getCatalogos(),
        analistas.length ? Promise.resolve(analistas) : listAnalistas(true),
      ]);
      setDetalle(det);
      if (!catalogos) setCatalogos(cat);
      if (!analistas.length) setAnalistas(ans);

      const mesDeducido = deducirMesFromDetalle(det);
      if (mesDeducido) {
        const [j, r] = await Promise.all([
          getJustificacionesPersona(brigada.nombre, mesDeducido),
          getResumenPersona(brigada.nombre, mesDeducido, filters),
        ]);
        setJustificaciones(j.justificaciones);
        setResumen(r);
      }
    } finally {
      setCargando(false);
    }
  }, [brigada.nombre, filters, catalogos, analistas]);

  useEffect(() => {
    setDiaSeleccionado(null);
    cargar();
  }, [brigada.nombre]);  // eslint-disable-line react-hooks/exhaustive-deps

  const refetchJustificaciones = useCallback(async () => {
    if (!mes) return;
    const [j, r] = await Promise.all([
      getJustificacionesPersona(brigada.nombre, mes),
      getResumenPersona(brigada.nombre, mes, filters),
    ]);
    setJustificaciones(j.justificaciones);
    setResumen(r);
  }, [brigada.nombre, filters, mes]);

  const motivosLabel: Record<string, string> = useMemo(() => {
    if (!catalogos) return {};
    const map: Record<string, string> = {};
    [...catalogos.motivos_no_trabajado, ...catalogos.motivos_baja_produccion]
      .forEach(m => { map[m.value] = m.label; });
    return map;
  }, [catalogos]);

  const diaCalData = useMemo<DiaCalendario | null>(() => {
    if (!diaSeleccionado || !detalle || !catalogos) return null;
    const c = detalle.calendario.find(x => x.fecha === diaSeleccionado);
    if (!c) return null;
    const dat = detalle.dias.find(x => x.fecha === diaSeleccionado);
    const efectivas = dat ? dat.efectivas : null;
    const justificacion = justificaciones.find(j => j.fecha === diaSeleccionado) ?? null;
    const umbral = catalogos.umbral_baja_produccion * catalogos.meta_diaria;
    let estado: DiaCalendario['estado'];
    if (c.es_futuro) estado = 'futuro';
    else if (c.es_feriado) estado = 'feriado';
    else if (!c.es_habil) estado = 'fin_semana';
    else if (!c.trabajo) estado = 'sin_trabajo';
    else if ((efectivas ?? 0) < umbral) estado = 'baja_produccion';
    else estado = 'trabajado_ok';
    return {
      fecha: c.fecha,
      dia: c.dia,
      diaSemana: c.dia_semana,
      estado,
      efectivas,
      metaDiaria: catalogos.meta_diaria,
      justificacion,
      esJustificable:
        (estado === 'sin_trabajo' || estado === 'baja_produccion') && !c.es_futuro,
    };
  }, [diaSeleccionado, detalle, catalogos, justificaciones]);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <span className="font-semibold truncate">{brigada.nombre}</span>
            <span className="text-xs text-slate-300 truncate">{brigada.zona}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              brigada.estado === 'cumplida' ? 'bg-emerald-500/20 text-emerald-200' :
              brigada.estado === 'en_camino' ? 'bg-amber-500/20 text-amber-200' :
              'bg-red-500/20 text-red-200'
            }`}>
              {labelEstadoMeta(brigada.estado)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavegar('anterior')}
              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
            >← Anterior</button>
            <button
              onClick={() => onNavegar('siguiente')}
              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
            >Siguiente →</button>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
          </div>
        </div>

        {/* Body 2 columnas */}
        <div className="flex-1 overflow-hidden grid grid-cols-[60%_40%]">
          {/* Calendario */}
          <div className="overflow-y-auto p-4 border-r border-slate-200">
            {cargando && !detalle ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-oca-blue" />
              </div>
            ) : detalle && catalogos ? (
              <CalendarioMes
                detalle={detalle}
                justificaciones={justificaciones}
                metaDiaria={catalogos.meta_diaria}
                umbralBajaProduccion={catalogos.umbral_baja_produccion}
                diaSeleccionado={diaSeleccionado}
                onSeleccionarDia={setDiaSeleccionado}
              />
            ) : (
              <p className="text-slate-400 text-sm">Sin datos</p>
            )}
          </div>

          {/* Panel derecho */}
          <div className="overflow-y-auto p-4">
            {diaCalData && catalogos ? (
              <DiaPanel
                dia={diaCalData}
                tecnicoNombre={brigada.nombre}
                zonaOrigen={brigada.zona}
                catalogos={catalogos}
                analistas={analistas}
                motivosLabel={motivosLabel}
                onCambioJustificacion={refetchJustificaciones}
              />
            ) : (
              <ResumenMes
                resumen={resumen}
                cargando={cargando}
                diasTrabajados={brigada.diasTrabajados}
                efectivasDia={brigada.efectivasDia}
                metaDiaria={catalogos?.meta_diaria ?? 8}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function deducirMesFromDetalle(d: DetalleTecnicoDiario): string | null {
  if (d.calendario.length === 0) return null;
  const f = d.calendario[0].fecha;
  return f.slice(0, 7);
}

function deducirMes(d: DetalleTecnicoDiario | null): string | null {
  return d ? deducirMesFromDetalle(d) : null;
}

function labelEstadoMeta(s: BrigadaSeleccionada['estado']): string {
  switch (s) {
    case 'cumplida': return 'Meta Cumplida';
    case 'en_camino': return 'En Camino';
    case 'no_alcanzara': return 'No Alcanzará';
  }
}
```

- [ ] **Step 17.3: Reemplazar el modal embebido en `ControlMetas.tsx`**

Edita `frontend/src/components/views/ControlMetas.tsx`:

1. Agrega al inicio del archivo (después de los imports existentes):
```typescript
import PersonaModal from './control-metas/PersonaModal';
```

2. Localiza el bloque que renderiza el modal embebido (empieza con `{brigadaSeleccionada && (` seguido del JSX del modal — aproximadamente a partir de la línea ≈449 en el archivo actual). Reemplaza TODO ese bloque (incluyendo su JSX hasta el `)}` de cierre, ≈600 líneas) por:

```tsx
{brigadaSeleccionada && (
  <PersonaModal
    brigada={brigadaSeleccionada}
    filters={filters}
    metaEfectivasMes={metaEfectivasMes}
    todasLasBrigadas={todasLasBrigadas}
    onClose={cerrarModal}
    onNavegar={navegarTrabajador}
  />
)}
```

3. Borra el `useEffect` que carga `detalleTecnico` dentro de ControlMetas (líneas ≈86–117): esa carga ahora vive en `PersonaModal`. Borra también los estados que ya no se usan en ControlMetas: `detalleTecnico`, `cargandoDetalle`, `mostrarCalendario`, `inspeccionesDia`, `cargandoInspecciones`, y la función `cargarInspeccionesDia`.

4. Borra los imports que dejaron de usarse en `ControlMetas.tsx`: `getInspeccionesDia` y los tipos `DetalleTecnicoDiario`, `InspeccionesDia` si ya no aparecen en el archivo.

- [ ] **Step 17.4: Tipo-check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors. Si aparecen errores de variables/imports no usados, eliminarlos.

- [ ] **Step 17.5: Probar end-to-end**

```bash
cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 &
cd ../frontend && npm run dev &
sleep 8
```

Manualmente:
1. Crear analista vía API: `curl -X POST http://localhost:8000/api/v1/analistas -H 'Content-Type: application/json' -d '{"nombre":"diego.bravo"}'`
2. Abrir http://localhost:3000 → Control de Metas → click en una brigada.
3. Verificar: layout 2 columnas, calendario grande, panel derecho muestra resumen.
4. Click en un día rojo → panel muestra formulario.
5. Completar y guardar → día queda con overlay (•), contador "sin justificar" baja en 1.

```bash
kill %1 %2
```

- [ ] **Step 17.6: Commit**

```bash
git add frontend/src/components/views/control-metas/DiaPanel.tsx frontend/src/components/views/control-metas/PersonaModal.tsx frontend/src/components/views/ControlMetas.tsx && \
git commit -m "feat(control-metas): modal 2 columnas con calendario protagonista y justificaciones"
```

---

## Task 18 — Frontend: Vista de configuración de analistas

**Files:**
- Create: `frontend/src/components/views/configuracion/AnalistasView.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 18.1: Crear `AnalistasView.tsx`**

```typescript
// frontend/src/components/views/configuracion/AnalistasView.tsx
'use client';

import { useEffect, useState } from 'react';
import { Analista } from '@/types';
import { listAnalistas, createAnalista, setAnalistaActivo } from '@/lib/api/analistas';

export default function AnalistasView() {
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    setAnalistas(await listAnalistas(false));
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const handleAgregar = async () => {
    if (!nuevoNombre.trim()) return;
    setError(null);
    try {
      await createAnalista(nuevoNombre.trim());
      setNuevoNombre('');
      await cargar();
    } catch {
      setError('No se pudo agregar (¿nombre duplicado?)');
    }
  };

  const handleToggle = async (a: Analista) => {
    await setAnalistaActivo(a.id, a.activo === 0);
    await cargar();
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Analistas</h2>
        <p className="text-sm text-slate-500">
          Lista de analistas que pueden registrar justificaciones.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="nombre.apellido"
            className="flex-1 text-sm border border-slate-200 rounded px-3 py-1.5"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAgregar(); }}
          />
          <button
            type="button"
            onClick={handleAgregar}
            disabled={!nuevoNombre.trim()}
            className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50"
          >
            Agregar analista
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 mb-2">{error}</p>
        )}

        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Nombre</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Estado</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Creado</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Acción</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Cargando…</td></tr>
            )}
            {!cargando && analistas.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Sin analistas. Agrega el primero.</td></tr>
            )}
            {analistas.map(a => (
              <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                <td className="px-3 py-2 text-slate-800 font-medium">{a.nombre}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    a.activo === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {a.activo === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {a.created_at.split('T')[0]}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleToggle(a)}
                    className="text-xs text-slate-600 hover:text-slate-800 underline"
                  >
                    {a.activo === 1 ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 18.2: Agregar entrada al Sidebar**

Edita `frontend/src/components/layout/Sidebar.tsx`. Agrega `Settings` a los imports de `lucide-react`:

```typescript
import {
  // ... existentes
  Settings,
} from 'lucide-react';
```

Agrega una nueva sección al final del array `menuSections` (después de "Herramientas"):

```typescript
{
  title: 'Configuración',
  items: [
    { id: 'analistas', label: 'Analistas', icon: Settings },
  ],
},
```

- [ ] **Step 18.3: Wire en `page.tsx`**

Edita `frontend/src/app/page.tsx`.

Agrega al import:
```typescript
import AnalistasView from '@/components/views/configuracion/AnalistasView';
```

Agrega un nuevo `case` en `renderContent()` (antes de `default:`):
```typescript
case 'analistas':
  return <AnalistasView />;
```

- [ ] **Step 18.4: Probar manualmente**

```bash
cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 &
cd ../frontend && npm run dev &
sleep 8
```

1. Abre http://localhost:3000 → en sidebar bajo "Configuración" debe aparecer "Analistas".
2. Click → se ve la tabla. Agregar uno nuevo. Desactivar uno existente.
3. Volver a Control de Metas → abrir modal de una persona → click en día rojo → el dropdown del formulario solo lista los activos.

```bash
kill %1 %2
```

- [ ] **Step 18.5: Commit**

```bash
git add frontend/src/components/views/configuracion/AnalistasView.tsx frontend/src/components/layout/Sidebar.tsx frontend/src/app/page.tsx && \
git commit -m "feat(configuracion): vista CRUD de analistas y entrada en sidebar"
```

---

## Task 19 — Smoke testing manual + cierre

**Files:** ninguno (verificación)

- [ ] **Step 19.1: Levantar stack completo**

```bash
cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 &
cd ../frontend && npm run dev &
sleep 8
```

- [ ] **Step 19.2: Ejecutar checklist de smoke testing**

Ejecuta estos casos manualmente y marca el resultado:

1. **Justificar día rojo (sin trabajo)**: abrir modal de persona con día rojo → click → completar formulario con motivo "licencia_medica" + analista → guardar. Esperado: día conserva color rojo, suma overlay (• y borde dashed). El contador "Sin justificar" baja en 1.

2. **Justificar día amarillo (baja producción)**: idem pero con día amarillo. Esperado: día conserva amarillo + overlay.

3. **Editar justificación**: click en día ya justificado → ver ficha → click "Editar" → cambiar motivo → guardar. Esperado: ficha actualizada, historial muestra entrada UPDATE con diff.

4. **Eliminar justificación**: click en día justificado → "Eliminar" → confirmar. Esperado: día vuelve al estado base sin overlay, contador "Sin justificar" sube en 1, historial conserva entradas previas + DELETE (verificable vía endpoint `/api/v1/justificaciones/{id}/audit`).

5. **Justificar día futuro**: abrir modal mes en curso, click en día futuro hábil → debe permitir justificar (botón "Guardar (planificado)"). Esperado: justificación creada con `es_futuro=1`, `cumplimiento_real` no se ve afectado.

6. **Conflicto 409**: intentar justificar dos veces el mismo día (puede pasar si dos pestañas abiertas). Esperado: el formulario pasa automáticamente a modo "Editar" sin mostrar error.

7. **Motivo "otro"**: seleccionar motivo "otro" → comentario debe volverse obligatorio (mín 10 chars). Botón Guardar disabled hasta cumplir.

8. **Configuración → Analistas**: agregar analista nuevo → vuelve al modal → debe aparecer en el dropdown. Desactivar uno → desaparece del dropdown del formulario.

9. **Cumplimiento ajustado**: justificar varios días no trabajados como `licencia_medica`. Esperado: `% Avance ajustado` aparece en panel derecho mostrando un % > `% Avance real`.

10. **Multi-mes**: cambiar el filtro global de mes → al reabrir un modal, el calendario refleja el mes nuevo y carga sus justificaciones del mes correspondiente.

```bash
kill %1 %2
```

- [ ] **Step 19.3: Correr todo el test suite del backend**

```bash
cd backend && pytest tests/ -v
```
Expected: todos los tests verdes (no debe haber regresiones en tests existentes).

- [ ] **Step 19.4: Tipo-check final del frontend**

```bash
cd frontend && npx tsc --noEmit
```
Expected: sin errores.

- [ ] **Step 19.5: Commit final del checklist (si algún fix se hizo)**

Si hubo correcciones durante smoke testing, commitealas con mensaje descriptivo. Si no, no es necesario commit.

---

## Notas de cierre

- **Datos iniciales**: la BD `justificaciones.db` se crea vacía. Para usar la app, agregar al menos un analista vía la vista "Configuración" o vía `curl POST /api/v1/analistas`.
- **Tests del frontend**: no se incluyeron en este plan (smoke testing manual basta para Fase 1). Si en Fase 2 se añaden tests, usar Vitest + React Testing Library.
- **Performance**: las consultas SQLite son sub-milisegundo para volúmenes < 100k filas. No hay índice de cobertura porque las queries son puntuales por `(tecnico, mes)`. Si crece mucho, agregar índice compuesto.
- **Migraciones**: cualquier cambio futuro de schema debe ir como `ALTER TABLE` en `db.py` (idempotente) o como script de migración separado en `backend/scripts/migrate_*.py`.
