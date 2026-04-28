# Rediseño Vista "Análisis Visitas Fallidas" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el donut "Distribución Responsabilidad" en filtro global de la sección de Visitas Fallidas, agregar 4 KPIs globales (Total Visitas + 3 efectividades), y rehacer el Top 10 con barras apiladas CGE/OCA.

**Architecture:** Cambio aditivo en backend (`resultados_fallidos.py` y `kpis.py`) que extiende los modelos existentes manteniendo compatibilidad. Refactor del componente único `VisitasFallidas.tsx` para introducir estado local del filtro y memos derivados. Sin nuevos componentes ni dependencias.

**Tech Stack:** Backend Python 3 + pandas + FastAPI. Frontend Next.js 14 + React 18 + TypeScript + ECharts (`echarts-for-react`) + Tailwind. No hay framework de tests en frontend; backend usa scripts de verificación manuales (patrón `verificar_*.py` existente).

**Spec:** `docs/superpowers/specs/2026-04-28-visitas-fallidas-redesign-design.md`

---

## Convenciones del proyecto detectadas

- Tests backend = scripts ejecutables `verificar_*.py` que imprimen resultados para inspección visual usando el dataframe real cargado por `app.dependencies.reload_dataframe`.
- Tests frontend = smoke manual en el dev server (`npm run dev` → http://localhost:3000).
- Commits siguen el patrón `tipo(scope): mensaje` (ej. `feat(reporte): ...`, `test(reporte): ...`). Mantener el patrón.

---

## Task 1: Backend — Extender `calculate_resultados_fallidos` con split CGE/OCA

**Files:**
- Modify: `backend/app/services/resultados_fallidos.py:4-17` (función `calculate_resultados_fallidos`)
- Modify: `backend/app/services/resultados_fallidos.py:20-56` (función `calculate_resultados_fallidos_por_zona`, para consistencia)
- Create: `backend/verificar_resultados_fallidos_split.py`

- [ ] **Step 1: Crear el script de verificación**

Crear `backend/verificar_resultados_fallidos_split.py`:

```python
#!/usr/bin/env python3
"""Verificar split CGE/OCA en calculate_resultados_fallidos."""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe
from app.services.resultados_fallidos import calculate_resultados_fallidos

print('=' * 80)
print('VERIFICACIÓN: calculate_resultados_fallidos con split CGE/OCA')
print('=' * 80)

df = reload_dataframe()
result = calculate_resultados_fallidos(df)

print(f'\nTop {len(result)} resultados fallidos:\n')
print(f'{"Resultado":<45} {"Total":>8} {"CGE":>8} {"OCA":>8}  Suma=Total?')
print('-' * 90)

ok = True
for r in result:
    suma = r['cantidad_cge'] + r['cantidad_oca']
    check = 'OK' if suma == r['cantidad'] else f'FAIL (suma={suma})'
    if suma != r['cantidad']:
        ok = False
    print(f'{r["resultado"][:45]:<45} {r["cantidad"]:>8,} {r["cantidad_cge"]:>8,} {r["cantidad_oca"]:>8,}  {check}')

print('\n' + ('=' * 80))
print('RESULTADO:', 'TODOS OK' if ok else 'HAY FILAS DONDE cantidad_cge + cantidad_oca != cantidad')
print('=' * 80)
sys.exit(0 if ok else 1)
```

- [ ] **Step 2: Ejecutar el script y confirmar que falla**

Run: `cd /home/Diego_Bravo/Proyectos/dashboard-control-perdidas/backend && python verificar_resultados_fallidos_split.py`

Expected: `KeyError: 'cantidad_cge'` (la función actual no devuelve ese campo).

- [ ] **Step 3: Modificar `calculate_resultados_fallidos`**

Reemplazar el cuerpo de `backend/app/services/resultados_fallidos.py` (todo el archivo) por:

```python
import pandas as pd


def calculate_resultados_fallidos(df: pd.DataFrame) -> list:
    vf_df = df[df['Resultado visita'] == 'Visita fallida']
    if vf_df.empty:
        return []

    grouped = (
        vf_df.groupby('Resultado final')['Responsabilidad']
        .value_counts()
        .unstack(fill_value=0)
    )

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


def calculate_resultados_fallidos_por_zona(df: pd.DataFrame) -> dict:
    """
    Calcula los resultados de visitas fallidas agrupados por zona.
    Retorna un diccionario donde cada clave es una zona y el valor es una lista de resultados.
    """
    result = {}

    if 'Resultado visita' not in df.columns or 'zona' not in df.columns:
        return result

    vf_df = df[df['Resultado visita'] == 'Visita fallida'].copy()
    vf_df = vf_df[vf_df['zona'] != 'No Asignados']

    if vf_df.empty:
        return result

    for zona in vf_df['zona'].unique():
        zona_df = vf_df[vf_df['zona'] == zona]
        grouped = (
            zona_df.groupby('Resultado final')['Responsabilidad']
            .value_counts()
            .unstack(fill_value=0)
        )

        zona_data = []
        for resultado, row in grouped.iterrows():
            if pd.isna(resultado) or not resultado:
                continue
            cge = int(row.get('Responsabilidad CGE', 0))
            oca = int(row.get('Responsabilidad Contratista', 0))
            total = cge + oca
            if total == 0:
                continue
            zona_data.append({
                "resultado": str(resultado),
                "cantidad": total,
                "cantidad_cge": cge,
                "cantidad_oca": oca,
            })

        zona_data = sorted(zona_data, key=lambda x: x['cantidad'], reverse=True)[:15]
        result[zona] = zona_data

    return result
```

- [ ] **Step 4: Ejecutar el script y confirmar que pasa**

Run: `cd /home/Diego_Bravo/Proyectos/dashboard-control-perdidas/backend && python verificar_resultados_fallidos_split.py`

Expected: imprime tabla con `cantidad_cge + cantidad_oca == cantidad` para todas las filas, y al final `RESULTADO: TODOS OK`. Exit code 0.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/resultados_fallidos.py backend/verificar_resultados_fallidos_split.py
git commit -m "feat(visitas-fallidas): agregar split CGE/OCA en resultados_fallidos

Cada item de resultados_fallidos ahora incluye cantidad_cge y cantidad_oca
además del total existente. Aplicado tanto en la función global como en
calculate_resultados_fallidos_por_zona para consistencia."
```

---

## Task 2: Backend — Agregar KPIs de efectividad ajustada en `calculate_kpis`

**Files:**
- Modify: `backend/app/services/kpis.py` (función completa, líneas 4-35)
- Create: `backend/verificar_efectividad_sin_cge.py`

- [ ] **Step 1: Crear el script de verificación**

Crear `backend/verificar_efectividad_sin_cge.py`:

```python
#!/usr/bin/env python3
"""Verificar KPIs de efectividad ajustada sin CGE."""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe
from app.services.kpis import calculate_kpis

print('=' * 80)
print('VERIFICACIÓN: KPIs efectividad ajustada (sin CGE)')
print('=' * 80)

df = reload_dataframe()
kpis = calculate_kpis(df)

required = [
    'total_visita_fallida_cge',
    'pct_efectivas_sin_cge_excluida',
    'pct_efectivas_sin_cge_reclasificada',
]
for k in required:
    if k not in kpis:
        print(f'FAIL: falta el campo "{k}" en KPIs')
        sys.exit(1)

print(f'\nTotal registros: {kpis["total_registros"]:,}')
print(f'Total efectivas: {kpis["total_efectivas"]:,}')
print(f'Total visita fallida: {kpis["total_visita_fallida"]:,}')
print(f'Total visita fallida CGE: {kpis["total_visita_fallida_cge"]:,}')
print()
print(f'Efectividad real:                       {kpis["pct_efectivas"]:.2f}%')
print(f'Efectividad sin CGE (excluida):         {kpis["pct_efectivas_sin_cge_excluida"]:.2f}%')
print(f'Efectividad sin CGE (reclasificada):    {kpis["pct_efectivas_sin_cge_reclasificada"]:.2f}%')
print()

# Validaciones lógicas
ok = True

if kpis['total_visita_fallida_cge'] > kpis['total_visita_fallida']:
    print('FAIL: total_visita_fallida_cge > total_visita_fallida')
    ok = False

if kpis['total_visita_fallida_cge'] > 0:
    if kpis['pct_efectivas_sin_cge_excluida'] < kpis['pct_efectivas']:
        print('FAIL: efectividad excluida debería ser >= efectividad real')
        ok = False
    if kpis['pct_efectivas_sin_cge_reclasificada'] < kpis['pct_efectivas']:
        print('FAIL: efectividad reclasificada debería ser >= efectividad real')
        ok = False

# Recálculo independiente
import pandas as pd
total = len(df)
total_cge = int(((df['Resultado visita'] == 'Visita fallida') & (df['Responsabilidad'] == 'Responsabilidad CGE')).sum())
total_efectivas = int(df['Resultado visita'].isin(['Normal', 'CNR']).sum())

esperado_excluida = (total_efectivas / (total - total_cge) * 100) if (total - total_cge) > 0 else 0
esperado_reclasificada = ((total_efectivas + total_cge) / total * 100) if total > 0 else 0

if abs(kpis['pct_efectivas_sin_cge_excluida'] - esperado_excluida) > 0.001:
    print(f'FAIL: pct_efectivas_sin_cge_excluida={kpis["pct_efectivas_sin_cge_excluida"]} esperado={esperado_excluida}')
    ok = False
if abs(kpis['pct_efectivas_sin_cge_reclasificada'] - esperado_reclasificada) > 0.001:
    print(f'FAIL: pct_efectivas_sin_cge_reclasificada={kpis["pct_efectivas_sin_cge_reclasificada"]} esperado={esperado_reclasificada}')
    ok = False

if total_cge == 0:
    print(f'FAIL: total_visita_fallida_cge = 0, dataset vacío o sin responsabilidad CGE — datos sospechosos')
    ok = False

print('=' * 80)
print('RESULTADO:', 'TODOS OK' if ok else 'HAY ERRORES')
print('=' * 80)
sys.exit(0 if ok else 1)
```

- [ ] **Step 2: Ejecutar el script y confirmar que falla**

Run: `cd /home/Diego_Bravo/Proyectos/dashboard-control-perdidas/backend && python verificar_efectividad_sin_cge.py`

Expected: `FAIL: falta el campo "total_visita_fallida_cge" en KPIs` y exit code 1.

- [ ] **Step 3: Modificar `calculate_kpis`**

Reemplazar el contenido completo de `backend/app/services/kpis.py` por:

```python
import pandas as pd


def calculate_kpis(filtered: pd.DataFrame) -> dict:
    total = len(filtered)
    resultado_counts = filtered['Resultado visita'].value_counts()
    total_normal = int(resultado_counts.get('Normal', 0))
    total_cnr = int(resultado_counts.get('CNR', 0))
    total_visita_fallida = int(resultado_counts.get('Visita fallida', 0))
    total_efectivas = total_normal + total_cnr

    total_visita_fallida_cge = int(
        (
            (filtered['Resultado visita'] == 'Visita fallida') &
            (filtered['Responsabilidad'] == 'Responsabilidad CGE')
        ).sum()
    )

    cnr_tipo = filtered[filtered['Resultado visita'] == 'CNR']['Tipo_CNR.Tipo de CNR'].value_counts()
    cnr_falla = int(cnr_tipo.get('CNR Falla', 0))
    cnr_hurto = int(cnr_tipo.get('CNR Hurto', 0))
    kwh_recuperado = int(filtered['kWh CNR'].sum())

    pct_efectivas = (total_efectivas / total * 100) if total > 0 else 0
    pct_cnr = (total_cnr / total_efectivas * 100) if total_efectivas > 0 else 0
    pct_visita_fallida = (total_visita_fallida / total * 100) if total > 0 else 0
    pct_cnr_falla = (cnr_falla / total_cnr * 100) if total_cnr > 0 else 0
    pct_cnr_hurto = (cnr_hurto / total_cnr * 100) if total_cnr > 0 else 0

    denom_excl = total - total_visita_fallida_cge
    pct_efectivas_sin_cge_excluida = (total_efectivas / denom_excl * 100) if denom_excl > 0 else 0
    pct_efectivas_sin_cge_reclasificada = (
        ((total_efectivas + total_visita_fallida_cge) / total * 100) if total > 0 else 0
    )

    return {
        "total_registros": total,
        "total_normal": total_normal,
        "total_cnr": total_cnr,
        "pct_cnr": pct_cnr,
        "total_visita_fallida": total_visita_fallida,
        "pct_visita_fallida": pct_visita_fallida,
        "total_efectivas": total_efectivas,
        "pct_efectivas": pct_efectivas,
        "total_visita_fallida_cge": total_visita_fallida_cge,
        "pct_efectivas_sin_cge_excluida": pct_efectivas_sin_cge_excluida,
        "pct_efectivas_sin_cge_reclasificada": pct_efectivas_sin_cge_reclasificada,
        "cnr_falla": cnr_falla,
        "pct_cnr_falla": pct_cnr_falla,
        "cnr_hurto": cnr_hurto,
        "pct_cnr_hurto": pct_cnr_hurto,
        "kwh_recuperado": kwh_recuperado,
    }
```

- [ ] **Step 4: Ejecutar el script y confirmar que pasa**

Run: `cd /home/Diego_Bravo/Proyectos/dashboard-control-perdidas/backend && python verificar_efectividad_sin_cge.py`

Expected: imprime los tres KPIs nuevos con valores numéricos, y al final `RESULTADO: TODOS OK`. Exit code 0.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/kpis.py backend/verificar_efectividad_sin_cge.py
git commit -m "feat(kpis): agregar efectividad ajustada sin casos CGE

Tres campos nuevos:
- total_visita_fallida_cge: contador de fallidas con responsabilidad CGE
- pct_efectivas_sin_cge_excluida: efectividad si los casos CGE se sacaran
  del denominador
- pct_efectivas_sin_cge_reclasificada: efectividad si los casos CGE
  se reclasificaran como exitosos"
```

---

## Task 3: Frontend — Actualizar tipos `ResultadoFallido` y `KPIData`

**Files:**
- Modify: `frontend/src/types/index.ts:230-233` (`ResultadoFallido`)
- Modify: `frontend/src/types/index.ts:112-126` (`KPIData`)

- [ ] **Step 1: Modificar `ResultadoFallido`**

En `frontend/src/types/index.ts`, reemplazar:

```ts
export interface ResultadoFallido {
  resultado: string;
  cantidad: number;
}
```

por:

```ts
export interface ResultadoFallido {
  resultado: string;
  cantidad: number;
  cantidad_cge: number;
  cantidad_oca: number;
}
```

- [ ] **Step 2: Modificar `KPIData`**

En `frontend/src/types/index.ts`, dentro de `interface KPIData`, después de la línea `pct_efectivas: number;`, agregar tres campos:

```ts
  total_visita_fallida_cge: number;
  pct_efectivas_sin_cge_excluida: number;
  pct_efectivas_sin_cge_reclasificada: number;
```

El bloque resultante de `KPIData` debe verse así:

```ts
export interface KPIData {
  total_registros: number;
  total_normal: number;
  total_cnr: number;
  pct_cnr: number;
  total_visita_fallida: number;
  pct_visita_fallida: number;
  total_efectivas: number;
  pct_efectivas: number;
  total_visita_fallida_cge: number;
  pct_efectivas_sin_cge_excluida: number;
  pct_efectivas_sin_cge_reclasificada: number;
  cnr_falla: number;
  pct_cnr_falla: number;
  cnr_hurto: number;
  pct_cnr_hurto: number;
  kwh_recuperado: number;
}
```

- [ ] **Step 3: Verificar que TypeScript compila**

Run: `cd /home/Diego_Bravo/Proyectos/dashboard-control-perdidas/frontend && npx tsc --noEmit`

Expected: sin errores. (Si aparecen errores en otros archivos por consumir `cantidad` sin los nuevos campos, reportarlo — no debería pasar porque los campos nuevos son adicionales.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(types): extender ResultadoFallido y KPIData con split CGE/OCA"
```

---

## Task 4: Frontend — Pasar `kpis` completos a `VisitasFallidas` desde `page.tsx`

**Files:**
- Modify: `frontend/src/app/page.tsx:128-133` (uso de `<VisitasFallidas .../>`)

- [ ] **Step 1: Inspeccionar el bloque actual**

Run: `sed -n '125,135p' /home/Diego_Bravo/Proyectos/dashboard-control-perdidas/frontend/src/app/page.tsx`

Expected output (aprox):

```
        ) : activeTab === 'visitas' ? (
          <VisitasFallidas
            responsabilidad={data.visitas_fallidas_responsabilidad}
            totalCGE={data.visitas_fallidas_responsabilidad.reduce((acc, r) => acc + r.responsabilidad_cge, 0)}
            totalContratista={data.visitas_fallidas_responsabilidad.reduce((acc, r) => acc + r.responsabilidad_contratista, 0)}
            resultadosFallidos={data.resultados_fallidos || []}
          />
```

- [ ] **Step 2: Modificar `page.tsx` para pasar el objeto `kpis`**

En `frontend/src/app/page.tsx`, reemplazar el bloque del componente `VisitasFallidas` (líneas ~128-133) por:

```tsx
          <VisitasFallidas
            responsabilidad={data.visitas_fallidas_responsabilidad}
            totalCGE={data.visitas_fallidas_responsabilidad.reduce((acc, r) => acc + r.responsabilidad_cge, 0)}
            totalContratista={data.visitas_fallidas_responsabilidad.reduce((acc, r) => acc + r.responsabilidad_contratista, 0)}
            resultadosFallidos={data.resultados_fallidos || []}
            kpis={data.kpis}
          />
```

(En esta task no modificamos la firma del componente — eso pasa en la Task 5; este paso solo deja preparado el call site. TypeScript marcará error temporal porque la prop `kpis` aún no existe en `VisitasFallidasProps` — eso se resuelve al final de la Task 5.)

- [ ] **Step 3: NO commitear todavía**

Este cambio se commitea junto con la Task 5 porque deja TS en error transitorio.

---

## Task 5: Frontend — Refactor `VisitasFallidas.tsx` con filtro y nueva UI

**Files:**
- Modify: `frontend/src/components/views/VisitasFallidas.tsx` (reescritura completa, ~295 líneas)

Esta task reescribe el componente completo. Las decisiones de implementación:

- Estado: `const [filtroResponsabilidad, setFiltroResponsabilidad] = useState<'CGE' | 'OCA' | null>(null);`
- El donut se hace clickeable pasando `onElementClick`. La atenuación del segmento inactivo se logra calculando `donutColors` dinámicamente con alpha — no requiere modificar `DonutChart.tsx`.
- Las cards del bloque 2 atenúan con `opacity-40` cuando son del lado opuesto al filtro.
- El gráfico echarts se reconstruye con dos `series` apiladas (CGE + OCA) cuando no hay filtro, o una sola serie cuando hay filtro.
- Etiquetas: "Contratista" → "OCA" en headers de tabla, donut, y cards.

- [ ] **Step 1: Reemplazar el archivo completo**

Reemplazar todo el contenido de `frontend/src/components/views/VisitasFallidas.tsx` por:

```tsx
'use client';

import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { VisitaFallidaResponsabilidad, ResultadoFallido, KPIData } from '@/types';
import DataTable from '@/components/ui/DataTable';
import DonutChart, { DonutClickEvent } from '@/components/charts/DonutChart';

type ResponsabilidadFiltro = 'CGE' | 'OCA' | null;

interface VisitasFallidasProps {
  responsabilidad: VisitaFallidaResponsabilidad[];
  totalCGE: number;
  totalContratista: number;
  resultadosFallidos: ResultadoFallido[];
  kpis: KPIData;
}

const COLOR_CGE = '#475569';      // slate-600
const COLOR_OCA = '#f59e0b';      // amber-500
const COLOR_CGE_DIM = '#47556966'; // slate-600 a 40% alpha
const COLOR_OCA_DIM = '#f59e0b66'; // amber-500 a 40% alpha

export default function VisitasFallidas({
  responsabilidad,
  totalCGE,
  totalContratista,
  resultadosFallidos,
  kpis,
}: VisitasFallidasProps) {
  const [filtro, setFiltro] = useState<ResponsabilidadFiltro>(null);

  // ============================================================
  // BLOQUE 1: KPIs globales (no responden al filtro)
  // ============================================================
  const total = totalCGE + totalContratista;
  const pctCGE = total > 0 ? (totalCGE / total * 100).toFixed(1) : '0';
  const pctOCA = total > 0 ? (totalContratista / total * 100).toFixed(1) : '0';

  const deltaExcluida = (kpis.pct_efectivas_sin_cge_excluida - kpis.pct_efectivas);
  const deltaReclasificada = (kpis.pct_efectivas_sin_cge_reclasificada - kpis.pct_efectivas);

  // ============================================================
  // BLOQUE 2: KPIs de fallidas + tabla + donut + top 10 (filtran)
  // ============================================================

  // Totales del bloque 2 según filtro
  const totalVisible = filtro === 'CGE' ? totalCGE
                     : filtro === 'OCA' ? totalContratista
                     : total;

  const tiposResultadoVisibles = useMemo(() => {
    if (filtro === 'CGE') return resultadosFallidos.filter(r => r.cantidad_cge > 0).length;
    if (filtro === 'OCA') return resultadosFallidos.filter(r => r.cantidad_oca > 0).length;
    return resultadosFallidos.length;
  }, [resultadosFallidos, filtro]);

  // Tabla por delegación: orden y columnas según filtro
  const responsabilidadOrdenada = useMemo(() => {
    const list = [...responsabilidad];
    if (filtro === 'CGE') {
      return list
        .filter(r => r.responsabilidad_cge > 0)
        .sort((a, b) => b.responsabilidad_cge - a.responsabilidad_cge)
        .slice(0, 20);
    }
    if (filtro === 'OCA') {
      return list
        .filter(r => r.responsabilidad_contratista > 0)
        .sort((a, b) => b.responsabilidad_contratista - a.responsabilidad_contratista)
        .slice(0, 20);
    }
    return list.slice(0, 20);
  }, [responsabilidad, filtro]);

  const columns = useMemo(() => {
    const base: Array<{ key: string; header: string; align?: 'right'; width?: string;
                       render?: (row: VisitaFallidaResponsabilidad) => React.ReactNode }> = [
      { key: 'descripcion', header: 'Descripción', width: '250px' },
    ];

    if (filtro !== 'OCA') {
      base.push({
        key: 'responsabilidad_cge',
        header: 'CGE',
        align: 'right',
        render: (row) =>
          row.responsabilidad_cge > 0 ? (
            <span className="text-slate-600">{row.responsabilidad_cge.toLocaleString('es-CL')}</span>
          ) : <span className="text-slate-300">-</span>,
      });
      base.push({
        key: 'pct_cge',
        header: '%',
        align: 'right',
        render: (row) =>
          row.pct_cge > 0 ? (
            <span className="text-slate-500">{row.pct_cge.toFixed(1)}%</span>
          ) : <span className="text-slate-300">-</span>,
      });
    }

    if (filtro !== 'CGE') {
      base.push({
        key: 'responsabilidad_contratista',
        header: 'OCA',
        align: 'right',
        render: (row) =>
          row.responsabilidad_contratista > 0 ? (
            <span className="text-slate-600">{row.responsabilidad_contratista.toLocaleString('es-CL')}</span>
          ) : <span className="text-slate-300">-</span>,
      });
      base.push({
        key: 'pct_contratista',
        header: '%',
        align: 'right',
        render: (row) =>
          row.pct_contratista > 0 ? (
            <span className="text-slate-500">{row.pct_contratista.toFixed(1)}%</span>
          ) : <span className="text-slate-300">-</span>,
      });
    }

    base.push({
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (row) => {
        const value = filtro === 'CGE' ? row.responsabilidad_cge
                    : filtro === 'OCA' ? row.responsabilidad_contratista
                    : row.total;
        return <span className="font-medium text-slate-800">{value.toLocaleString('es-CL')}</span>;
      },
    });

    return base;
  }, [filtro]);

  // Donut: colores y datos
  const donutData = useMemo(() => [
    { name: 'CGE', value: totalCGE },
    { name: 'OCA', value: totalContratista },
  ], [totalCGE, totalContratista]);

  const donutColors = useMemo(() => {
    if (filtro === 'CGE') return [COLOR_CGE, COLOR_OCA_DIM];
    if (filtro === 'OCA') return [COLOR_CGE_DIM, COLOR_OCA];
    return [COLOR_CGE, COLOR_OCA];
  }, [filtro]);

  const handleDonutClick = (event: DonutClickEvent) => {
    const target: ResponsabilidadFiltro = event.name === 'CGE' ? 'CGE'
                                        : event.name === 'OCA' ? 'OCA'
                                        : null;
    if (!target) return;
    setFiltro(prev => prev === target ? null : target);
  };

  // Top 10 (filtra por responsabilidad activa)
  const { topResultados, otrosResultados, totalResultados } = useMemo(() => {
    const getCantidad = (r: ResultadoFallido) =>
      filtro === 'CGE' ? r.cantidad_cge :
      filtro === 'OCA' ? r.cantidad_oca :
      r.cantidad;

    const sorted = [...resultadosFallidos]
      .filter(r => getCantidad(r) > 0)
      .sort((a, b) => getCantidad(b) - getCantidad(a));

    const top10 = sorted.slice(0, 10);
    const otros = sorted.slice(10);
    const totalRes = sorted.reduce((acc, r) => acc + getCantidad(r), 0);
    return { topResultados: top10, otrosResultados: otros, totalResultados: totalRes };
  }, [resultadosFallidos, filtro]);

  const barChartOption = useMemo(() => {
    const labels = topResultados.map(r =>
      r.resultado.length > 35 ? r.resultado.substring(0, 35) + '...' : r.resultado
    ).reverse();

    const cgeValues = topResultados.map(r => r.cantidad_cge).reverse();
    const ocaValues = topResultados.map(r => r.cantidad_oca).reverse();
    const fullNames = topResultados.map(r => r.resultado).reverse();

    const series: Array<Record<string, unknown>> = [];

    if (filtro === null || filtro === 'CGE') {
      series.push({
        name: 'CGE',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: COLOR_CGE },
        emphasis: { focus: 'series' },
        data: cgeValues,
      });
    }
    if (filtro === null || filtro === 'OCA') {
      series.push({
        name: 'OCA',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: COLOR_OCA },
        emphasis: { focus: 'series' },
        // Cuando hay solo una serie OCA, ponemos los valores normales.
        // Cuando hay las dos, OCA va arriba del stack.
        data: ocaValues,
      });
    }

    return {
      legend: filtro === null ? {
        data: ['CGE', 'OCA'],
        top: 0,
        right: 0,
        textStyle: { fontSize: 11, color: '#475569' },
        itemWidth: 10,
        itemHeight: 10,
      } : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#334155', fontSize: 11 },
        formatter: (params: Array<{ axisValue: string; data: number; seriesName: string; dataIndex: number }>) => {
          if (!params.length) return '';
          const idx = params[0].dataIndex;
          const fullName = fullNames[idx];
          const cge = cgeValues[idx];
          const oca = ocaValues[idx];
          const total = (filtro === 'CGE' ? cge : filtro === 'OCA' ? oca : cge + oca);
          const pct = totalResultados > 0 ? (total / totalResultados * 100).toFixed(1) : '0';
          let html = `<div style="font-weight:600;margin-bottom:4px">${fullName}</div>`;
          if (filtro !== 'OCA') html += `<div>CGE: <b>${cge.toLocaleString('es-CL')}</b></div>`;
          if (filtro !== 'CGE') html += `<div>OCA: <b>${oca.toLocaleString('es-CL')}</b></div>`;
          html += `<div>Total: <b>${total.toLocaleString('es-CL')}</b></div>`;
          html += `<div>Porcentaje: <b>${pct}%</b></div>`;
          return html;
        },
      },
      grid: {
        left: '3%',
        right: '12%',
        top: filtro === null ? '12%' : '3%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          fontSize: 10,
          color: '#475569',
          width: 180,
          overflow: 'truncate',
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series,
    };
  }, [topResultados, totalResultados, filtro]);

  // ============================================================
  // RENDER
  // ============================================================

  // Helpers de estilo para atenuar cards opuestas al filtro
  const dimCge = filtro === 'OCA' ? 'opacity-40' : '';
  const dimOca = filtro === 'CGE' ? 'opacity-40' : '';

  // Valor a mostrar en cards filtradas (placeholder si está atenuada)
  const cgeDisplay = filtro === 'OCA' ? '—' : totalCGE.toLocaleString('es-CL');
  const ocaDisplay = filtro === 'CGE' ? '—' : totalContratista.toLocaleString('es-CL');

  return (
    <div className="space-y-6">
      {/* ============== BLOQUE 1: KPIs globales ============== */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Operación global</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total Visitas</p>
            <p className="text-2xl font-bold text-slate-800">{kpis.total_registros.toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Efectividad</p>
            <p className="text-2xl font-bold text-slate-800">{kpis.pct_efectivas.toFixed(1)}%</p>
            <p className="text-[10px] text-slate-400 mt-1">Real</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Efec. sin CGE (excluida)</p>
            <p className="text-2xl font-bold text-slate-800">{kpis.pct_efectivas_sin_cge_excluida.toFixed(1)}%</p>
            <p className="text-[10px] text-green-600 mt-1">+{deltaExcluida.toFixed(1)} pp vs efectividad</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Efec. sin CGE (reclasif.)</p>
            <p className="text-2xl font-bold text-slate-800">{kpis.pct_efectivas_sin_cge_reclasificada.toFixed(1)}%</p>
            <p className="text-[10px] text-green-600 mt-1">+{deltaReclasificada.toFixed(1)} pp vs efectividad</p>
          </div>
        </div>
      </div>

      {/* ============== BLOQUE 2: KPIs fallidas (filtran) ============== */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Visitas fallidas</p>
          {filtro && (
            <button
              onClick={() => setFiltro(null)}
              className="text-[11px] text-slate-600 hover:text-slate-800 px-2 py-0.5 rounded border border-slate-200 bg-white"
            >
              Filtrado por: {filtro} ×
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total V. Fallidas</p>
            <p className="text-2xl font-bold text-slate-800">{totalVisible.toLocaleString('es-CL')}</p>
          </div>
          <div className={`bg-white rounded-lg border border-slate-200/60 p-4 transition-opacity ${dimCge}`}>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Resp. CGE</p>
            <p className="text-2xl font-bold text-slate-800">{cgeDisplay}</p>
            <p className="text-xs text-slate-400 mt-1">{filtro === 'OCA' ? '' : `${pctCGE}%`}</p>
          </div>
          <div className={`bg-white rounded-lg border border-slate-200/60 p-4 transition-opacity ${dimOca}`}>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Resp. OCA</p>
            <p className="text-2xl font-bold text-amber-600">{ocaDisplay}</p>
            <p className="text-xs text-slate-400 mt-1">{filtro === 'CGE' ? '' : `${pctOCA}%`}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Tipos Resultado</p>
            <p className="text-2xl font-bold text-slate-800">{tiposResultadoVisibles}</p>
          </div>
        </div>
      </div>

      {/* ============== Tabla por delegación + Donut ============== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Visitas Fallidas por Delegación
          </h3>
          <div className="max-h-[400px] overflow-y-auto">
            <DataTable columns={columns} data={responsabilidadOrdenada} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Distribución Responsabilidad
          </h3>
          <DonutChart
            data={donutData}
            colors={donutColors}
            onElementClick={handleDonutClick}
          />
          <p className="text-[10px] text-slate-400 text-center mt-2">
            Click en un segmento para filtrar la sección
          </p>
        </div>
      </div>

      {/* ============== Top 10 + Resumen lateral ============== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Top 10 Tipos de Resultados
            </h3>
            <span className="text-xs text-slate-400">
              {topResultados.length} de {filtro === 'CGE' ? resultadosFallidos.filter(r => r.cantidad_cge > 0).length
                                       : filtro === 'OCA' ? resultadosFallidos.filter(r => r.cantidad_oca > 0).length
                                       : resultadosFallidos.length} tipos
            </span>
          </div>
          <ReactECharts
            option={barChartOption}
            style={{ height: '350px', width: '100%' }}
            notMerge={true}
          />
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Resumen de Resultados
          </h3>

          <div className="bg-slate-50 rounded-lg p-3 mb-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total Registros</p>
            <p className="text-3xl font-bold text-slate-800">{totalResultados.toLocaleString('es-CL')}</p>
          </div>

          <div className="space-y-2 mb-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Top 5 Resultados</p>
            {topResultados.slice(0, 5).map((r, idx) => {
              const cantidad = filtro === 'CGE' ? r.cantidad_cge
                             : filtro === 'OCA' ? r.cantidad_oca
                             : r.cantidad;
              const pct = totalResultados > 0 ? (cantidad / totalResultados * 100) : 0;
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
                    idx === 0 ? 'bg-slate-800 text-white' :
                    idx === 1 ? 'bg-slate-600 text-white' :
                    idx === 2 ? 'bg-slate-400 text-white' :
                    'bg-slate-200 text-slate-600'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-700 truncate" title={r.resultado}>
                      {r.resultado}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-slate-600"
                          style={{ width: `${Math.min(pct * 2, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 w-10 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {otrosResultados.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Otros ({otrosResultados.length} tipos)</span>
                <span className="font-medium text-slate-700">
                  {otrosResultados.reduce((acc, r) => {
                    const c = filtro === 'CGE' ? r.cantidad_cge
                            : filtro === 'OCA' ? r.cantidad_oca
                            : r.cantidad;
                    return acc + c;
                  }, 0).toLocaleString('es-CL')}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {totalResultados > 0
                  ? (otrosResultados.reduce((acc, r) => {
                      const c = filtro === 'CGE' ? r.cantidad_cge
                              : filtro === 'OCA' ? r.cantidad_oca
                              : r.cantidad;
                      return acc + c;
                    }, 0) / totalResultados * 100).toFixed(1)
                  : 0}% del total
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que TypeScript compila**

Run: `cd /home/Diego_Bravo/Proyectos/dashboard-control-perdidas/frontend && npx tsc --noEmit`

Expected: sin errores. Si aparecen errores relacionados con tipos en `params` del tooltip de echarts, ajustar los tipos del callback (`params: Array<...>`).

- [ ] **Step 3: Lint**

Run: `cd /home/Diego_Bravo/Proyectos/dashboard-control-perdidas/frontend && npm run lint`

Expected: sin warnings nuevos. Si aparece warning de hooks (deps array), agregar las deps faltantes al `useMemo`.

- [ ] **Step 4: Smoke test manual en el navegador**

Levantar el backend y el frontend (en dos terminales o usar `start.sh`):

```bash
# Terminal 1
cd /home/Diego_Bravo/Proyectos/dashboard-control-perdidas/backend
source venv/bin/activate
uvicorn main:app --reload

# Terminal 2
cd /home/Diego_Bravo/Proyectos/dashboard-control-perdidas/frontend
npm run dev
```

Abrir http://localhost:3000 y navegar a la pestaña "Visitas Fallidas". Verificar manualmente esta lista:

1. **Bloque 1 (Operación global)** muestra 4 tarjetas con label "OPERACIÓN GLOBAL". Las efectividades ajustadas muestran un subtítulo verde con `+X.X pp vs efectividad`.
2. **Bloque 2 (Visitas fallidas)** muestra las 4 tarjetas existentes con label "VISITAS FALLIDAS". Sin filtro activo, no aparece chip ni botón.
3. **Donut "Distribución Responsabilidad"** muestra dos segmentos: CGE (slate) y OCA (amber). Hay texto debajo: "Click en un segmento para filtrar la sección".
4. **Click en segmento CGE del donut**:
   - Aparece chip "Filtrado por: CGE ×" arriba del bloque 2.
   - Card "Resp. OCA" se atenúa, valor pasa a "—".
   - Card "Total V. Fallidas" pasa al valor de CGE.
   - Tabla por delegación: solo columnas CGE/Total, ordenada por CGE desc.
   - Top 10 chart: barras solo en color slate (sin segmento amber).
   - Tooltip del chart muestra solo CGE + Total + %.
   - Resumen lateral Top 5: valores y porcentajes recalculados con base CGE.
   - Donut: segmento OCA atenuado al ~40% alpha.
5. **Click en segmento CGE otra vez** (o click en el chip ×): vuelve al estado sin filtro.
6. **Click en segmento OCA del donut**: comportamiento simétrico (atenúa CGE, todo en amber).
7. **Bloque 1 NO cambia** al activar/desactivar el filtro (los 4 KPIs globales se mantienen idénticos).
8. **Hover sobre barra del top 10 sin filtro**: tooltip muestra "CGE: N", "OCA: N", "Total: N", "Porcentaje: %".

Si alguna verificación falla, corregir y volver a verificar antes del commit.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/views/VisitasFallidas.tsx frontend/src/app/page.tsx
git commit -m "feat(visitas-fallidas): donut como filtro global + KPIs efectividad ajustada

- Bloque 1 (no filtrable): Total Visitas, Efectividad real, Efectividad
  sin CGE excluida, Efectividad sin CGE reclasificada con delta en pp
- Bloque 2 (filtrable por donut): mismas 4 tarjetas existentes con
  atenuación visual del lado opuesto cuando hay filtro activo
- Donut clickeable: filtra todo el bloque 2, tabla, top 10 y resumen
  lateral; click en segmento activo o chip × limpia el filtro
- Top 10 con barras apiladas CGE (slate-600) + OCA (amber-500); cuando
  hay filtro activo solo se renderiza la serie correspondiente
- Rename UI 'Contratista' → 'OCA' (payload backend conserva
  responsabilidad_contratista para no romper compatibilidad)"
```

---

## Task 6: Verificación cruzada final

**Files:** ninguno

- [ ] **Step 1: Re-ejecutar los dos scripts de verificación backend**

```bash
cd /home/Diego_Bravo/Proyectos/dashboard-control-perdidas/backend
python verificar_resultados_fallidos_split.py
python verificar_efectividad_sin_cge.py
```

Expected: ambos exit 0 con `RESULTADO: TODOS OK`.

- [ ] **Step 2: Verificar que `git status` está limpio**

Run: `git status`

Expected: `nothing to commit, working tree clean`. (Solo `frontend/tsconfig.tsbuildinfo` puede aparecer modificado — eso es generado por TypeScript y se ignora.)

- [ ] **Step 3: Verificar la lista de commits del trabajo**

Run: `git log --oneline -7`

Expected (orden cronológico inverso):
1. `feat(visitas-fallidas): donut como filtro global + KPIs efectividad ajustada`
2. `feat(types): extender ResultadoFallido y KPIData con split CGE/OCA`
3. `feat(kpis): agregar efectividad ajustada sin casos CGE`
4. `feat(visitas-fallidas): agregar split CGE/OCA en resultados_fallidos`
5. `docs(spec): rediseño vista análisis visitas fallidas`
6-7. commits previos (`test(reporte): smoke test...`, etc.)

- [ ] **Step 4: Cierre**

Reportar al usuario:
- Resumen de cambios (5 commits, 5 archivos modificados, 2 archivos nuevos de verificación, 1 spec, 1 plan).
- Cómo levantar el dashboard para probar (`start.sh` o `npm run dev` + `uvicorn`).
- Que los scripts `verificar_*.py` quedan en el repo como verificación reproducible (consistente con la convención existente del backend).

---

## Notas de implementación

- **No hay framework de tests en frontend.** El "testing" es smoke manual en el dev server (Step 4 de la Task 5). Si más adelante se agrega Vitest/Jest, los memos de filtrado están aislados como bloques `useMemo` y se pueden extraer a un hook puro testable.
- **Compatibilidad del payload backend.** `cantidad` se mantiene en `ResultadoFallido` además de los campos nuevos `cantidad_cge` y `cantidad_oca`. Otros consumidores del payload no se rompen.
- **`DonutChart` no se modifica.** El comportamiento de atenuación del segmento inactivo se logra pasando colores con alpha (sufijo hex `66`). Esto evita tocar un componente compartido y deja la responsabilidad en `VisitasFallidas`.
- **`responsabilidad` (tabla por delegación) y `resultadosFallidos` reciben el filtro vía memos en el frontend.** El backend NO necesita endpoints separados por responsabilidad — los datos ya vienen con el split y el filtrado es trivial en cliente.
- **Estado del filtro es local al componente.** No se persiste en URL ni en contexto global. Si más adelante se quiere persistir (deep link, refresh-safe), se hace en una iteración separada.
