# Control de Metas — Sistema de Justificaciones (Fase 1)

**Fecha:** 2026-05-03
**Autor:** diego.bravo + Claude
**Estado:** Aprobado para implementación

## Contexto

La vista `Control de Metas` permite revisar el cumplimiento de metas por persona/brigada. Al abrir el modal de una persona se ve un calendario con días trabajados (verde) y no trabajados (rojo). Hoy ese calendario es informativo: el analista no puede registrar por qué un día está rojo, y al manejar muchas brigadas se generan vacíos de gestión sin trazabilidad.

Esta fase agrega un sistema de **justificación de días** (no trabajados y de baja producción) integrado al modal por persona, con persistencia, auditoría y métricas derivadas mínimas.

## Restricción explícita

La primera versión debe ser simple, clara y útil para la gestión diaria. Funcionalidades excluidas que quedan para Fase 2 (spec separado):

- Vista dedicada del log con filtros, paginación y exportación
- Mapa de ruta de puntos visitados (usando `Coord X usuario` / `Coord Y usuario` ya presentes en el dataset)
- KPIs derivados avanzados (tasa visita→inspección, top motivos por brigada/zona/supervisor, días críticos recurrentes)
- Bulk actions (justificación masiva por brigada/rango)
- Auth real con JWT

## Objetivo

1. Hacer del calendario en el modal una herramienta de gestión, no solo informativa.
2. Permitir justificar días no trabajados (rojo) y de baja producción (amarillo) con motivo, comentario y registro auditable de quién justificó.
3. Distinguir visualmente días sin justificar (riesgo de gestión) vs justificados.
4. Calcular cumplimiento ajustado (excluyendo días justificados como no trabajados) para análisis honesto de productividad.

## Decisiones de arquitectura

| Decisión | Elegido | Alternativas descartadas | Razón |
|---|---|---|---|
| Persistencia | SQLite (`backend/app/data/justificaciones.db`) | JSON append-only; PostgreSQL ya | Transaccional, ACID, 0 infra nueva, migración trivial a PG después |
| Identidad analista | Selector simple en formulario, lista en tabla `analistas` | Header HTTP; JWT login | Sin auth real en MVP; suficiente para equipo interno |
| Catálogo de motivos | Constantes en `config.py` | Tabla editable | Cambiarlos seguido rompería KPIs históricos |
| Catálogo de analistas | Tabla SQLite editable desde UI | Constantes en `config.py` | Roster cambia naturalmente; activar/desactivar sin redeploy |
| Umbral baja producción | Binario, `efectivas < 50% de meta diaria` (< 4) | 3 bandas; configurable por zona | Una sola línea de código, claro para analista, configurable como constante en `config.py` |
| Estados del calendario | Color de fondo (estado del día) + overlay (justificación) | Sumar nuevo color por estado de justificación | Conserva visibilidad del estado base; sin conflicto con feriado (que ya es azul) |
| Layout del modal | 2 columnas: calendario grande izquierda, panel contextual derecha | Sub-modal apilado (actual); panel inferior | Calendario siempre visible, panel contextual cambia por selección |
| Edit/Delete de justificaciones | Permitidos, cada acción genera fila en `justificaciones_audit` | Solo edit; soft-delete | MVP estricto pero sin atar manos en errores genuinos |
| Días futuros | Permitidos (estado "planificado") | Solo días ≤ hoy | Útil para licencias programadas, feriados internos |

## Modelo de datos

SQLite, archivo `backend/app/data/justificaciones.db`. DDL idempotente al startup del backend (en `db.py`).

```sql
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
  zona_origen      TEXT,                          -- snapshot al momento de justificar
  tipo_evento      TEXT     NOT NULL
                            CHECK (tipo_evento IN ('dia_no_trabajado','baja_produccion')),
  motivo           TEXT     NOT NULL,             -- valor del catálogo en config.py
  comentario       TEXT,
  produccion_real  INTEGER  NOT NULL,             -- efectivas del día (0 si no trabajó)
  meta_diaria      INTEGER  NOT NULL,             -- 8 al momento del registro
  estado_antes     TEXT     NOT NULL,             -- 'sin_trabajo' | 'baja_produccion'
  estado_despues   TEXT     NOT NULL DEFAULT 'justificado',
  es_futuro        INTEGER  NOT NULL DEFAULT 0,   -- 1 si justificación planificada
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
  justificacion_id  INTEGER  NOT NULL,            -- puede apuntar a fila ya borrada
  accion            TEXT     NOT NULL CHECK (accion IN ('create','update','delete')),
  snapshot_json     TEXT     NOT NULL,            -- create/update: estado post-cambio. delete: estado pre-borrado.
  diff_json         TEXT,                         -- solo en update: campos cambiados
  usuario           TEXT     NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_just_id  ON justificaciones_audit(justificacion_id);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON justificaciones_audit(created_at);
```

### Catálogos en `backend/app/config.py`

```python
UMBRAL_BAJA_PRODUCCION = 0.5      # 50% de meta diaria → < 4 efectivas con meta 8

MOTIVOS_NO_TRABAJADO = [
    "licencia_medica", "permiso_administrativo", "feriado_interno",
    "falta_asignacion", "problema_operativo", "clima",
    "vehiculo_no_disponible", "falta_materiales", "capacitacion",
    "error_carga_datos", "otro",
]
MOTIVOS_BAJA_PRODUCCION = [
    "baja_asignacion", "alta_dispersion_geografica", "problemas_acceso",
    "cliente_ausente", "rechazo_terreno", "clima",
    "problemas_conectividad", "problemas_app", "traslados_excesivos",
    "jornada_parcial", "otro",
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

### Reglas de integridad (validadas en `service.py`, no en BD)

- `tipo_evento = 'dia_no_trabajado'` ⇒ `produccion_real == 0` y `motivo ∈ MOTIVOS_NO_TRABAJADO`.
- `tipo_evento = 'baja_produccion'` ⇒ `0 < produccion_real < (UMBRAL_BAJA_PRODUCCION × meta_diaria)` y `motivo ∈ MOTIVOS_BAJA_PRODUCCION`.
- `motivo == 'otro'` ⇒ `comentario` requerido (mín 10 chars).
- `usuario_registro` debe existir en tabla `analistas` con `activo = 1`.
- `fecha` no puede ser fin de semana ni feriado (no son días reportables; el calendario tampoco habilita el click).
- `UNIQUE(tecnico_nombre, fecha)` enforced por BD; conflicto devuelve 409 al frontend.

## Componentes

### Backend

```
backend/app/
├── config.py                              # +UMBRAL_BAJA_PRODUCCION, +MOTIVOS_*, +MOTIVOS_LABEL
├── data/
│   └── justificaciones.db                 # creado al startup, gitignored
├── services/
│   └── justificaciones/
│       ├── __init__.py
│       ├── db.py                          # conexión SQLite + DDL idempotente
│       ├── repository.py                  # CRUD puro sobre SQLite
│       ├── service.py                     # validaciones, cálculo de resumen, audit
│       └── catalogos.py                   # exposición de catálogos al frontend
└── routers/
    ├── justificaciones.py                 # endpoints REST
    └── analistas.py                       # CRUD analistas
```

**Responsabilidades:**

- `db.py`: una sola función `get_conn()` que devuelve `sqlite3.Connection` con `row_factory = sqlite3.Row`. Función `init_db()` ejecuta el DDL en startup (`app/main.py`).
- `repository.py`: funciones puras `create_justificacion`, `update_justificacion`, `delete_justificacion`, `get_justificaciones_by_persona_mes`, `get_audit_by_justificacion_id`, `create_analista`, `update_analista_activo`, `list_analistas`. Cada función abre/cierra su conexión, no comparte estado.
- `service.py`:
  - Aplica validaciones de dominio antes de llamar al repository.
  - Calcula `estado_antes` y `tipo_evento` automáticamente leyendo el día desde `detalle_tecnico.calculate_detalle_tecnico_diario` (no se confía en lo que mande el cliente).
  - Escribe la fila de audit junto con el create/update/delete (en una transacción).
  - Función `get_resumen_persona_mes(tecnico_nombre, mes)` que cruza el calendario del técnico (parquet) con las justificaciones (SQLite) y devuelve métricas derivadas.
- `catalogos.py`: expone `MOTIVOS_NO_TRABAJADO`, `MOTIVOS_BAJA_PRODUCCION`, `UMBRAL_BAJA_PRODUCCION`, `EFECTIVAS_POR_DIA` con sus labels.

### Frontend

```
frontend/src/
├── components/
│   ├── views/
│   │   ├── ControlMetas.tsx               # editar: extraer modal embebido a PersonaModal
│   │   ├── control-metas/                 # subcarpeta nueva
│   │   │   ├── PersonaModal.tsx           # modal de 2 columnas
│   │   │   ├── CalendarioMes.tsx          # calendario grande con estados + overlay
│   │   │   ├── DiaPanel.tsx               # panel derecho contextual
│   │   │   ├── JustificacionForm.tsx      # formulario crear/editar
│   │   │   ├── JustificacionFicha.tsx     # vista de lectura + historial
│   │   │   └── ResumenMes.tsx             # KPIs + estado del mes (panel default)
│   │   └── configuracion/
│   │       └── AnalistasView.tsx          # CRUD analistas
│   └── layout/
│       └── Sidebar.tsx                    # editar: agregar entrada "Configuración"
├── lib/
│   └── api/
│       ├── justificaciones.ts             # cliente HTTP tipado
│       └── analistas.ts
└── types/
    └── index.ts                           # editar: tipos Justificacion, Analista, Auditoria
```

**Refactor obligatorio en `ControlMetas.tsx`:** hoy tiene 1099 líneas mezclando tabla principal + modal embebido + lógica de cálculo. Se extrae el bloque modal (≈400 líneas) al nuevo `PersonaModal.tsx`. No es refactor cosmético: el panel contextual nuevo no cabe sano en el archivo actual.

## Layout del modal

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header: nombre · zona · estado · ← anterior siguiente → ✕           │
├──────────────────────────────────────┬──────────────────────────────┤
│                                      │                              │
│   CALENDARIO GRANDE                  │   PANEL CONTEXTUAL           │
│   (60% ancho)                        │   (40% ancho)                │
│                                      │                              │
│   - Celdas ~64×64px                  │   Estado por defecto:        │
│   - Día con número + producción      │   → 4 KPIs compactos         │
│     real + mini-barra cumplim.       │   → Desglose estado del mes  │
│   - Overlay (•) si justificado       │   → Conteo justif. vs pend.  │
│   - Hover: tooltip con detalle       │                              │
│                                      │   Día seleccionado:          │
│   Leyenda compacta debajo            │   → Resumen del día          │
│                                      │   → Formulario o ficha       │
│                                      │   → Historial colapsable     │
│                                      │                              │
├──────────────────────────────────────┴──────────────────────────────┤
│  Tabla "Detalle por día" (collapsible, default oculto)              │
└─────────────────────────────────────────────────────────────────────┘
```

### Estados visuales del calendario

| Estado | Fondo | Texto | Borde |
|---|---|---|---|
| Trabajado OK (≥4 ef) | `bg-emerald-500` | `text-white` | — |
| Baja producción (1–3 ef) | `bg-amber-200` | `text-amber-900` | `border-amber-300` |
| Sin trabajo (hábil) | `bg-red-50` | `text-red-700` | `border-red-300` |
| Justificado (overlay) | conserva color base | + `•` slate-700 esq. sup. der. | `border-dashed slate-400` |
| Feriado | `bg-blue-50` | `text-blue-600` | `border-blue-200` |
| Fin de semana | `bg-slate-100` | `text-slate-400` | — |
| Futuro | `bg-white` | `text-slate-300` | `border-slate-200` |
| Día seleccionado | + `ring-2 ring-slate-800` | (overlay del estado base) | — |

### Interacción

- Click en día hábil (pasado o futuro) → selecciona, panel derecho se actualiza.
- Click en feriado / fin de semana / futuro sin marcar → sin acción (cursor `default`).
- Día candidato a justificar (rojo o amarillo) → cursor `pointer` y `hover:scale-[1.02]`.
- Día ya justificado → click muestra ficha (no formulario).
- Navegación entre meses: fuera de Fase 1. El calendario muestra el mes del filtro global activo.

### Panel derecho — estados

**Por defecto** (sin día seleccionado): 4 KPIs (Días trabajados, Total efectivas, Ef/día, % Avance) + desglose del mes por estado con conteo y barra mini. Línea final destacada con días pendientes de justificar.

**Día seleccionado, sin justificación previa**: resumen del día (producción real, meta, % cumplimiento, estado) + formulario.

**Día seleccionado, con justificación**: resumen del día + ficha de justificación (motivo, tipo, analista, fecha registro, comentario) + botones Editar/Eliminar + historial colapsable de cambios desde `justificaciones_audit`.

### Formulario de justificación

| Campo | Comportamiento |
|---|---|
| Tipo de evento | Auto-detectado del estado del día (rojo → `dia_no_trabajado`, amarillo → `baja_produccion`). Visible, no editable. |
| Motivo | Dropdown del catálogo correspondiente. Requerido. |
| Comentario | Textarea opcional, máx 500 chars. **Obligatorio (mín 10 chars) si motivo == "otro"**. |
| Registrado por | Dropdown con `analistas` activos. Requerido. |
| Botón Guardar | Disabled hasta que motivo + analista estén seleccionados. Días futuros: el botón dice "Guardar (planificado)". |

**Confirmación de eliminación**: confirmación en línea (no modal apilado) con `[Sí, eliminar] [Cancelar]`.

## Indicadores derivados

Endpoint `/justificaciones/persona/{tecnico_nombre}/resumen?mes=YYYY-MM` cruza calendario (parquet) con justificaciones (SQLite) y devuelve:

| Métrica | Definición |
|---|---|
| `dias_no_trabajados_total` | Días hábiles sin trabajo en el mes |
| `dias_no_trabajados_justificados` | Subconjunto del anterior con justificación |
| `dias_baja_produccion_total` | Días con `0 < efectivas < 4` |
| `dias_baja_produccion_justificados` | Subconjunto justificado |
| `dias_pendientes_justificar` | Total no justificados (rojo + amarillo, no futuros) |
| `efectivas_totales` | Suma del mes |
| `efectivas_ajustadas` | `efectivas_totales / (días hábiles − días justificados como dia_no_trabajado)` |
| `cumplimiento_real` | `efectivas_totales / meta_efectivas_mes` |
| `cumplimiento_ajustado` | `efectivas_totales / (meta_diaria × días hábiles efectivos)` |

`días hábiles efectivos = días hábiles del mes − días justificados como dia_no_trabajado`.

`cumplimiento_ajustado` da la lectura honesta de productividad: si una brigada tuvo licencia 5 días en un mes de 22 hábiles, su denominador efectivo es 17 × 8 = 136 (no 22 × 8 = 176).

## API REST

Todos bajo `/api/v1/`. `Content-Type: application/json`.

### Justificaciones

```
POST   /justificaciones
  body: {
    fecha: "2026-05-07",
    tecnico_nombre: "JAIRO PEREZ",
    zona_origen: "07. RANCAGUA",
    tipo_evento: "dia_no_trabajado" | "baja_produccion",
    motivo: "licencia_medica",
    comentario: "...",
    produccion_real: 0,
    meta_diaria: 8,
    estado_antes: "sin_trabajo" | "baja_produccion",
    es_futuro: false,
    usuario_registro: "diego.bravo"
  }
  → 201 { id, ...justificacion_completa }
  → 409 { detail, id_existente }   si ya existe (tecnico, fecha)
  → 422 { detail: [{field, message}] }   si validación falla

PATCH  /justificaciones/{id}
  body: { motivo?, comentario?, usuario_registro }   # usuario_registro siempre requerido
  → 200 { ...justificacion_actualizada }
  → 404 / 422

DELETE /justificaciones/{id}?usuario_registro=diego.bravo
  → 204
  → 404

GET    /justificaciones/persona/{tecnico_nombre}?mes=2026-05
  → 200 { tecnico_nombre, mes, justificaciones: [...] }

GET    /justificaciones/persona/{tecnico_nombre}/resumen?mes=2026-05
  → 200 { ...métricas derivadas listadas arriba }

GET    /justificaciones/{id}/audit
  → 200 { justificacion_id, audit: [{accion, snapshot_json, diff_json, usuario, created_at}, ...] }

GET    /justificaciones/catalogos
  → 200 {
      motivos_no_trabajado: [{value, label}, ...],
      motivos_baja_produccion: [{value, label}, ...],
      umbral_baja_produccion: 0.5,
      meta_diaria: 8
    }
```

### Analistas

```
GET    /analistas?activos=true
  → 200 [{id, nombre, activo, created_at}, ...]

POST   /analistas
  body: { nombre: "diego.bravo" }
  → 201 { id, nombre, activo: 1, created_at }
  → 409 si nombre duplicado

PATCH  /analistas/{id}
  body: { activo: 0 | 1 }
  → 200
```

**Notas:**
- `tecnico_nombre` viaja en URL para `GET`, en body para `POST`.
- `mes` siempre `YYYY-MM`. Backend deriva primer/último día.
- En Fase 1 no hay listado global de justificaciones. Solo por técnico.
- El frontend NO confía en `tipo_evento`/`produccion_real`/`meta_diaria`/`estado_antes`/`es_futuro` enviados por el cliente: el backend los recalcula desde el dataset y la fecha antes de guardar. Si el cliente manda valores que no calzan con la realidad del día, se ignoran y se usa lo recalculado.

## Flujo de datos del modal

1. Usuario abre modal de una persona.
2. Frontend dispara en paralelo:
   - `getDetalleTecnicoDiario(nombre, null, filters)` — existente, datos del calendario base
   - `getJustificacionesPersona(nombre, mes)` — nuevo, justificaciones existentes
   - `getResumenPersona(nombre, mes)` — nuevo, métricas derivadas
3. `CalendarioMes` fusiona ambas fuentes: cada día tiene `estado_base` (verde/amarillo/rojo/etc) y `justificacion` (objeto o `null`).
4. Click en día → `setDiaSeleccionado(fecha)` → `DiaPanel` recibe el día y muestra ficha o formulario.
5. Submit del formulario → `POST /justificaciones` → al éxito: invalidate de `justificaciones` y `resumen` → calendario re-renderiza el día con overlay de justificación (mismo color base + dot slate-700 + borde dashed), panel derecho actualiza el conteo.

## Manejo de errores

- **Backend**: 422 con `{detail: [{field, message}]}` en validación; 409 con `{detail, id_existente}` en conflicto único.
- **Frontend**:
  - Toasts breves arriba a la derecha (`slate-800` background) para éxito/error generales.
  - Errores de validación se muestran inline en el campo afectado.
  - Conflicto 409 → frontend cambia automáticamente al modo "Editar" sin mostrar error.

## Testing

### Backend (TDD)

| Archivo | Cubre |
|---|---|
| `test_repository.py` | Insert, update, delete, conflict en UNIQUE, audit log se escribe en cada acción, snapshot JSON correcto |
| `test_service.py` | Validar que motivo pertenece a catálogo del tipo_evento, comentario obligatorio si motivo=="otro", rechazo de fines de semana/feriados, conflicto 409 cuando ya existe, validación de analista activo |
| `test_router.py` | Status codes, shape de respuestas, validación Pydantic, audit endpoint |
| `test_resumen.py` | Cálculo de `cumplimiento_ajustado`: sin justificaciones, con licencia, con justificación futura, con justificación eliminada |

Tests usan SQLite in-memory para velocidad. Repository acepta `Connection` inyectable para que los tests no toquen el archivo de producción.

### Frontend (smoke testing manual)

Checklist al cierre de la implementación:

- Justificar día rojo → conserva color rojo, suma overlay (• y borde dashed), contador "Sin justificar" baja en 1.
- Justificar día amarillo → idem (conserva amarillo + overlay).
- Editar justificación → audit registra UPDATE con `diff_json` correcto.
- Eliminar justificación → día vuelve al estado base, audit registra DELETE.
- Justificar día futuro → marca planificado, no afecta `cumplimiento_real`.
- Conflicto: justificar dos veces el mismo día → frontend pasa a modo edición sin error.
- Agregar/desactivar analista en Configuración → dropdown del formulario se actualiza.
- Día con motivo "otro" → comentario se vuelve obligatorio, botón Guardar disabled hasta llenarlo.

## Migraciones futuras (informativo)

- **A PostgreSQL**: cambia `INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL`, resto del DDL idéntico. `db.py` se reemplaza por SQLAlchemy.
- **A auth real**: `usuario_registro` deja de venir en body, se extrae del JWT en `Depends(get_current_user)`. Schema y endpoints quedan iguales en su contrato externo.
- **Fase 2** (vista log + mapa + KPIs avanzados): se construye sobre la misma `justificaciones.db` ya creada. Sin cambios de schema.
