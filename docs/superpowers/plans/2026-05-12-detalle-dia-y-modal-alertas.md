# Detalle de inspecciones por día y reuso de PersonaModal en Alertas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reusar `PersonaModal` cuando se hace click en una brigada del Calendario Operativo de Alertas Operativas; dentro del modal, al seleccionar un día (calendario o tabla) abrir un sub-modal con la lista de inspecciones individuales del día.

**Architecture:** Refactor mínimo que extrae dos piezas reutilizables: (1) la lógica que arma `BrigadaSeleccionada` desde un `TecnicoRanking` (hoy inline en `ControlMetas.tsx`), y (2) el sub-componente `InspeccionesDiaModalView` (hoy embebido en `DetalleTecnicoDiarioModal.tsx`). Luego conecta esas piezas en `AlertasOperativas` y `PersonaModal` sin tocar la firma pública de los componentes existentes.

**Tech Stack:** React 18 + TypeScript + Next.js 14 (app router) + TailwindCSS. Backend Flask (no se toca). Estado local React (`useState`/`useMemo`/`useCallback`), sin librerías nuevas.

**Referencia:** `docs/superpowers/specs/2026-05-12-detalle-dia-y-modal-alertas-design.md`

---

## File Structure

**Crear:**
- `frontend/src/components/views/control-metas/calcularDiasRestantes.ts` — helper puro, calcula días hábiles restantes del mes.
- `frontend/src/components/views/control-metas/buildBrigadaSeleccionada.ts` — helper puro, convierte `TecnicoRanking` → `BrigadaSeleccionada` (y `BrigadaMeta`).
- `frontend/src/components/ui/InspeccionesDiaModal.tsx` — modal reutilizable de inspecciones por día (extraído).

**Modificar:**
- `frontend/src/components/views/ControlMetas.tsx` — usar los helpers; exportar `META_EFECTIVAS_FALLBACK`.
- `frontend/src/components/ui/DetalleTecnicoDiarioModal.tsx` — importar `InspeccionesDiaModal` y eliminar la definición local.
- `frontend/src/components/views/control-metas/PersonaModal.tsx` — sub-modal de inspecciones al seleccionar día.
- `frontend/src/components/views/CalendarioBrigadas.tsx` — prop `onSeleccionarBrigada` opcional; celda de nombre clickeable.
- `frontend/src/components/views/AlertasOperativas.tsx` — recibir `tecnicos`, gestionar estado de brigada seleccionada, montar `PersonaModal`.
- `frontend/src/app/page.tsx` — pasar `tecnicos={data.tecnicos}` a `AlertasOperativas`.

---

## Convención de tests

El proyecto **no tiene framework de tests para React** (no hay `jest`, `vitest` ni similares en `frontend/package.json`). El proceso de verificación se basa en:

1. **TypeScript build:** `cd frontend && npx tsc --noEmit` debe pasar sin errores.
2. **Runtime manual:** `cd frontend && npm run dev` y probar en `http://localhost:3000`.

Cada tarea define los pasos manuales concretos a ejecutar después de la implementación. Si en algún momento se introducen tests unitarios (vitest), los helpers puros (`calcularDiasRestantes`, `buildBrigadaSeleccionada`) son los candidatos naturales — están pensados para ser testeables.

---

## Task 1: Extraer `calcularDiasRestantes` a helper puro

**Files:**
- Create: `frontend/src/components/views/control-metas/calcularDiasRestantes.ts`
- Modify: `frontend/src/components/views/ControlMetas.tsx` (líneas 3-4 imports, líneas 44-68 useMemo)

- [ ] **Step 1: Crear el helper puro**

Archivo nuevo `frontend/src/components/views/control-metas/calcularDiasRestantes.ts`:

```ts
import { CalendarioMes } from '@/types';

/**
 * Días hábiles restantes contados sobre el calendario real (excluye sáb/dom/feriados CL).
 * - Mes pasado → 0.
 * - Mes actual → desde mañana hasta fin de mes, sin sáb/dom/feriados.
 * - Mes futuro → todos los hábiles del mes.
 */
export function calcularDiasRestantes(calendarioMes: CalendarioMes | null | undefined): number {
  if (!calendarioMes) return 0;
  const hoy = new Date();
  const esMesActualCal =
    calendarioMes.año === hoy.getFullYear() &&
    calendarioMes.numero_mes === hoy.getMonth() + 1;
  const esMesPasado =
    calendarioMes.año < hoy.getFullYear() ||
    (calendarioMes.año === hoy.getFullYear() && calendarioMes.numero_mes < hoy.getMonth() + 1);

  if (esMesPasado) return 0;

  const sabados = new Set(calendarioMes.sabados);
  const domingos = new Set(calendarioMes.domingos);
  const feriados = new Set(calendarioMes.feriados);
  const desde = esMesActualCal ? hoy.getDate() + 1 : 1;

  let restantes = 0;
  for (let d = desde; d <= calendarioMes.dias_en_mes; d++) {
    if (!sabados.has(d) && !domingos.has(d) && !feriados.has(d)) {
      restantes += 1;
    }
  }
  return restantes;
}
```

- [ ] **Step 2: Refactor `ControlMetas.tsx` para usar el helper**

En `frontend/src/components/views/ControlMetas.tsx`:

Agregar el import (después de la línea 5):

```ts
import { calcularDiasRestantes } from './control-metas/calcularDiasRestantes';
```

Reemplazar el bloque de líneas 43-68 (el `useMemo` de `diasRestantes`) por:

```ts
  const diasRestantes = useMemo(() => calcularDiasRestantes(calendarioMes), [calendarioMes]);
```

- [ ] **Step 3: Verificar TypeScript build**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit code 0, sin errores.

- [ ] **Step 4: Verificación runtime manual**

```bash
cd frontend && npm run dev
```

Abrir `http://localhost:3000`, ir a tab **Control Metas**. Verificar:
- KPI "Faltan X días hábiles" (si lo muestra) es coherente con el mes mostrado.
- Click en una brigada abre `PersonaModal` y `Proyección` se ve igual que antes del cambio.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/views/control-metas/calcularDiasRestantes.ts frontend/src/components/views/ControlMetas.tsx
git commit -m "refactor(control-metas): extraer calcularDiasRestantes a helper puro"
```

---

## Task 2: Extraer `buildBrigadaSeleccionada` a helper puro

**Files:**
- Create: `frontend/src/components/views/control-metas/buildBrigadaSeleccionada.ts`
- Modify: `frontend/src/components/views/ControlMetas.tsx` (líneas 14-16, 22-30, 75-115)

- [ ] **Step 1: Crear el helper**

Archivo nuevo `frontend/src/components/views/control-metas/buildBrigadaSeleccionada.ts`:

```ts
import { TecnicoRanking } from '@/types';
import { BrigadaSeleccionada } from './PersonaModal';

export type EstadoMeta = 'cumplida' | 'en_camino' | 'no_alcanzara';

/**
 * Extensión de BrigadaSeleccionada con campos que solo ControlMetas necesita
 * (ranking, faltan, globales). Está en este módulo para que ambos consumidores
 * (ControlMetas y otros futuros) puedan reusarlo.
 */
export interface BrigadaMeta extends BrigadaSeleccionada {
  faltanParaMeta: number;
  cnrDia: number;
  efectivasGlobal: number;
  efectivasDiaGlobal: number;
  diasGlobal: number;
  cumpleMetaGlobal: boolean;
}

/**
 * Convierte un TecnicoRanking en BrigadaMeta calculando estado de meta,
 * proyección, % avance y faltantes.
 *
 * Para técnicos multi-zona usa los totales globales (la meta es global, no por zona).
 */
export function buildBrigadaSeleccionada(
  t: TecnicoRanking,
  metaEfectivasMes: number,
  diasRestantes: number,
): BrigadaMeta {
  const trabajaEnMultiplesZonas = t.cantidad_zonas > 1;

  const efectivasTotal = trabajaEnMultiplesZonas ? t.efectivas_global : t.efectivas;
  const efectivasDia = trabajaEnMultiplesZonas ? t.promedio_efectivas_global : t.promedio_efectivas;
  const diasTrabajados = trabajaEnMultiplesZonas ? t.dias_global : (t.dias_trabajados || 1);

  const proyeccion = Math.round(efectivasTotal + (efectivasDia * diasRestantes));
  const faltanParaMeta = Math.max(0, metaEfectivasMes - efectivasTotal);
  const pctAvance = Math.min(100, (efectivasTotal / metaEfectivasMes) * 100);

  let estado: EstadoMeta;
  if (efectivasTotal >= metaEfectivasMes) {
    estado = 'cumplida';
  } else if (diasRestantes > 0 && proyeccion >= metaEfectivasMes) {
    estado = 'en_camino';
  } else {
    estado = 'no_alcanzara';
  }

  return {
    nombre: t.nombre,
    zona: t.zona,
    diasTrabajados,
    efectivasTotal,
    efectivasDia,
    proyeccion,
    faltanParaMeta,
    estado,
    cnrDia: t.promedio_cnr,
    pctAvance,
    kwhRecuperado: trabajaEnMultiplesZonas ? t.kwh_global : t.kwh_recuperado,
    trabajaEnMultiplesZonas,
    efectivasGlobal: t.efectivas_global,
    efectivasDiaGlobal: t.promedio_efectivas_global,
    diasGlobal: t.dias_global,
    cumpleMetaGlobal: t.cumple_meta_global,
  };
}
```

- [ ] **Step 2: Refactor `ControlMetas.tsx`**

En `frontend/src/components/views/ControlMetas.tsx`:

Agregar el import (después de la línea de `calcularDiasRestantes`):

```ts
import { buildBrigadaSeleccionada, BrigadaMeta, EstadoMeta } from './control-metas/buildBrigadaSeleccionada';
```

Exportar `META_EFECTIVAS_FALLBACK` añadiendo la palabra `export` en la línea 16:

```ts
// Antes:
const META_EFECTIVAS_FALLBACK = 160;
// Después:
export const META_EFECTIVAS_FALLBACK = 160;
```

Eliminar la definición local de `type EstadoMeta` (línea 19) y de `interface BrigadaMeta` (líneas 22-30) — ahora vienen del helper.

Reemplazar el cuerpo del `tecnicos.forEach(t => { ... })` (líneas 75-115) por:

```ts
    tecnicos.forEach(t => {
      const brigada = buildBrigadaSeleccionada(t, metaEfectivasMes, diasRestantes);

      if (!porZona[t.zona]) {
        porZona[t.zona] = [];
        zonasStats[t.zona] = { total: 0, cumpliran: 0, noAlcanzara: 0, pctAvancePromedio: 0 };
      }

      porZona[t.zona].push(brigada);
      zonasStats[t.zona].total++;
      if (brigada.estado === 'cumplida' || brigada.estado === 'en_camino') zonasStats[t.zona].cumpliran++;
      if (brigada.estado === 'no_alcanzara') zonasStats[t.zona].noAlcanzara++;
    });
```

- [ ] **Step 3: Verificar TypeScript build**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit code 0, sin errores.

- [ ] **Step 4: Verificación runtime manual**

`npm run dev`, ir a **Control Metas**:
- Que los grupos por zona se vean igual.
- Que los KPIs "Cumplidas / En camino / No alcanzará" tengan los mismos números que antes del refactor.
- Click en brigada → modal con `Proyección`, `pctAvance`, `Estado` correctos.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/views/control-metas/buildBrigadaSeleccionada.ts frontend/src/components/views/ControlMetas.tsx
git commit -m "refactor(control-metas): extraer buildBrigadaSeleccionada a helper puro"
```

---

## Task 3: Extraer `InspeccionesDiaModal` a archivo propio

**Files:**
- Create: `frontend/src/components/ui/InspeccionesDiaModal.tsx`
- Modify: `frontend/src/components/ui/DetalleTecnicoDiarioModal.tsx`

- [ ] **Step 1: Crear el nuevo archivo con el componente extraído**

Archivo nuevo `frontend/src/components/ui/InspeccionesDiaModal.tsx`:

```tsx
'use client';

import { InspeccionesDia } from '@/types';

interface Props {
  inspecciones: InspeccionesDia;
  cargando: boolean;
  onClose: () => void;
}

export default function InspeccionesDiaModal({
  inspecciones,
  cargando,
  onClose,
}: Props) {
  const [year, month, day] = inspecciones.fecha.split('-');
  const fechaFormateada = `${day}-${month}-${year}`;
  const isConsolidado = inspecciones.zona === 'TODAS';

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-800 text-white px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 min-w-0">
              <span className="font-semibold truncate">{inspecciones.nombre}</span>
              <span className="text-xs text-slate-300 truncate">{inspecciones.zona}</span>
              <span className="text-xs text-slate-300">{fechaFormateada}</span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-xs">
            <Metric label="Total" value={inspecciones.total_inspecciones} />
            <Metric label="Efectivas" value={inspecciones.efectivas} tone="green-strong" />
            <Metric label="Normal" value={inspecciones.normal} />
            <Metric label="Mant" value={inspecciones.mantenimiento} tone="blue" />
            <Metric label="VF CGE" value={inspecciones.vf_cge_pagable} tone="green" />
            <Metric label="VF No Ef" value={inspecciones.vf_no_efectiva} tone="red" />
            <Metric label="CNR" value={inspecciones.cnr} tone="green-strong" />
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
          {cargando ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-400">Cargando inspecciones...</p>
            </div>
          ) : inspecciones.inspecciones.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-400">No hay inspecciones para este día</p>
            </div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {isConsolidado && (
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Zona</th>
                  )}
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">ID Medida</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Aviso</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Resultado</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Causa VF</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Tipo CNR</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Comuna</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Dirección</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Horario</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">kWh</th>
                </tr>
              </thead>
              <tbody>
                {inspecciones.inspecciones.map((insp, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/80">
                    {isConsolidado && (
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {(insp as unknown as { zona_inspeccion?: string })['zona_inspeccion'] || '-'}
                      </td>
                    )}
                    <td className="px-3 py-2 text-slate-800 font-medium">{insp['ID Medida'] || '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{insp['Aviso'] || '-'}</td>
                    <td
                      className={`px-3 py-2 font-semibold ${
                        insp['Resultado visita'] === 'CNR'
                          ? 'text-green-600'
                          : insp['Resultado visita'] === 'Visita fallida'
                          ? 'text-red-600'
                          : 'text-slate-800'
                      }`}
                    >
                      {insp['Resultado visita'] || '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-[180px] truncate" title={insp['Resultado final'] || '-'}>
                      {insp['Resultado visita'] === 'Visita fallida' ? insp['Resultado final'] || '-' : '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{insp['Tipo_CNR.Tipo de CNR'] || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{insp['Comuna'] || '-'}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={insp['Dirección Servicio'] || '-'}>
                      {insp['Dirección Servicio'] || '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {insp['Hora inicio'] && insp['Hora fin']
                        ? `${insp['Hora inicio']} - ${insp['Hora fin']}`
                        : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700 font-medium">
                      {insp['kWh CNR'] ? insp['kWh CNR'].toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'green' | 'green-strong' | 'red' | 'blue';
}) {
  const bg = {
    'default': 'bg-white/10',
    'green': 'bg-green-500/20',
    'green-strong': 'bg-green-600/20',
    'red': 'bg-red-600/20',
    'blue': 'bg-blue-500/20',
  }[tone];
  const label_color = {
    'default': 'text-slate-400',
    'green': 'text-green-300',
    'green-strong': 'text-green-300',
    'red': 'text-red-300',
    'blue': 'text-blue-300',
  }[tone];
  const val_color = {
    'default': '',
    'green': 'text-green-100',
    'green-strong': 'text-green-100',
    'red': 'text-red-100',
    'blue': 'text-blue-100',
  }[tone];
  return (
    <div className={`rounded px-2 py-1 ${bg}`}>
      <div className={`text-[9px] uppercase ${label_color}`}>{label}</div>
      <div className={`font-semibold ${val_color}`}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Eliminar la definición local de `InspeccionesDiaModalView` y `Metric` en `DetalleTecnicoDiarioModal.tsx`**

En `frontend/src/components/ui/DetalleTecnicoDiarioModal.tsx`:

Agregar el import en el bloque de imports (después de la línea 5):

```ts
import InspeccionesDiaModal from './InspeccionesDiaModal';
```

Reemplazar el uso del sub-modal (líneas 133-140) — el `<InspeccionesDiaModalView ... />` pasa a ser `<InspeccionesDiaModal ... />`:

```tsx
      {/* Sub-modal: Inspecciones del Día */}
      {inspeccionesDia && (
        <InspeccionesDiaModal
          inspecciones={inspeccionesDia}
          cargando={cargandoInspecciones}
          onClose={() => setInspeccionesDia(null)}
        />
      )}
```

Eliminar **toda** la función `function InspeccionesDiaModalView({...})` (desde la línea 386 hasta su cierre, aprox línea 501).

Eliminar **toda** la función `function Metric({...})` (líneas 503-531) — se movió al archivo nuevo.

- [ ] **Step 3: Verificar TypeScript build**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit code 0, sin errores.

- [ ] **Step 4: Verificación runtime manual**

`npm run dev`, ir a tab **Control Diario**:
- Hacer click en un técnico para abrir el `DetalleTecnicoDiarioModal`.
- Hacer click en una fila o en una celda del calendario → debe abrir el sub-modal de inspecciones con la misma tabla y métricas que antes.
- Cerrar el sub-modal con ✕ y con click en backdrop.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/InspeccionesDiaModal.tsx frontend/src/components/ui/DetalleTecnicoDiarioModal.tsx
git commit -m "refactor(ui): extraer InspeccionesDiaModal a archivo propio para reuso"
```

---

## Task 4: Sub-modal de inspecciones del día en `PersonaModal`

**Files:**
- Modify: `frontend/src/components/views/control-metas/PersonaModal.tsx`

- [ ] **Step 1: Añadir imports y estados**

En `frontend/src/components/views/control-metas/PersonaModal.tsx`:

Reemplazar la línea 11 (cierre del bloque de `import { ... } from '@/types'`):

```ts
import {
  Filters,
  DetalleTecnicoDiario,
  Justificacion,
  Analista,
  CatalogosJustificacion,
  ResumenMesPersona,
  InspeccionesDia,
} from '@/types';
```

Reemplazar el import de la API (línea 12):

```ts
import { getDetalleTecnicoDiario, getInspeccionesDia } from '@/lib/api';
```

Añadir un nuevo import al final del bloque de imports:

```ts
import InspeccionesDiaModal from '@/components/ui/InspeccionesDiaModal';
```

- [ ] **Step 2: Añadir los estados y el cargador**

Dentro del componente `PersonaModal` (después de la línea 55 `const [cargando, setCargando] = useState(true);`), agregar:

```ts
  const [inspeccionesDia, setInspeccionesDia] = useState<InspeccionesDia | null>(null);
  const [cargandoInspecciones, setCargandoInspecciones] = useState(false);

  const cargarInspeccionesDia = useCallback(async (fecha: string) => {
    setCargandoInspecciones(true);
    // Placeholder con el header listo (nombre/zona/fecha) y totales en 0 mientras carga
    setInspeccionesDia({
      nombre: brigada.nombre,
      zona: brigada.zona,
      fecha,
      total_inspecciones: 0,
      efectivas: 0,
      cnr: 0,
      normal: 0,
      mantenimiento: 0,
      vf_cge_pagable: 0,
      vf_no_efectiva: 0,
      inspecciones: [],
    });
    try {
      const data = await getInspeccionesDia(brigada.nombre, brigada.zona, fecha, filters);
      setInspeccionesDia(data);
    } catch (err) {
      console.error('Error cargando inspecciones del día:', err);
      setInspeccionesDia(null);
    } finally {
      setCargandoInspecciones(false);
    }
  }, [brigada.nombre, brigada.zona, filters]);
```

- [ ] **Step 3: Resetear el sub-modal cuando cambia la brigada**

Reemplazar el `useEffect` actual (líneas 89-92):

```ts
  useEffect(() => {
    setDiaSeleccionado(null);
    setInspeccionesDia(null);
    cargar();
  }, [brigada.nombre]);  // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Crear el wrapper `handleSeleccionarDia`**

Después del bloque de `cargarInspeccionesDia` (paso 2), agregar:

```ts
  const handleSeleccionarDia = useCallback((fecha: string) => {
    setDiaSeleccionado(fecha);
    // Solo abrir el sub-modal si el día tiene trabajo registrado
    const c = detalle?.calendario.find(x => x.fecha === fecha);
    if (c?.trabajo) {
      cargarInspeccionesDia(fecha);
    }
  }, [detalle, cargarInspeccionesDia]);
```

- [ ] **Step 5: Conectar el wrapper al calendario y a la tabla**

En el JSX, sustituir las dos referencias actuales:

Línea 192 — cambiar:
```tsx
onSeleccionarDia={setDiaSeleccionado}
```
por:
```tsx
onSeleccionarDia={handleSeleccionarDia}
```

Línea 229 — cambiar:
```tsx
onSeleccionarDia={setDiaSeleccionado}
```
por:
```tsx
onSeleccionarDia={handleSeleccionarDia}
```

- [ ] **Step 6: Renderizar el sub-modal**

Dentro del `return`, justo antes del cierre del fragmento (después de la línea 234 `</div>` que cierra `bg-white rounded-lg shadow-lg ...`, pero antes del cierre del overlay), agregar el sub-modal como hermano del overlay principal. Para hacerlo limpio, envolver el `return` en un fragmento `<>...</>` y agregar el `<InspeccionesDiaModal>` al final:

Reemplazar el `return (` que abre en la línea 140 hasta el cierre `);` de la línea 236 por la estructura siguiente — manteniendo todo el contenido intermedio sin cambios, solo añadiendo el fragmento y el sub-modal al final:

```tsx
  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* ... CONTENIDO ACTUAL DEL MODAL SIN CAMBIOS ... */}
      </div>
      {inspeccionesDia && (
        <InspeccionesDiaModal
          inspecciones={inspeccionesDia}
          cargando={cargandoInspecciones}
          onClose={() => setInspeccionesDia(null)}
        />
      )}
    </>
  );
```

Nota práctica: editar el archivo añadiendo `<>` después de `return (` y `</>` antes de `);`, y entre el `</div>` del overlay y `</>` insertar el bloque `{inspeccionesDia && (...)}`. No tocar nada más del JSX interno.

- [ ] **Step 7: Verificar TypeScript build**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit code 0, sin errores.

- [ ] **Step 8: Verificación runtime manual**

`npm run dev`, ir a **Control Metas**:
- Click en brigada → abre `PersonaModal`.
- Click en una fila de la tabla "Detalle por día" → debe abrir el sub-modal de inspecciones con los datos del día.
- Click en una celda del calendario de un día trabajado (verde/amarillo) → mismo sub-modal.
- Click en celda de día sin trabajo / fin de semana / feriado / futuro → solo selecciona en el panel derecho, **no** abre sub-modal.
- Cerrar sub-modal (✕ o backdrop) → preserva el día seleccionado y el modal principal.
- Click en Anterior/Siguiente cambia de brigada y **cierra** el sub-modal si estaba abierto.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/views/control-metas/PersonaModal.tsx
git commit -m "feat(control-metas): sub-modal de inspecciones al seleccionar día"
```

---

## Task 5: Brigadas clickeables en `CalendarioBrigadas`

**Files:**
- Modify: `frontend/src/components/views/CalendarioBrigadas.tsx`

- [ ] **Step 1: Añadir prop opcional al componente**

En `frontend/src/components/views/CalendarioBrigadas.tsx`:

Reemplazar el `interface CalendarioBrigadasProps` (líneas 6-9):

```ts
interface CalendarioBrigadasProps {
  pagoTecnicos: PagoTecnico[];
  calendario: CalendarioMes;
  onSeleccionarBrigada?: (nombre: string, zona: string) => void;
}
```

Reemplazar la firma del componente (línea 33-36):

```tsx
export default function CalendarioBrigadas({
  pagoTecnicos,
  calendario,
  onSeleccionarBrigada,
}: CalendarioBrigadasProps) {
```

- [ ] **Step 2: Hacer clickeable la celda del nombre**

Reemplazar el bloque de la celda del nombre de brigada (líneas 301-306) por:

```tsx
                          <td
                            className={`sticky left-0 z-10 bg-white px-3 py-1 text-[11px] text-slate-700 truncate max-w-[180px] ${
                              onSeleccionarBrigada ? 'cursor-pointer hover:text-oca-blue hover:underline' : ''
                            }`}
                            title={t.nombre}
                            onClick={
                              onSeleccionarBrigada
                                ? () => onSeleccionarBrigada(t.nombre, t.zona)
                                : undefined
                            }
                          >
                            {t.nombre}
                          </td>
```

- [ ] **Step 3: Verificar TypeScript build**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit code 0, sin errores.

- [ ] **Step 4: Verificación runtime manual**

`npm run dev`, ir a **Alertas Operativas**:
- El calendario sigue mostrando los puntitos por día.
- Los nombres de brigada todavía **no** son clickeables (todavía no se conectó el handler en `AlertasOperativas`) — se conectarán en la tarea 6. El cursor por ahora es normal.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/views/CalendarioBrigadas.tsx
git commit -m "feat(calendario-brigadas): prop opcional onSeleccionarBrigada"
```

---

## Task 6: Click en brigada de Alertas → abrir `PersonaModal`

**Files:**
- Modify: `frontend/src/components/views/AlertasOperativas.tsx`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Pasar `tecnicos` desde `page.tsx`**

En `frontend/src/app/page.tsx`, sustituir el bloque del case `'alertas'` (líneas 79-86):

```tsx
      case 'alertas':
        return (
          <AlertasOperativas
            filters={filters}
            pagoTecnicos={data.pago_tecnicos}
            calendarioMes={data.calendario_mes}
            tecnicos={data.tecnicos}
          />
        );
```

- [ ] **Step 2: Aceptar `tecnicos` en `AlertasOperativas`**

En `frontend/src/components/views/AlertasOperativas.tsx`:

Sustituir el import de tipos (línea 4):

```ts
import {
  Filters,
  AlertasOperativasData,
  TecnicoInactivo,
  MetaNoCompida,
  ProblemaJornada,
  AltaVisitaFallida,
  PagoTecnico,
  CalendarioMes,
  TecnicoRanking,
} from '@/types';
```

Agregar imports nuevos al final del bloque (después del import de `DetalleTecnicoDiarioModal`):

```ts
import PersonaModal, { BrigadaSeleccionada } from './control-metas/PersonaModal';
import { buildBrigadaSeleccionada, BrigadaMeta } from './control-metas/buildBrigadaSeleccionada';
import { calcularDiasRestantes } from './control-metas/calcularDiasRestantes';
import { META_EFECTIVAS_FALLBACK } from './ControlMetas';
```

Reemplazar la interfaz de props (líneas 9-13):

```ts
interface AlertasOperativasProps {
  filters: Filters;
  pagoTecnicos?: PagoTecnico[];
  calendarioMes?: CalendarioMes | null;
  tecnicos?: TecnicoRanking[];
}
```

Cambiar la destructuración (línea 19):

```ts
export default function AlertasOperativas({
  filters,
  pagoTecnicos,
  calendarioMes,
  tecnicos,
}: AlertasOperativasProps) {
```

- [ ] **Step 3: Añadir estado, helpers y handler en `AlertasOperativas`**

Después del bloque `const [tecnicoDetalle, setTecnicoDetalle] = useState<...>(null);` (alrededor de la línea 25), agregar:

```ts
  const [brigadaSeleccionada, setBrigadaSeleccionada] = useState<BrigadaMeta | null>(null);

  const metaEfectivasMes = calendarioMes?.meta_efectivas ?? META_EFECTIVAS_FALLBACK;
  const diasRestantes = useMemo(() => calcularDiasRestantes(calendarioMes), [calendarioMes]);

  // Lista ordenada como en el calendario: zona alfabética + días trabajados desc.
  const todasLasBrigadas = useMemo<BrigadaMeta[]>(() => {
    if (!tecnicos) return [];
    const arr = tecnicos.map(t => buildBrigadaSeleccionada(t, metaEfectivasMes, diasRestantes));
    arr.sort((a, b) => {
      if (a.zona !== b.zona) return a.zona.localeCompare(b.zona);
      return b.diasTrabajados - a.diasTrabajados;
    });
    return arr;
  }, [tecnicos, metaEfectivasMes, diasRestantes]);

  const abrirModalBrigada = useCallback((nombre: string, zona: string) => {
    if (!tecnicos) return;
    const t = tecnicos.find(x => x.nombre === nombre && x.zona === zona);
    if (!t) return;
    setBrigadaSeleccionada(buildBrigadaSeleccionada(t, metaEfectivasMes, diasRestantes));
  }, [tecnicos, metaEfectivasMes, diasRestantes]);

  const navegarTrabajador = useCallback((direccion: 'anterior' | 'siguiente') => {
    if (!brigadaSeleccionada || todasLasBrigadas.length === 0) return;
    const indiceActual = todasLasBrigadas.findIndex(
      b => b.nombre === brigadaSeleccionada.nombre && b.zona === brigadaSeleccionada.zona,
    );
    if (indiceActual === -1) return;
    const len = todasLasBrigadas.length;
    const nuevoIndice = direccion === 'anterior'
      ? (indiceActual === 0 ? len - 1 : indiceActual - 1)
      : (indiceActual === len - 1 ? 0 : indiceActual + 1);
    setBrigadaSeleccionada(todasLasBrigadas[nuevoIndice]);
  }, [brigadaSeleccionada, todasLasBrigadas]);
```

`useMemo` y `useCallback` ya están importados de React (línea 3): asegurarse de tener:

```ts
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
```

(Si falta `useMemo`, agrégalo.)

- [ ] **Step 4: Conectar click al calendario y montar `PersonaModal`**

Reemplazar el bloque `<CalendarioBrigadas .../>` (líneas 168-174) por:

```tsx
      {/* Calendario Operativo de Brigadas */}
      {calendarioMes && pagoTecnicos && pagoTecnicos.some((t) => t.dias_trabajados_count > 0) && (
        <CalendarioBrigadas
          pagoTecnicos={pagoTecnicos}
          calendario={calendarioMes}
          onSeleccionarBrigada={tecnicos ? abrirModalBrigada : undefined}
        />
      )}
```

Justo antes del cierre del componente (antes del `</div>` final y del `)` del return), agregar el modal — buscar el `DetalleTecnicoDiarioModal` existente al final del JSX y añadir el `PersonaModal` como hermano debajo:

```tsx
      {brigadaSeleccionada && (
        <PersonaModal
          brigada={brigadaSeleccionada}
          filters={filters}
          metaEfectivasMes={metaEfectivasMes}
          todasLasBrigadas={todasLasBrigadas}
          onClose={() => setBrigadaSeleccionada(null)}
          onNavegar={navegarTrabajador}
        />
      )}
```

- [ ] **Step 5: Verificar TypeScript build**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit code 0, sin errores.

- [ ] **Step 6: Verificación runtime manual**

`npm run dev`, ir a **Alertas Operativas**:
- En el `Calendario Operativo de Brigadas`, los nombres de brigada ahora tienen cursor pointer y subrayado al hacer hover.
- Click en un nombre de brigada abre el `PersonaModal` completo (mismo que en Control Metas):
  - Header con zona y badge de estado.
  - Calendario mensual del técnico con días trabajados/no trabajados.
  - `DiaPanel` o `ResumenMes` a la derecha.
  - Tabla "Detalle por día" debajo.
- Anterior/Siguiente navega por brigadas (orden: zona alfabética + días trabajados desc).
- Click en fila de tabla "Detalle por día" → sub-modal de inspecciones (de la tarea 4).
- Click en celda del calendario de día trabajado → mismo sub-modal.
- Cerrar `PersonaModal` (✕ o backdrop) vuelve a la vista de Alertas.
- Ir a **Control Metas** y verificar que sigue funcionando todo igual (sin regresión).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/views/AlertasOperativas.tsx frontend/src/app/page.tsx
git commit -m "feat(alertas-operativas): click en brigada del calendario abre PersonaModal"
```

---

## Self-review

**Spec coverage:**

- ✅ `buildBrigadaSeleccionada` helper → Task 2.
- ✅ `calcularDiasRestantes` helper → Task 1.
- ✅ Extraer `InspeccionesDiaModal` → Task 3.
- ✅ `ControlMetas` refactor a usar helpers → Tasks 1 y 2.
- ✅ `page.tsx` pasa `tecnicos` → Task 6 Step 1.
- ✅ `AlertasOperativas` recibe `tecnicos`, calcula `metaEfectivasMes`, `diasRestantes`, `todasLasBrigadas`, monta `PersonaModal` → Task 6 Steps 2-4.
- ✅ `CalendarioBrigadas` prop opcional `onSeleccionarBrigada` → Task 5.
- ✅ `PersonaModal` sub-modal de inspecciones → Task 4.
- ✅ Reset de sub-modal al navegar entre brigadas → Task 4 Step 3.
- ✅ No abrir sub-modal en días sin trabajo → Task 4 Step 4.
- ✅ Export de `META_EFECTIVAS_FALLBACK` → Task 2 Step 2.

**Type consistency:**
- `BrigadaMeta` se define en `buildBrigadaSeleccionada.ts` y se reutiliza en `ControlMetas.tsx` y `AlertasOperativas.tsx`. ✅
- `BrigadaSeleccionada` sigue siendo export de `PersonaModal.tsx` (no cambia). ✅
- `EstadoMeta` se exporta desde el helper y `ControlMetas.tsx` lo importa de ahí. ✅
- `InspeccionesDiaModal` props `{ inspecciones, cargando, onClose }` se usan idénticas en `DetalleTecnicoDiarioModal.tsx` (Task 3) y en `PersonaModal.tsx` (Task 4). ✅
- `onSeleccionarBrigada(nombre, zona)` firma usada igual en `CalendarioBrigadas.tsx` (Task 5) y `AlertasOperativas.tsx` (Task 6). ✅
- `handleSeleccionarDia(fecha: string)` firma igual a la de `setDiaSeleccionado` que reemplaza. ✅

**Placeholder scan:** ningún "TODO", "TBD", "handle edge cases" o referencia a tipos no definidos. Todos los pasos tienen código concreto.
