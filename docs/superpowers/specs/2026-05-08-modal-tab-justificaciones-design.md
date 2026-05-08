# Modal Persona — Tab "Justificaciones" (listado + descarga CSV)

**Fecha:** 2026-05-08
**Vista:** Control de Metas → Modal de persona (`PersonaModal`)
**Estado:** Diseño aprobado, pendiente de implementación

---

## 1. Contexto y problema

El modal de persona en Control de Metas (`frontend/src/components/views/control-metas/PersonaModal.tsx`) permite hoy justificar ausencias o baja producción **un día a la vez**: el usuario hace clic sobre un día del calendario y se abre `DiaPanel` con el formulario para crear/editar/eliminar la justificación de ese día puntual.

Esto es cómodo para registrar justificaciones nuevas, pero es ineficiente cuando:

- El analista necesita una **vista panorámica** de todas las justificaciones cargadas en el mes para una persona.
- Se debe **corregir un error** en una justificación previa y el usuario no recuerda exactamente sobre qué día estaba.
- Se quiere **descargar la información** para revisarla fuera del sistema (auditoría, archivo, comparación entre meses).

La data que ingresan los analistas es **externa al sistema** (dato manual, no derivado), por lo que la corrección y el respaldo son críticos.

## 2. Objetivo

Agregar al modal de persona una nueva pestaña **"Justificaciones"** con:

1. Un **listado tabular** de todas las justificaciones del mes para la persona.
2. **Edición inline** de cada justificación reutilizando el formulario existente.
3. **Descarga CSV** con el set completo de columnas.

Mantener la pestaña "Calendario" (vista actual) intacta y como pestaña por defecto.

## 3. Alcance

### Incluido

- Barra de tabs en el modal (Calendario / Justificaciones).
- Tab "Justificaciones" con tabla, edición inline expandible, y botón de descarga CSV.
- Reutilización de `JustificacionForm` y del componente `Historial` (extraído).
- Generación CSV en frontend (sin cambios en backend).

### No incluido

- Cambios en endpoints o esquemas backend.
- Edición/descarga de la data de producción (efectivas) — solo justificaciones.
- Filtros adicionales dentro de la tab (ya está acotada al mes y persona del modal).
- Exportación en Excel (.xlsx). Si en el futuro se requiere formato, se evalúa.
- Edición masiva (bulk edit) o creación desde el listado. Crear sigue siendo desde el calendario.

## 4. Diseño

### 4.1 Layout y tabs

Se inserta una **barra de tabs** entre el header oscuro del modal y el body actual:

```
┌─────────────────────────────────────────────────┐
│ NOMBRE | ZONA | Estado    [Anterior][Sig.][x]   │  header (slate-800)
├─────────────────────────────────────────────────┤
│ [ Calendario ] [ Justificaciones ]              │  barra de tabs (NUEVA)
├─────────────────────────────────────────────────┤
│   contenido de la tab activa                    │
└─────────────────────────────────────────────────┘
```

- Estilo: texto `text-sm`, tab activa con `border-b-2 border-oca-blue text-slate-800`, inactiva `text-slate-500`. Sin íconos. Padding `px-4 py-2`. Fondo `bg-white`, borde inferior `border-b border-slate-200`.
- Estado: `useState<'calendario' | 'justificaciones'>('calendario')` en `PersonaModal`.
- Tab por defecto: **Calendario**.
- La navegación entre brigadas (botones Anterior/Siguiente) **no resetea** la tab activa — se mantiene la pestaña en la que está el usuario.

### 4.2 Tab "Calendario" (sin cambios)

Mantiene el comportamiento actual:
- Grid 60% / 40%: `CalendarioMes` + `DiaPanel`/`ResumenMes`.
- `TablaDetalleDia` debajo, full width.

### 4.3 Tab "Justificaciones": layout

```
┌─────────────────────────────────────────────────────────────┐
│ Justificaciones del mes (12)            [Descargar CSV]     │
├──────┬──────┬───────────┬──────────┬──────┬──────┬──────────┤
│Fecha │ Día  │ Tipo      │ Motivo   │ Prod │ Meta │ Acciones │
├──────┼──────┼───────────┼──────────┼──────┼──────┼──────────┤
│03-05 │ Lun  │ Sin trab. │ Permiso  │  0   │  8   │ [Editar] │
│04-05 │ Mar  │ Baja prod.│ Lluvia   │  3   │  8   │ [Editar] │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘
```

- **Encabezado de la tab**: contador de justificaciones a la izquierda (`Justificaciones del mes (N)`), botón "Descargar CSV" a la derecha. Si `N === 0`, el botón está deshabilitado.
- **Tabla**: aplica el style guide del proyecto.
  - Header: `bg-slate-50 text-[10px] uppercase text-slate-500 font-semibold`
  - Celdas: `text-[11px] text-slate-600`
  - Hover de fila: `hover:bg-slate-50/80`
  - Bordes: `border-b border-slate-100`
  - Botón "Editar": `text-xs border border-slate-300 text-slate-700 rounded px-2 py-1 hover:bg-slate-50`
- **Columnas visibles**: Fecha, Día, Tipo, Motivo, Producción, Meta, Acciones.
- **Orden**: fecha descendente (más reciente arriba).
- **Empty state**: si no hay justificaciones, mensaje `"Sin justificaciones en el mes."` centrado, en `text-slate-400 text-sm py-8 text-center`. Botón "Descargar CSV" deshabilitado (`opacity-50 cursor-not-allowed`).

### 4.4 Edición inline (fila expandida)

Click en "Editar" expande la fila in-place mostrando un panel debajo. Solo una fila puede estar expandida a la vez (clic en otro "Editar" colapsa la actual y abre la nueva).

```
│03-05 │ Lun │ Sin trab.│ Permiso │ 0 │ 8 │ [Editar]    │
├──────┴─────┴──────────┴─────────┴───┴───┴─────────────┤
│  ╭─────────────────────────────────────────────────╮  │
│  │ [JustificacionForm]                             │  │
│  │   Motivo: [dropdown]                            │  │
│  │   Comentario: [textarea]                        │  │
│  │   Analista que modifica: [dropdown]             │  │
│  │   [Guardar]  [Cancelar]                         │  │
│  ├─────────────────────────────────────────────────┤  │
│  │ [Botón Eliminar]                                │  │
│  ├─────────────────────────────────────────────────┤  │
│  │ Historial (3) ▾                                 │  │
│  │   03-05 09:15  juan_perez  CREATE               │  │
│  │   05-05 14:22  ana_lopez   UPDATE               │  │
│  │     motivo: permiso → licencia_medica           │  │
│  ╰─────────────────────────────────────────────────╯  │
├───────────────────────────────────────────────────────┤
```

- **Form**: reutiliza `JustificacionForm` con `initial={justificacion}`. Mismo flujo que en `DiaPanel` modo `'editar'`.
- **Eliminar**: botón con confirmación + selector de analista (mismo flujo que `JustificacionFicha` actualmente).
- **Historial**: reutiliza el componente que hoy está embebido dentro de `JustificacionFicha.tsx`, extraído a archivo propio (ver sección 5).
- **Después de guardar/eliminar**:
  - Se cierra el panel expandido (`setFilaExpandida(null)`).
  - Se llaman a `getJustificacionesPersona` y `getResumenPersona` (vía `refetchJustificaciones` que ya existe en `PersonaModal`).
  - Si la justificación se eliminó, simplemente desaparece de la tabla.
- **Errores de API**: si falla el guardado/eliminación, se muestra el error en un `<p className="text-xs text-red-600">` dentro del panel expandido y el panel queda abierto.

### 4.5 Descarga CSV

Generación 100% en frontend, sin endpoint backend.

**Función pura `justificacionesToCsv(justificaciones, motivosLabel): Blob`**

Pasos:
1. Construye filas con las 10 columnas:
   - Fecha (`DD-MM-YYYY`)
   - Día semana (`Lun`, `Mar`, ...)
   - Tipo evento (`"Día no trabajado"` / `"Baja producción"`)
   - Motivo (resuelto a label legible vía `motivosLabel[code] ?? code`)
   - Producción real (numérico)
   - Meta diaria (numérico)
   - Comentario (string, puede ser vacío)
   - Registrado por (string)
   - Fecha registro (`DD-MM-YYYY HH:mm`)
   - Última modificación (`DD-MM-YYYY HH:mm`, vacío si igual a fecha registro)
2. Escapa cada celda según RFC 4180:
   - Si la celda contiene `,`, `"` o salto de línea, se envuelve en `"..."`.
   - Las comillas dobles internas se duplican (`"` → `""`).
3. Antepone **BOM UTF-8** (`﻿`) para que Excel abra correctamente acentos y "ñ".
4. Une filas con `\r\n` (estándar CSV).
5. Devuelve `new Blob([bom + contenido], { type: 'text/csv;charset=utf-8;' })`.

**Helper `descargarBlob(blob, filename): void`**

```ts
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = filename;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
```

**Nombre de archivo**

`justificaciones_<NOMBRE_NORMALIZADO>_<YYYY-MM>.csv`

Donde `NOMBRE_NORMALIZADO` se obtiene con:
```ts
nombre
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quita tildes
  .replace(/[^a-z0-9]+/g, '_')                        // espacios y especiales → _
  .replace(/^_+|_+$/g, '');                           // trim _
```

Ejemplo: `"Juan Pérez García"` + `"2026-05"` → `justificaciones_juan_perez_garcia_2026-05.csv`

**Separador**: coma (`,`). Si en el futuro hay problemas con Excel localizado en español que espera `;`, se evalúa.

## 5. Estructura de archivos

### Archivos nuevos

```
frontend/src/components/views/control-metas/
├── ListadoJustificaciones.tsx      ← contenedor de la tab "Justificaciones"
├── FilaJustificacion.tsx           ← fila con expansión inline
└── HistorialJustificacion.tsx      ← extraído de JustificacionFicha.tsx

frontend/src/lib/export/
└── justificaciones-csv.ts          ← justificacionesToCsv() + descargarBlob()
```

### Archivos modificados

**`frontend/src/components/views/control-metas/PersonaModal.tsx`**
- Estado nuevo: `const [tabActiva, setTabActiva] = useState<'calendario' | 'justificaciones'>('calendario');`
- Renderiza barra de tabs entre header y body.
- Body actual queda dentro de `tabActiva === 'calendario' && (...)`.
- Renderiza `<ListadoJustificaciones />` cuando `tabActiva === 'justificaciones'`.

**`frontend/src/components/views/control-metas/JustificacionFicha.tsx`**
- Quita el componente local `Historial`.
- Importa `HistorialJustificacion` desde la nueva ruta.
- Sin cambios funcionales.

### Responsabilidades por componente

- **`ListadoJustificaciones`**
  - Props: `justificaciones`, `mes`, `tecnicoNombre`, `catalogos`, `analistas`, `motivosLabel`, `onCambioJustificacion`.
  - Ordena por `fecha` desc.
  - Renderiza header (contador + botón CSV), tabla, empty state.
  - Maneja `filaExpandidaId: number | null`.
  - Llama a `justificacionesToCsv` + `descargarBlob` al click del botón.

- **`FilaJustificacion`**
  - Props: `justificacion`, `expandida`, `catalogos`, `analistas`, `motivosLabel`, `tecnicoNombre`, `zonaOrigen`, `onToggle`, `onCambio`.
  - Dos estados visuales: colapsada (datos + "Editar") y expandida (datos + `JustificacionForm` + botón eliminar + `HistorialJustificacion`).
  - Llama a `updateJustificacion` y `deleteJustificacion` directamente (mismo patrón que `DiaPanel`).

- **`HistorialJustificacion`**
  - Idéntico en API y comportamiento al `Historial` interno actual.
  - Props: `justificacionId: number`.
  - Auto-fetch al expandir, igual que hoy.

- **`justificaciones-csv.ts`**
  - Sin React. Dos funciones puras + helpers de formato (`formatFechaDDMMYYYY`, `formatFechaHora`, `escaparCelda`, `normalizarNombre`).
  - Fácilmente testeable.

## 6. Flujo de datos

```
PersonaModal
  ├─ getJustificacionesPersona() → justificaciones (state)
  ├─ getCatalogos() → catalogos (state)
  ├─ listAnalistas() → analistas (state)
  └─ refetchJustificaciones() → reload todo
      ↓
      ListadoJustificaciones (recibe todo por props)
        ↓
        FilaJustificacion (por cada justificación)
          ├─ updateJustificacion() → PATCH
          ├─ deleteJustificacion() → DELETE
          ├─ onCambio() → llama onCambioJustificacion (que es refetchJustificaciones)
          └─ HistorialJustificacion → getAudit() (lazy, al expandir)
```

No hay nuevos estados globales. La fuente de verdad sigue siendo `PersonaModal`. El listado es una **vista derivada** del mismo array `justificaciones` que ya alimenta el calendario.

## 7. Sin cambios backend

Se usan endpoints ya existentes:
- `GET  /api/v1/justificaciones/persona/{nombre}?mes=YYYY-MM`
- `PATCH /api/v1/justificaciones/{id}`
- `DELETE /api/v1/justificaciones/{id}?usuario_registro=...`
- `GET  /api/v1/justificaciones/{id}/audit`

## 8. Pruebas y verificación

### Manual (browser)

- [ ] Abrir el modal de un técnico con justificaciones cargadas → tab Calendario carga como antes.
- [ ] Cambiar a tab Justificaciones → la tabla muestra todas las justificaciones del mes ordenadas por fecha desc.
- [ ] Click en "Editar" → fila se expande con el form precargado.
- [ ] Modificar motivo y guardar → fila colapsa, tabla refresca, calendario en otra tab también queda actualizado.
- [ ] Eliminar una justificación → desaparece de la tabla; en el calendario el día vuelve a estado sin justificar.
- [ ] Click en "Descargar CSV" → se descarga archivo con nombre correcto, abre bien en Excel con tildes/ñ.
- [ ] Técnico sin justificaciones → empty state visible, botón CSV deshabilitado.
- [ ] Navegación entre brigadas (Anterior/Siguiente) no rompe el tab activo.
- [ ] Valores con coma, comillas o saltos de línea en el comentario → CSV se escapa correctamente.

### Estructural

- [ ] No hay duplicación de `Historial` (existe solo en `HistorialJustificacion.tsx`).
- [ ] `JustificacionFicha` sigue funcionando idéntico a antes.
- [ ] El style guide se respeta (no emojis, no íconos decorativos, paleta correcta).

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Excel localizado en español interpreta mal el CSV con coma como separador. | BOM UTF-8 y comillas para celdas con coma. Si aparece, se cambia a `;`. |
| Nombres con caracteres no-ASCII en filename rompen en algunos sistemas. | `normalizarNombre()` quita tildes y especiales. |
| Refresco innecesario después de cada edit. | Reutilizamos `refetchJustificaciones` que ya existe — no agregamos nuevos fetchers. |
| Tabla muy ancha en móvil. | El modal ya es `max-w-6xl` y la tabla con `overflow-x-auto` en su contenedor. Acotamos columnas visibles a 7. |

## 10. Decisiones cerradas

- **Tab por defecto**: Calendario.
- **Edición**: inline expandida en la fila (no modal anidado, no drawer).
- **Crear**: sigue siendo solo desde el calendario. El listado es para revisar/corregir/descargar.
- **Formato descarga**: CSV (UTF-8 + BOM, separador coma).
- **Backend**: sin cambios.
