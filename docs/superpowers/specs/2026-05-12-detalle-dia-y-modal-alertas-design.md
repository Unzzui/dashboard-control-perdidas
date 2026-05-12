# Detalle de inspecciones por día y reuso de PersonaModal en Alertas Operativas

**Fecha:** 2026-05-12
**Estado:** Diseño aprobado, pendiente plan de implementación

## Contexto

Hoy en `Alertas Operativas` el `Calendario Operativo de Brigadas` (matriz brigada × días) es solo lectura: hacer click en una brigada no hace nada.

En `Control Metas` ya existe el `PersonaModal` (`frontend/src/components/views/control-metas/PersonaModal.tsx`) que muestra calendario mensual, panel de justificaciones (`DiaPanel`), resumen del mes (`ResumenMes`) y tabla agregada por día (`TablaDetalleDia`). Pero al seleccionar un día solo se ve el agregado (efectivas, normal, CNR, kWh, etc.) — no la lista de inspecciones individuales con su `Resultado visita` (Completo / CNR / Visita fallida), `Aviso`, `Comuna`, `Dirección`, etc.

Esa lista ya existe en otro modal del proyecto: `InspeccionesDiaModalView` (dentro de `frontend/src/components/ui/DetalleTecnicoDiarioModal.tsx`, línea 386), consumiendo el endpoint `getInspeccionesDia(nombre, zona, fecha, filters)` que devuelve `InspeccionesDia`. Hoy se usa desde `ControlDiario`.

## Objetivo

1. **Click en brigada del calendario de Alertas Operativas → abrir `PersonaModal` (el mismo de Control Metas).**
2. **Dentro de `PersonaModal`, al seleccionar un día (sea desde la tabla `TablaDetalleDia` o desde el calendario mensual) → abrir un sub-modal con la lista de inspecciones individuales del día.**

## No-objetivos

- No modificar el comportamiento de `ControlDiario`.
- `DetalleTecnicoDiarioModal` recibe solo un refactor mecánico (extraer el sub-componente `InspeccionesDiaModalView`), sin cambios funcionales.
- No cambiar la firma pública de `PersonaModal` (sigue siendo drop-in para Control Metas).
- No implementar la pestaña "Justificaciones" del modal (cubierta por la spec `2026-05-08-modal-tab-justificaciones-design.md`).

## Diseño

### Componentes nuevos

#### `buildBrigadaSeleccionada` (helper puro)

**Archivo:** `frontend/src/components/views/control-metas/buildBrigadaSeleccionada.ts`

Función pura:

```ts
function buildBrigadaSeleccionada(
  tecnico: Tecnico,
  metaEfectivasMes: number,
  diasRestantes: number,
): BrigadaSeleccionada
```

Encapsula el cálculo que hoy vive inline en `ControlMetas.tsx` líneas 71-110:

- Detecta si trabaja en múltiples zonas (`tecnico.cantidad_zonas > 1`).
- Si sí, usa totales globales (`efectivas_global`, `promedio_efectivas_global`, `dias_global`).
- Calcula `proyeccion = efectivasTotal + efectivasDia * diasRestantes`.
- Calcula `pctAvance = min(100, efectivasTotal / metaEfectivasMes * 100)`.
- Calcula `estado`:
  - `cumplida` si `efectivasTotal >= metaEfectivasMes`.
  - `en_camino` si `diasRestantes > 0 && proyeccion >= metaEfectivasMes`.
  - `no_alcanzara` en otro caso.

#### `calcularDiasRestantes` (helper puro)

**Archivo:** `frontend/src/components/views/control-metas/calcularDiasRestantes.ts`

Extraído del `useMemo` actual en `ControlMetas.tsx` (líneas 44-68). Recibe `calendarioMes: CalendarioMes | null` y devuelve `number` (días hábiles restantes del mes excluyendo sábados, domingos y feriados, contando desde mañana si es mes actual, 0 si es mes pasado, todos si es mes futuro).

#### `InspeccionesDiaModal` (extracción)

**Archivo:** `frontend/src/components/ui/InspeccionesDiaModal.tsx`

Mover el componente `InspeccionesDiaModalView` desde `DetalleTecnicoDiarioModal.tsx` (línea 386) a este archivo, exportado como default. Props sin cambios:

```ts
interface Props {
  inspecciones: InspeccionesDia;
  cargando: boolean;
  onClose: () => void;
}
```

`DetalleTecnicoDiarioModal.tsx` lo importa para mantener su funcionalidad actual. Mantiene `z-[60]` (sobre el modal principal `z-50`).

### Cambios en archivos existentes

#### `ControlMetas.tsx`

- Reemplazar el cálculo inline de `BrigadaMeta` (líneas 71-110) por una llamada a `buildBrigadaSeleccionada(tecnico, metaEfectivasMes, diasRestantes)` extendida con los campos adicionales de `BrigadaMeta` (`faltanParaMeta`, `cnrDia`, `efectivasGlobal`, `efectivasDiaGlobal`, `diasGlobal`, `cumpleMetaGlobal`).
- Reemplazar el `useMemo` de `diasRestantes` (líneas 44-68) por `useMemo(() => calcularDiasRestantes(calendarioMes), [calendarioMes])`.
- Sin cambios visibles en comportamiento.

#### `page.tsx`

Línea 81-86: agregar `tecnicos={data.tecnicos}` a `<AlertasOperativas>`:

```tsx
<AlertasOperativas
  filters={filters}
  pagoTecnicos={data.pago_tecnicos}
  calendarioMes={data.calendario_mes}
  tecnicos={data.tecnicos}
/>
```

#### `AlertasOperativas.tsx`

- Nueva prop opcional `tecnicos?: Tecnico[]` en `AlertasOperativasProps`.
- Nuevo estado: `const [brigadaSeleccionada, setBrigadaSeleccionada] = useState<BrigadaSeleccionada | null>(null);`
- `metaEfectivasMes = calendarioMes?.meta_efectivas ?? META_EFECTIVAS_FALLBACK`. La constante hoy es local en `ControlMetas.tsx` (línea 16, valor `160`); exportarla desde ahí (named export) y reusarla en `AlertasOperativas`. No introducir un módulo nuevo solo para esto.
- `diasRestantes = useMemo(() => calcularDiasRestantes(calendarioMes), [calendarioMes])`.
- `todasLasBrigadas: BrigadaSeleccionada[]`: construir mapeando `tecnicos` con `buildBrigadaSeleccionada`, ordenando por zona alfabética y, dentro de cada zona, por `dias_trabajados_count` descendente — mismo orden visual del calendario en `CalendarioBrigadas`. Así Anterior/Siguiente recorre las brigadas en el orden que el usuario ve.
- Handler para click en brigada:
  ```ts
  const abrirModalBrigada = (nombre: string, zona: string) => {
    if (!tecnicos) return;
    const t = tecnicos.find(x => x.nombre === nombre && x.zona === zona);
    if (!t) return;
    setBrigadaSeleccionada(buildBrigadaSeleccionada(t, metaEfectivasMes, diasRestantes));
  };
  ```
- Pasar `onSeleccionarBrigada={abrirModalBrigada}` a `<CalendarioBrigadas>`.
- Función `navegarTrabajador` (igual a la de `ControlMetas`): mueve `brigadaSeleccionada` al anterior/siguiente en `todasLasBrigadas`.
- Renderizar `<PersonaModal>` al final del JSX igual que en `ControlMetas` cuando `brigadaSeleccionada` no es null.

#### `CalendarioBrigadas.tsx`

- Nueva prop opcional en `CalendarioBrigadasProps`:
  ```ts
  onSeleccionarBrigada?: (nombre: string, zona: string) => void;
  ```
- En la celda del nombre de brigada (líneas 301-306), si `onSeleccionarBrigada` está definido:
  - Añadir `onClick={() => onSeleccionarBrigada(t.nombre, t.zona)}`.
  - Estilos: `cursor-pointer hover:bg-slate-50` (en lugar del `hover:bg-slate-50/50` de la fila completa hay que mantener consistencia — añadir solo `cursor-pointer` y un `hover:text-oca-blue` sutil en el `<td>` del nombre).
  - El click es **solo en la celda del nombre** (la primera columna), no en toda la fila — para no interferir con el scroll de la matriz ni con el `title` de cada celda de día.
- Sin la prop, la celda mantiene el comportamiento read-only actual.

#### `PersonaModal.tsx`

- Nuevos estados:
  ```ts
  const [inspeccionesDia, setInspeccionesDia] = useState<InspeccionesDia | null>(null);
  const [cargandoInspecciones, setCargandoInspecciones] = useState(false);
  ```
- Importar `getInspeccionesDia` desde `@/lib/api` e `InspeccionesDiaModal` desde `@/components/ui/InspeccionesDiaModal`.
- Nueva función:
  ```ts
  const cargarInspeccionesDia = useCallback(async (fecha: string) => {
    setCargandoInspecciones(true);
    setInspeccionesDia({
      nombre: brigada.nombre, zona: brigada.zona, fecha,
      total_inspecciones: 0, efectivas: 0, cnr: 0, normal: 0,
      mantenimiento: 0, vf_cge_pagable: 0, vf_no_efectiva: 0,
      inspecciones: [],
    });
    try {
      const data = await getInspeccionesDia(brigada.nombre, brigada.zona, fecha, filters);
      setInspeccionesDia(data);
    } catch {
      setInspeccionesDia(null);
    } finally {
      setCargandoInspecciones(false);
    }
  }, [brigada.nombre, brigada.zona, filters]);
  ```
- Wrapper para el click en día (calendario o tabla):
  ```ts
  const handleSeleccionarDia = useCallback((fecha: string) => {
    setDiaSeleccionado(fecha);
    // Solo cargar inspecciones si el día tiene trabajo registrado
    const c = detalle?.calendario.find(x => x.fecha === fecha);
    if (c?.trabajo) cargarInspeccionesDia(fecha);
  }, [detalle, cargarInspeccionesDia]);
  ```
- Pasar `handleSeleccionarDia` (en lugar de `setDiaSeleccionado`) tanto a `CalendarioMes` como a `TablaDetalleDia`.
- Renderizar el sub-modal al final, fuera del modal principal:
  ```tsx
  {inspeccionesDia && (
    <InspeccionesDiaModal
      inspecciones={inspeccionesDia}
      cargando={cargandoInspecciones}
      onClose={() => setInspeccionesDia(null)}
    />
  )}
  ```

#### `DetalleTecnicoDiarioModal.tsx`

- Eliminar la definición local de `InspeccionesDiaModalView` (línea 386 hasta el final del componente).
- Importar el componente desde `./InspeccionesDiaModal` y usarlo donde hoy se usa la definición local.

## Flujo de datos

### Click en brigada (Alertas Operativas)

1. Usuario hace click en celda de nombre de brigada en `CalendarioBrigadas`.
2. `CalendarioBrigadas` invoca `onSeleccionarBrigada(nombre, zona)`.
3. `AlertasOperativas.abrirModalBrigada` busca el `Tecnico` en `tecnicos`, lo convierte con `buildBrigadaSeleccionada` y setea `brigadaSeleccionada`.
4. `<PersonaModal>` se monta. Hace su carga normal (`getDetalleTecnicoDiario`, `getCatalogos`, `listAnalistas`, `getJustificacionesPersona`, `getResumenPersona`).

### Click en día (dentro del PersonaModal)

1. Usuario hace click en una fila de `TablaDetalleDia` o en una celda del calendario `CalendarioMes`.
2. Se invoca `handleSeleccionarDia(fecha)`.
3. Se actualiza `diaSeleccionado` (el `DiaPanel` derecho muestra justificación/info del día).
4. Si el día tiene `trabajo === true` en `detalle.calendario`, se llama a `cargarInspeccionesDia(fecha)`:
   - Se setea `inspeccionesDia` con un objeto placeholder (totales en 0, lista vacía) para abrir el modal en estado "Cargando".
   - Se llama a `getInspeccionesDia(brigada.nombre, brigada.zona, fecha, filters)`.
   - Al responder, se actualiza `inspeccionesDia` con los datos reales.
5. `<InspeccionesDiaModal>` se monta sobre el modal principal (z-[60]) con la lista.
6. Cerrar el sub-modal (click backdrop o "x") setea `inspeccionesDia = null`. El modal principal sigue visible y `diaSeleccionado` se mantiene.

## Edge cases

- **`tecnicos` no llega a `AlertasOperativas`:** las brigadas no son clickeables (no se pasa `onSeleccionarBrigada` a `CalendarioBrigadas`). Sin regresión.
- **Brigada no encontrada en `tecnicos`** (mismatch entre `pago_tecnicos` y `tecnicos`): el click silenciosamente no abre nada.
- **Día sin trabajo registrado** (sin_trabajo, fin de semana, feriado, futuro): no se carga el sub-modal de inspecciones. Solo se selecciona el día en el calendario (DiaPanel muestra justificación si aplica).
- **Día con trabajo pero respuesta API vacía** (`inspecciones.length === 0`): el sub-modal muestra el mensaje "No hay inspecciones para este día" (ya implementado).
- **Error del API al cargar inspecciones:** `setInspeccionesDia(null)` cierra el sub-modal sin alerta. Es consistente con `ControlDiario` actual.
- **Técnico multi-zona con `brigada.zona = 'TODAS'` (consolidado):** `getInspeccionesDia` ya soporta este caso; `InspeccionesDiaModal` muestra columna "Zona" en cada inspección.
- **Navegación Anterior/Siguiente** en `PersonaModal`: al cambiar de brigada, el sub-modal de inspecciones se debe cerrar — el `useEffect` existente (PersonaModal.tsx líneas 89-92) ya resetea `diaSeleccionado` al cambiar `brigada.nombre`; añadir también `setInspeccionesDia(null)` ahí.

## Testing manual

- En `Alertas Operativas`, click en una brigada del calendario abre `PersonaModal` con datos correctos.
- Anterior/Siguiente navegan por brigadas (orden = orden de zonas/brigadas en el calendario).
- En `Control Metas`, todo sigue funcionando igual (regresión cero).
- Dentro del modal: click en fila de tabla "Detalle por día" → sub-modal con inspecciones del día.
- Click en celda del calendario mensual de un día trabajado → mismo sub-modal.
- Click en día sin trabajo (futuro/feriado/fin de semana/sin_trabajo) → solo selecciona, no abre sub-modal.
- Cerrar sub-modal preserva el día seleccionado en el modal principal.
- En `Control Diario`, el modal de inspecciones sigue funcionando (no se rompió la extracción).

## Riesgos

- **Bajo:** la extracción del helper `buildBrigadaSeleccionada` debe preservar exactamente el comportamiento actual. Mitigación: el helper se prueba primero en `ControlMetas` (regresión visible inmediata si algo cambia).
- **Bajo:** la extracción de `InspeccionesDiaModalView` cambia la ubicación física pero no el comportamiento. Mitigación: probar `ControlDiario` antes de pasar a `PersonaModal`.

## Orden sugerido de implementación

1. Crear `calcularDiasRestantes.ts` y `buildBrigadaSeleccionada.ts`. Refactor `ControlMetas` para usarlos. Verificar regresión cero en Control Metas.
2. Extraer `InspeccionesDiaModal.tsx` desde `DetalleTecnicoDiarioModal.tsx`. Verificar regresión cero en Control Diario.
3. Añadir sub-modal de inspecciones a `PersonaModal` (click en día). Verificar en Control Metas.
4. Hacer brigadas clickeables en `CalendarioBrigadas` (prop opcional). Conectar desde `AlertasOperativas`. Pasar `tecnicos` desde `page.tsx`. Verificar Alertas Operativas.
