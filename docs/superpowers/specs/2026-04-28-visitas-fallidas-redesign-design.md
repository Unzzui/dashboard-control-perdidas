# Rediseño Vista "Análisis Visitas Fallidas"

**Fecha:** 2026-04-28
**Vista afectada:** `frontend/src/components/views/VisitasFallidas.tsx`
**Autor:** Diego Bravo (con Claude)

## Contexto y motivación

La vista "Análisis Visitas Fallidas" hoy muestra cuatro KPIs (total, CGE, Contratista, tipos de resultado), una tabla por delegación, un donut de distribución de responsabilidad y un Top 10 de tipos de resultados con un solo color.

Tres limitaciones impulsan este rediseño:

1. No es posible ver el desglose de causas (Top 10) filtrado por una responsabilidad específica. Al investigar, por ejemplo, qué tipos de resultado son los principales causados por CGE, hoy hay que cruzar mentalmente la tabla y el chart.
2. Falta visibilidad de la efectividad operacional en la misma vista. La efectividad ya se calcula en backend (`pct_efectivas`) pero solo se ve en otras pestañas.
3. OCA necesita poder defender su efectividad excluyendo casos no atribuibles. Actualmente no hay un KPI que aísle el efecto de las fallas asignadas a CGE.

## Alcance

**In scope:**
- Rediseño del frontend de la vista Visitas Fallidas (`VisitasFallidas.tsx`).
- Extensión del endpoint `/api/v1/dashboard` para incluir el split CGE/OCA por cada `Resultado final` y un total de fallidas-CGE global.
- Convertir el donut "Distribución Responsabilidad" en filtro global de la sección.

**Out of scope:**
- Cambios en filtros globales (zona, fecha, regional) — se respetan tal como están.
- Cambios en otras vistas o pestañas del dashboard.
- Persistir el filtro de responsabilidad en URL/query string.
- Agregar nuevas dimensiones de filtrado (tipo de cliente, técnico, etc.).

## Diseño UI

### Estructura general (3 bloques verticales)

```
┌─────────────────────────────────────────────────────────────┐
│ BLOQUE 1 — KPIs globales (NO se filtran por donut)          │
│ Total Visitas │ Efectividad │ Efec. sin CGE A │ Efec. sin CGE B │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ BLOQUE 2 — KPIs de fallidas (SE filtran por donut)          │
│ Total V.Fallidas │ Resp. CGE │ Resp. OCA │ Tipos Resultado  │
└─────────────────────────────────────────────────────────────┘
┌──────────────────────────────────┬──────────────────────────┐
│ Tabla por delegación (filtrable) │ Donut Distribución       │
│                                  │ (es el filtro)           │
├──────────────────────────────────┼──────────────────────────┤
│ Top 10 stacked CGE/OCA           │ Resumen Top 5 (filtrable)│
└──────────────────────────────────┴──────────────────────────┘
```

### Bloque 1 — KPIs globales (siempre fijos)

Cuatro tarjetas en una fila, precedidas de un label `OPERACIÓN GLOBAL` (`text-[10px] uppercase tracking-wider text-slate-400`) que indica visualmente que NO responden al filtro del donut.

| KPI | Fórmula | Subtítulo |
|---|---|---|
| Total Visitas | `kpis.total_registros` | (vacío) |
| Efectividad | `kpis.pct_efectivas` | (vacío) |
| Efectividad sin CGE (excluida) | `total_efectivas / (total_registros − total_visita_fallida_cge)` | `+X.X pp vs efectividad` |
| Efectividad sin CGE (reclasificada) | `(total_efectivas + total_visita_fallida_cge) / total_registros` | `+X.X pp vs efectividad` |

El delta `pp` (puntos porcentuales) se renderiza en `text-green-600` cuando es positivo (siempre lo será, dado que ambas fórmulas reducen la penalización).

### Bloque 2 — KPIs de fallidas (responden al filtro)

Las cuatro tarjetas existentes (Total V. Fallidas, Resp. CGE, Resp. OCA, Tipos Resultado), precedidas del label `VISITAS FALLIDAS`.

Comportamiento ante filtro activo:
- Si el filtro está en `CGE`: la card "Resp. OCA" se atenúa a `opacity-40` y muestra `—`. "Total V. Fallidas" pasa a mostrar `total_visita_fallida_cge`. "Tipos Resultado" cuenta solo los tipos con cantidad CGE > 0.
- Si el filtro está en `OCA`: simétrico.
- Encima del bloque, si hay filtro activo, aparece un chip:
  ```
  Filtrado por: CGE  [×]
  ```
  Click en `[×]` o en el segmento activo del donut limpia el filtro.

### Bloque 3 — Visualizaciones

**Donut "Distribución Responsabilidad" (filtro):**
- Click en CGE → activa filtro CGE (todo el bloque 2 y el resto del bloque 3 se recalcula).
- Click en OCA → activa filtro OCA.
- Click en el segmento ya activo → limpia el filtro.
- Segmento activo en color pleno; segmento inactivo en `opacity-40`.
- Cursor `pointer` en los segmentos para señalar interacción.

**Tabla por delegación:**
- Sin filtro: las 6 columnas actuales.
- Con filtro CGE: oculta columnas `responsabilidad_contratista` y `pct_contratista`; ordena por `responsabilidad_cge desc`.
- Con filtro OCA: oculta columnas `responsabilidad_cge` y `pct_cge`; ordena por `responsabilidad_contratista desc`.
- El Top 20 se mantiene; el orden cambia con el filtro.

**Top 10 Tipos de Resultados (stacked):**
- Sin filtro: barras apiladas con dos series — CGE en `#475569` (slate-600), OCA en `#f59e0b` (amber-500).
- Con filtro CGE: solo se renderiza la serie CGE; las barras quedan en slate-600.
- Con filtro OCA: solo serie OCA; barras en amber-500.
- Tooltip muestra: nombre completo del resultado, cantidad CGE, cantidad OCA, total, % sobre el total visible.
- Leyenda en la esquina superior derecha del card: dos puntos de color con etiquetas "CGE" y "OCA". Cuando hay filtro, la leyenda muestra solo la responsabilidad activa.
- El Top 10 se recalcula con el filtro activo: al filtrar por CGE, los 10 resultados con más fallidas-CGE pueden no ser los mismos que sin filtrar.

**Resumen lateral (Top 5 + Otros):**
- Total Registros: cuenta visible según filtro.
- Top 5: idéntica lógica al gráfico — se recalcula con el filtro.
- Bloque "Otros (N tipos)": idem.

## Cambios en el backend

### `backend/app/services/resultados_fallidos.py`

Modificar `calculate_resultados_fallidos` para que cada item incluya el split:

```python
def calculate_resultados_fallidos(df: pd.DataFrame) -> list:
    vf_df = df[df['Resultado visita'] == 'Visita fallida']
    grouped = vf_df.groupby('Resultado final')['Responsabilidad'].value_counts().unstack(fill_value=0)

    data = []
    for resultado, row in grouped.iterrows():
        if pd.isna(resultado) or not resultado:
            continue
        cge = int(row.get('Responsabilidad CGE', 0))
        oca = int(row.get('Responsabilidad Contratista', 0))
        total = cge + oca
        if total == 0:
            continue
        data.append({
            "resultado": str(resultado),
            "cantidad": total,
            "cantidad_cge": cge,
            "cantidad_oca": oca,
        })

    return sorted(data, key=lambda x: x['cantidad'], reverse=True)[:15]
```

`calculate_resultados_fallidos_por_zona` se actualiza con la misma lógica para mantener consistencia.

### `backend/app/services/kpis.py`

Agregar al diccionario que retorna `calculate_kpis`:

```python
total_visita_fallida_cge = int(
    filtered[
        (filtered['Resultado visita'] == 'Visita fallida') &
        (filtered['Responsabilidad'] == 'Responsabilidad CGE')
    ].shape[0]
)
denom_excl = total - total_visita_fallida_cge
pct_efectivas_sin_cge_excluida = (total_efectivas / denom_excl * 100) if denom_excl > 0 else 0
pct_efectivas_sin_cge_reclasificada = ((total_efectivas + total_visita_fallida_cge) / total * 100) if total > 0 else 0
```

Y exponerlos:
```python
"total_visita_fallida_cge": total_visita_fallida_cge,
"pct_efectivas_sin_cge_excluida": pct_efectivas_sin_cge_excluida,
"pct_efectivas_sin_cge_reclasificada": pct_efectivas_sin_cge_reclasificada,
```

### Tipos en frontend

`frontend/src/types/index.ts`:

```ts
export interface ResultadoFallido {
  resultado: string;
  cantidad: number;
  cantidad_cge: number;   // nuevo
  cantidad_oca: number;   // nuevo
}

export interface DashboardKpis {
  // ... campos existentes
  total_visita_fallida_cge: number;             // nuevo
  pct_efectivas_sin_cge_excluida: number;       // nuevo
  pct_efectivas_sin_cge_reclasificada: number;  // nuevo
}
```

## Componentes frontend

### Estado del filtro

En `VisitasFallidas.tsx`, estado local nuevo:
```ts
type ResponsabilidadFiltro = 'CGE' | 'OCA' | null;
const [filtroResponsabilidad, setFiltroResponsabilidad] = useState<ResponsabilidadFiltro>(null);
```

El estado vive en el componente, no se sube al contexto global ni se persiste — al cambiar de pestaña o recargar, vuelve a `null`. Si más adelante se quiere persistir en URL, se hace en una iteración separada.

### Datos derivados

Cuatro `useMemo` que dependen de `filtroResponsabilidad`:

1. `kpisFallidasFiltrados`: total, total_cge, total_oca, tipos_resultado_count visibles según filtro.
2. `responsabilidadFiltrada`: tabla por delegación reordenada y con columnas filtradas.
3. `resultadosFallidosFiltrados`: top 10 con cantidad relevante según filtro.
4. `topResultados / otrosResultados / totalResultados`: idem para el resumen lateral.

### Top 10 chart (echarts)

La opción de echarts pasa de tener `series: [{ type: 'bar', data: [...] }]` a tener dos series stacked:

```ts
series: [
  { name: 'CGE', type: 'bar', stack: 'total', itemStyle: { color: '#475569' }, data: [...cge values reversed] },
  { name: 'OCA', type: 'bar', stack: 'total', itemStyle: { color: '#f59e0b' }, data: [...oca values reversed] },
]
```

Cuando hay filtro activo, solo se incluye la serie correspondiente. La leyenda usa la propiedad `legend` nativa de echarts en `top: 0, right: 0`.

El label de porcentaje al final de la barra (`position: 'right'`) se mantiene, pero ahora se renderiza usando una serie label-only o calculando el `endLabel` de la última serie del stack.

### Donut clickeable

`DonutChart` ya admite click handlers según el reporte inicial. Pasar:
```ts
<DonutChart
  data={donutData}
  colors={['#475569', '#f59e0b']}
  onSegmentClick={(name) => {
    const target = name === 'CGE' ? 'CGE' : 'OCA';
    setFiltroResponsabilidad(prev => prev === target ? null : target);
  }}
  selectedSegment={filtroResponsabilidad === 'CGE' ? 'CGE' : filtroResponsabilidad === 'OCA' ? 'Contratista' : null}
/>
```

Si `DonutChart` actualmente no expone `selectedSegment` para atenuar el segmento inactivo, se agrega esa prop como parte de este trabajo. La verificación exacta del API actual de `DonutChart` se hace en el plan de implementación.

## Estados y casos borde

- **Sin datos de fallidas (total = 0):** todas las tarjetas muestran `0`, las efectividades ajustadas se igualan a la efectividad real (delta `+0.0 pp`), donut vacío, top 10 vacío. No se rompe la UI.
- **`total_registros = 0`:** efectividad real es `0%`. Los denominadores ajustados son `0` o negativos; las dos efectividades ajustadas también devuelven `0%` (guarda `if denom > 0 else 0` en backend).
- **Filtro activo + dataset filtrado por zona/fecha vacío en esa responsabilidad:** top 10 vacío, KPIs en `0`, tabla vacía. Mostrar texto "Sin registros para la responsabilidad seleccionada".
- **Resultado final con cantidad CGE > 0 pero OCA = 0 (o viceversa):** sin filtro, la barra apilada tiene un solo segmento — comportamiento normal de echarts, no requiere lógica especial.

## Testing

**Backend:**
- Test que `calculate_resultados_fallidos` retorna `cantidad_cge + cantidad_oca == cantidad` en cada fila.
- Test que `total_visita_fallida_cge <= total_visita_fallida`.
- Test que `pct_efectivas_sin_cge_excluida >= pct_efectivas` cuando `total_visita_fallida_cge > 0`.
- Test del caso `total = 0` (denominadores vacíos).

**Frontend:**
- Smoke test de render de `VisitasFallidas` con datos sintéticos.
- Test de comportamiento del filtro: click en segmento CGE del donut → KPIs del bloque 2 reflejan solo CGE; click otra vez → vuelve a estado sin filtro.
- Test que el bloque 1 (KPIs globales) no cambia al activar el filtro.

## Riesgos y consideraciones

- **Cambio de contrato API:** agregar `cantidad_cge` y `cantidad_oca` a `ResultadoFallido` es aditivo; mantener `cantidad` preserva compatibilidad con consumidores que aún no se actualicen.
- **Performance:** el groupby cruzado por `Resultado final` × `Responsabilidad` opera sobre las visitas fallidas (~43k filas). No hay riesgo de performance.
- **Densidad visual del bloque 1:** cuatro KPIs con deltas y subtítulos pueden volverse densos en mobile. Se respeta el grid responsive existente (`grid-cols-2 md:grid-cols-4`); en mobile las tarjetas se apilan en 2x2 sin perder claridad.
- **Confusión entre "OCA" y "Contratista":** el backend usa el literal `Responsabilidad Contratista` y el tipo actual `responsabilidad_contratista`. La UI muestra "OCA" porque es el contratista del proyecto. Se mantiene `Contratista` en payload backend y se traduce a "OCA" solo en labels visibles. Concretamente:
  - Card del bloque 2: "Resp. Contratista" → "Resp. OCA".
  - `donutData`: cambiar `name: 'Contratista'` → `name: 'OCA'` (ese campo es el label que renderiza el donut, no el campo del payload).
  - Tabla por delegación: header "Contratista" → "OCA".
  - Leyenda del top 10: "OCA".
  - Chip de filtro activo: "Filtrado por: OCA".

## Filosofía de diseño

El rediseño respeta el "Minimalismo Ejecutivo" del proyecto:
- Sin emojis ni iconos decorativos.
- Paleta limitada: slate para neutro, amber para OCA, verde para deltas positivos.
- Tipografía y bordes según `CLAUDE.md` y `STYLE_GUIDE.md`.
- El donut como filtro no agrega un nuevo control visual — reusa un elemento que ya está en pantalla.
- Los segmentos atenuados (`opacity-40`) comunican estado sin agregar bordes ni efectos.
