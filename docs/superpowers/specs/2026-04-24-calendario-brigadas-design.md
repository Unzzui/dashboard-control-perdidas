# Calendario de Brigadas — Producción Mensual

**Fecha:** 2026-04-24
**Vista afectada:** `ProduccionMensual`
**Salida afectada:** Excel generado por `exportPagoExcel.ts`

## Objetivo

Agregar a la vista de Producción Mensual (frontend y Excel) una matriz visual que muestre, por cada brigada, qué días del mes trabajó. La matriz debe permitir:

- Ver a golpe de vista los días trabajados por cada brigada.
- Identificar visualmente sábados, domingos y feriados.
- Contar la cantidad total de brigadas operativas.
- Contar días trabajados (global, por zona y por brigada).

## Decisiones de producto

| Aspecto | Decisión |
|---|---|
| Contenido de la celda | Marca binaria (trabajó / no trabajó), sin conteo |
| Criterio "trabajó" | Existe al menos una fila en el dataset con ese técnico y esa fecha (cualquier tipo de inspección) |
| Distinción sábado | Fondo ámbar, marca ámbar |
| Distinción domingo | Fondo gris claro (slate-50) |
| Distinción feriado | Fondo lila (violet-50), marca violeta |
| Agrupación de filas | Por zona, con subheader por zona |
| Ubicación UI | Nueva sección después del bloque "Análisis de Brecha", antes del grid de tarjetas por zona |
| Totales globales | Bloque de 4 KPI cards arriba de la matriz |
| Totales por zona | En el subheader de cada grupo |
| Totales por brigada (fila) | Columnas fijas Trab · Sáb · Aus.H a la derecha (aprobadas en revisión) |
| Totales por día (columna) | Fila al pie con brigadas operativas por día |
| Mes visualizado | El último mes con datos dentro del filtro global; si no hay filtro de mes, el más reciente disponible |
| Estructura Excel | Una nueva hoja "Calendario Brigadas" en el workbook existente |

## Arquitectura

### 1. Backend — `app/services/pago_tecnicos.py`

Extender el servicio existente. El mismo barrido que hoy calcula totales por técnico debe producir adicionalmente:

- `dias_trabajados: list[int]` — días del mes (1..N) donde existe al menos una fila del técnico en el dataframe filtrado, restringido al mes visualizado.
- `dias_trabajados_count: int`
- `sabados_trabajados_count: int`

Cuando el filtro de meses incluye varios, se elige el **último con datos** como "mes visualizado" (el mes calendario más reciente en el dataframe filtrado que tiene ≥1 fila). Los datos de ese mes son los que se usan para la matriz. Los totales de pago actuales no cambian (siguen sumando todo el período filtrado).

### 2. Backend — `app/routers/dashboard.py` / `DashboardData`

Agregar al payload del endpoint principal un campo nuevo `calendario_mes`:

```python
{
  "mes": "abril",              # nombre del mes visualizado
  "año": 2026,
  "numero_mes": 4,             # 1..12
  "dias_en_mes": 30,
  "sabados": [5, 12, 19, 26],  # días del mes que caen en sábado
  "domingos": [6, 13, 20, 27],
  "feriados": [1],             # días marcados como feriado (lista explícita en config)
  "total_habiles": 21          # días hábiles del mes (excluye sábados, domingos y feriados)
}
```

Si no hay datos en el filtro, devolver `None` y la sección del calendario se oculta en el frontend.

### 3. Frontend — tipos (`src/types/index.ts`)

Extender `PagoTecnico`:

```ts
dias_trabajados: number[];
dias_trabajados_count: number;
sabados_trabajados_count: number;
```

Agregar al `DashboardData`:

```ts
calendario_mes: CalendarioMes | null;

interface CalendarioMes {
  mes: string;
  año: number;
  numero_mes: number;
  dias_en_mes: number;
  sabados: number[];
  domingos: number[];
  feriados: number[];
  total_habiles: number;
}
```

### 4. Frontend — nuevo componente `CalendarioBrigadas.tsx`

Ubicación: `src/components/views/ProduccionMensual/CalendarioBrigadas.tsx`.

Props:
```ts
interface CalendarioBrigadasProps {
  pagoTecnicos: PagoTecnico[];
  calendario: CalendarioMes;
}
```

Estructura:

1. **Encabezado de la sección**: título "Calendario Operativo — {mes} {año}", subtítulo con `text-sm text-slate-500`.

2. **KPI cards (4 cards)** — grid `md:grid-cols-4 gap-3`, mismo estilo que los KPIs existentes:
   - **Brigadas Operativas**: `pagoTecnicos.filter(t => t.dias_trabajados_count > 0).length`. Subtítulo: "de {total} técnicos".
   - **Días Hábiles del Mes**: `calendario.total_habiles`. Subtítulo: "Lun–Vie hábiles en {mes}".
   - **Promedio Días/Brigada**: `suma(dias_trabajados_count) / brigadas_operativas`, 1 decimal. Subtítulo: "de {dias_en_mes} posibles".
   - **Sábados Operados**: `suma(sabados_trabajados_count) / brigadas_operativas`, 1 decimal. Subtítulo: "prom. por brigada · {n} sábados en el mes".

3. **Matriz** dentro de una card `bg-white rounded-lg border border-slate-200/60 overflow-hidden`:

   - `div` con `overflow-x-auto`
   - `table` con:
     - `thead` sticky: fila 1 con números 1..N, fila 2 con iniciales L/M/M/J/V/S/D (`text-[9px] text-slate-400`)
     - `tbody`: por cada zona, una fila subheader con `bg-slate-800 text-white` mostrando `{zona} · {n brigadas activas} · {Σ días trabajados} · prom {x.x} d/brigada` — seguida de las filas de brigadas de esa zona
     - Fila de brigada: col izquierda con nombre (truncado, `max-w-[160px]` sticky izquierda), N columnas de día, y 3 columnas fijas a la derecha (Trab, Sáb, Aus.H)
   - `tfoot`: fila "Brigadas operativas/día" con conteo por columna

4. **Estilos de celda** (tamaño fijo `w-6 h-6` para densidad):

   | Estado | Fondo columna | Marca |
   |---|---|---|
   | Hábil trabajado | blanco | punto `bg-oca-blue` (6×6) |
   | Hábil no trabajado | blanco | punto `bg-slate-200` |
   | Sábado trabajado | `bg-amber-50` | punto `bg-amber-500` |
   | Sábado no trabajado | `bg-amber-50` | punto `bg-amber-100` |
   | Domingo | `bg-slate-50` | vacío (o punto `bg-slate-200` si trabajó, caso raro) |
   | Feriado | `bg-violet-50` | vacío, o punto `bg-violet-500` si trabajó |
   | Día > fecha actual (futuro) | `bg-slate-50 opacity-60` | vacío |

5. **Indicadores de umbral** en la columna "Aus.H":
   - 0 ausencias → `text-slate-400`
   - 1–3 ausencias → `text-amber-600`
   - ≥4 ausencias → `text-red-600 font-semibold`

6. **Importar e integrar** en `ProduccionMensual.tsx`:
   - Añadir prop opcional `calendarioMes` al componente.
   - Renderizar `<CalendarioBrigadas />` entre el bloque de "Análisis de Brecha" y el grid de tarjetas por zona.
   - Si `calendarioMes` es `null` o no hay pagoTecnicos con días trabajados, no renderizar la sección.

### 5. Frontend — Excel (`src/lib/exportPagoExcel.ts`)

Agregar una nueva hoja al workbook, justo antes de la hoja "Metodología":

**Hoja "Calendario Brigadas"**:

- Fila 1 (merged A1:Xn): título "Calendario Operativo — {mes} {año}" en `Inter 16 bold slate800`.
- Fila 2 (merged): subtítulo `Período: ... · {N} brigadas · {X} días hábiles`.
- Fila 3: grupos de columnas — Identidad (2) + Días (N) + Totales (3).
- Fila 4: headers detallados
  - Col 1: "Brigada"
  - Col 2: "Zona"
  - Cols 3..(2+N): número del día
  - Fila 5 bajo la 4, celdas 3..(2+N): inicial del día de semana (L/M/M/J/V/S/D)
  - Cols (3+N)..(5+N): "Días Trab", "Sáb Trab", "Aus.H"
- Filas 6+: agrupadas por zona.
  - Fila subheader de zona: merged de A a final, `bg: oca-blue`, texto blanco, formato `{zona} · {N} brigadas · {X} días trab · prom {x.x}`.
  - Filas de brigada: nombre (col 1), zona (col 2), celdas día con "●" en color según tipo de día, totales con números.
- Fila final "Brigadas operativas": merged A:B con texto "Brigadas operativas/día", y por columna de día el conteo.
- Freeze panes en `{ xSplit: 2, ySplit: 5 }` para mantener brigada+zona y headers visibles.
- Color por tipo de columna:
  - Domingo: fgColor `slate100`
  - Sábado: fgColor `amber soft` (#FEF3C7)
  - Feriado: fgColor `violet soft` (#EDE9FE)
  - Hábil: blanco
- Color del carácter "●" según el tipo de día en que cayó (blue / amber / violet).
- Anchos: columnas de día `3.0`, columna Brigada `28`, Zona `22`, totales `10`.

Actualizar la hoja "Metodología" con una nueva sección explicando el calendario (criterio "trabajó", tratamiento de sábados/feriados).

### 6. Feriados

Mantener un diccionario estático de feriados chilenos en `backend/app/config.py`, con estructura `{año: set[(mes, día)]}`. El valor inicial se completa con la lista oficial de feriados legales publicada por el Gobierno de Chile para 2026 (y opcionalmente 2025 para retrocompatibilidad con datos históricos del dataset):

```python
FERIADOS_CL: dict[int, set[tuple[int, int]]] = {
    2026: { (1, 1), (4, 3), (4, 4), (5, 1), (5, 21), (6, 29),
            (7, 16), (8, 15), (9, 18), (9, 19), (10, 12), (10, 31),
            (11, 1), (12, 8), (12, 25) },
    # Se agregan años adicionales cuando se publiquen oficialmente.
}
```

El servicio filtra los feriados cuyo mes coincide con el mes visualizado y pasa los días al `calendario_mes`. Si un feriado cae en sábado o domingo, prevalece su marca de feriado (prioridad: feriado > sábado > domingo > hábil).

Si el año del mes visualizado no está en `FERIADOS_CL`, `feriados` se devuelve como lista vacía (la matriz se dibuja sin marca de feriado pero sigue funcionando).

## Tests

### Backend
- `backend/test_calendario_brigadas.py`:
  - Caso: un técnico con inspecciones en 3 días distintos → `dias_trabajados_count == 3` y array correcto.
  - Caso: un técnico sin inspecciones → no aparece o aparece con `dias_trabajados_count == 0`.
  - Caso: mes seleccionado con 30 días → `dias_en_mes == 30` y `sabados`/`domingos` correctos.
  - Caso: feriado de la lista estática → aparece en `feriados` del mes.

### Frontend
- Verificación visual en dev server con un mes real del dataset.
- Checklist de regresión:
  - KPIs principales (Total a Pago, Brecha, etc.) siguen con los mismos valores.
  - El Excel descargado sigue teniendo las hojas Resumen, Detalle Técnicos, Metodología y ahora además Calendario Brigadas.
  - Al cambiar el filtro de mes, la matriz se actualiza al último mes con datos.

## Criterios de aceptación

1. En la vista de Producción Mensual aparece la nueva sección "Calendario Operativo" entre el bloque de brecha y el grid de tarjetas.
2. Se ven 4 KPI cards (Brigadas Operativas, Días Hábiles, Prom Días/Brigada, % Sábados Operados).
3. La matriz muestra todas las brigadas agrupadas por zona, con una columna por día del mes y 3 columnas de totales por brigada.
4. Los sábados están con fondo ámbar, los domingos con gris claro, los feriados con lila.
5. Las celdas trabajadas muestran un punto de color según el tipo de día.
6. El pie de la matriz muestra el conteo de brigadas operativas por día.
7. El Excel incluye una nueva hoja "Calendario Brigadas" con la misma estructura, colores proporcionales y freeze panes funcionales.
8. El filtro global del dashboard afecta al calendario (al cambiar zona, técnico o mes se recalcula).
9. Los estilos respetan CLAUDE.md: sin emojis, sin iconos decorativos, `text-[10px] uppercase tracking-wider text-slate-400` en labels, paleta oca-blue / slate.

## Fuera de alcance

- Conteo de efectivas por día en la celda (decisión: solo binario).
- Detección dinámica de feriados vía API externa (se usa lista estática).
- Edición manual de asistencia (es sólo lectura, derivada del dataset).
- Exportación de una hoja por zona (decisión: una sola hoja).
