# Calendario de Brigadas — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a la vista de Producción Mensual (frontend y Excel exportado) una matriz visual brigada × día del mes que permita contar días trabajados, identificar sábados/domingos/feriados y mostrar cantidad de brigadas operativas.

**Architecture:** El servicio `pago_tecnicos` ya recorre el dataframe por técnico; se extiende para producir también `dias_trabajados` (lista de días del mes con ≥1 registro). Un nuevo helper `calendario_mes` calcula la metadata del mes visualizado (días, sábados, domingos, feriados). Ambos se agregan al payload del endpoint `/dashboard`. En el frontend, un nuevo componente `CalendarioBrigadas` consume esta data y el exportador de Excel añade una hoja nueva.

**Tech Stack:** Python 3 / pandas / FastAPI (backend). Next.js / React / TypeScript / Tailwind / ExcelJS (frontend). Sin librerías nuevas.

**Spec de referencia:** `docs/superpowers/specs/2026-04-24-calendario-brigadas-design.md`

---

## Estructura de archivos

**Backend:**
- Modificar `backend/app/config.py` — añadir `FERIADOS_CL` dict
- Crear `backend/app/services/calendario_mes.py` — helper para metadata del mes
- Modificar `backend/app/services/pago_tecnicos.py` — añadir campos `dias_trabajados*`
- Modificar `backend/app/routers/dashboard.py` — incluir `calendario_mes` en el payload
- Crear `backend/test_calendario_brigadas.py` — script de verificación (estilo del proyecto)

**Frontend:**
- Modificar `frontend/src/types/index.ts` — tipo `CalendarioMes`, extender `PagoTecnico`, extender `DashboardData`
- Modificar `frontend/src/hooks/useDashboard.ts` — incluir `calendario_mes: null` en `defaultData`
- Crear `frontend/src/components/views/CalendarioBrigadas.tsx` — nuevo componente
- Modificar `frontend/src/components/views/ProduccionMensual.tsx` — aceptar prop `calendarioMes` y renderizar la sección
- Modificar `frontend/src/app/page.tsx` — pasar `data.calendario_mes` a `ProduccionMensual`
- Modificar `frontend/src/lib/exportPagoExcel.ts` — aceptar `calendarioMes` en opciones y añadir hoja "Calendario Brigadas"

---

## Task 1: Config — feriados chilenos

**Files:**
- Modify: `backend/app/config.py`

- [ ] **Step 1: Añadir lista oficial de feriados 2026 al final del archivo**

Abrir `backend/app/config.py` y añadir al final:

```python

# Feriados chilenos oficiales.
# Fuente: lista oficial de feriados legales publicada por el Gobierno de Chile.
# Formato: { año: set[(mes, día)] }
FERIADOS_CL: dict[int, set[tuple[int, int]]] = {
    2025: {
        (1, 1),   # Año Nuevo
        (4, 18),  # Viernes Santo
        (4, 19),  # Sábado Santo
        (5, 1),   # Día del Trabajador
        (5, 21),  # Día de las Glorias Navales
        (6, 20),  # Día de los Pueblos Indígenas
        (6, 29),  # San Pedro y San Pablo
        (7, 16),  # Virgen del Carmen
        (8, 15),  # Asunción de la Virgen
        (9, 18),  # Independencia Nacional
        (9, 19),  # Glorias del Ejército
        (10, 12), # Encuentro de Dos Mundos
        (10, 31), # Día de las Iglesias Evangélicas
        (11, 1),  # Día de Todos los Santos
        (12, 8),  # Inmaculada Concepción
        (12, 14), # Elecciones Presidenciales 2a vuelta
        (12, 25), # Navidad
    },
    2026: {
        (1, 1),   # Año Nuevo
        (4, 3),   # Viernes Santo
        (4, 4),   # Sábado Santo
        (5, 1),   # Día del Trabajador
        (5, 21),  # Día de las Glorias Navales
        (6, 29),  # San Pedro y San Pablo
        (7, 16),  # Virgen del Carmen
        (8, 15),  # Asunción de la Virgen
        (9, 18),  # Independencia Nacional
        (9, 19),  # Glorias del Ejército
        (10, 12), # Encuentro de Dos Mundos
        (10, 31), # Día de las Iglesias Evangélicas
        (11, 1),  # Día de Todos los Santos
        (12, 8),  # Inmaculada Concepción
        (12, 25), # Navidad
    },
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/config.py
git commit -m "feat(backend): añadir FERIADOS_CL para 2025-2026"
```

---

## Task 2: Helper `calendario_mes`

**Files:**
- Create: `backend/app/services/calendario_mes.py`
- Test: `backend/test_calendario_mes.py`

- [ ] **Step 1: Escribir el test de verificación**

Crear `backend/test_calendario_mes.py`:

```python
#!/usr/bin/env python3
"""Test del helper calendario_mes."""

import sys
sys.path.insert(0, '.')

import calendar as _cal
import pandas as pd
from app.services.calendario_mes import build_calendario_mes


def _make_df(fechas):
    return pd.DataFrame({"Fecha ejecución": pd.to_datetime(fechas)})


def test_mes_completo_abril_2026():
    df = _make_df(["2026-04-01", "2026-04-15", "2026-04-30"])
    res = build_calendario_mes(df)
    assert res is not None, "Debe devolver dict cuando hay datos"
    assert res["numero_mes"] == 4
    assert res["año"] == 2026
    assert res["mes"] == "abril"
    assert res["dias_en_mes"] == 30
    # Abril 2026: sábados son 4, 11, 18, 25
    assert res["sabados"] == [4, 11, 18, 25]
    # Domingos 5, 12, 19, 26
    assert res["domingos"] == [5, 12, 19, 26]
    # Feriados en abril 2026: Viernes Santo (3), Sábado Santo (4)
    assert 3 in res["feriados"]
    assert 4 in res["feriados"]
    # Hábiles: 30 - 4 sábados - 4 domingos - 2 feriados (el sábado 4 ya estaba en sábados, no se resta dos veces)
    # Lógica: hábil = no sábado, no domingo, no feriado
    assert res["total_habiles"] == 30 - len(set(res["sabados"]) | set(res["domingos"]) | set(res["feriados"]))


def test_elige_ultimo_mes_con_datos():
    df = _make_df(["2026-02-15", "2026-03-10", "2026-03-25"])
    res = build_calendario_mes(df)
    assert res["numero_mes"] == 3, "Debe elegir marzo (el último con datos)"


def test_df_vacio_retorna_none():
    df = pd.DataFrame({"Fecha ejecución": pd.to_datetime([])})
    assert build_calendario_mes(df) is None


def test_mes_sin_feriados():
    # Julio 2026 no tiene feriados salvo el 16 (Virgen del Carmen)
    df = _make_df(["2026-07-02"])
    res = build_calendario_mes(df)
    assert res["feriados"] == [16]


if __name__ == "__main__":
    test_mes_completo_abril_2026()
    test_elige_ultimo_mes_con_datos()
    test_df_vacio_retorna_none()
    test_mes_sin_feriados()
    print("OK — calendario_mes helper")
```

- [ ] **Step 2: Ejecutar el test — debe fallar con ImportError**

```bash
cd backend && python test_calendario_mes.py
```

Esperado: `ModuleNotFoundError: No module named 'app.services.calendario_mes'`.

- [ ] **Step 3: Implementar el helper**

Crear `backend/app/services/calendario_mes.py`:

```python
"""Construye la metadata del mes visualizado en el calendario de brigadas."""

import calendar as _cal
import pandas as pd
from app.config import FERIADOS_CL, MESES_MAP


def build_calendario_mes(filtered: pd.DataFrame) -> dict | None:
    """
    Devuelve la metadata del último mes con datos dentro del dataframe filtrado.

    Estructura de salida:
        {
            "mes": "abril",
            "año": 2026,
            "numero_mes": 4,
            "dias_en_mes": 30,
            "sabados": [4, 11, 18, 25],
            "domingos": [5, 12, 19, 26],
            "feriados": [3, 4],
            "total_habiles": 21,
        }

    Devuelve None si el dataframe está vacío o no tiene "Fecha ejecución".
    """
    if filtered is None or filtered.empty or "Fecha ejecución" not in filtered.columns:
        return None

    fechas = pd.to_datetime(filtered["Fecha ejecución"], errors="coerce").dropna()
    if fechas.empty:
        return None

    # Último mes con datos: mayor (año, mes) presente
    periodos = fechas.dt.to_period("M")
    ultimo = periodos.max()
    año = int(ultimo.year)
    numero_mes = int(ultimo.month)

    dias_en_mes = _cal.monthrange(año, numero_mes)[1]

    sabados: list[int] = []
    domingos: list[int] = []
    for d in range(1, dias_en_mes + 1):
        dow = pd.Timestamp(year=año, month=numero_mes, day=d).dayofweek  # 0=Lun, 5=Sáb, 6=Dom
        if dow == 5:
            sabados.append(d)
        elif dow == 6:
            domingos.append(d)

    feriados_año = FERIADOS_CL.get(año, set())
    feriados = sorted(d for (m, d) in feriados_año if m == numero_mes)

    no_habiles = set(sabados) | set(domingos) | set(feriados)
    total_habiles = dias_en_mes - len(no_habiles)

    return {
        "mes": MESES_MAP.get(numero_mes, str(numero_mes)),
        "año": año,
        "numero_mes": numero_mes,
        "dias_en_mes": dias_en_mes,
        "sabados": sabados,
        "domingos": domingos,
        "feriados": feriados,
        "total_habiles": total_habiles,
    }
```

- [ ] **Step 4: Ejecutar el test — debe pasar**

```bash
cd backend && python test_calendario_mes.py
```

Esperado: `OK — calendario_mes helper`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/calendario_mes.py backend/test_calendario_mes.py
git commit -m "feat(backend): helper build_calendario_mes para metadata del mes visualizado"
```

---

## Task 3: Extender `pago_tecnicos` con días trabajados

**Files:**
- Modify: `backend/app/services/pago_tecnicos.py`
- Test: `backend/test_dias_trabajados.py`

- [ ] **Step 1: Escribir test de verificación**

Crear `backend/test_dias_trabajados.py`:

```python
#!/usr/bin/env python3
"""Test de dias_trabajados en pago_tecnicos."""

import sys
sys.path.insert(0, '.')

import pandas as pd
from app.services.pago_tecnicos import calculate_pago_tecnicos


def _make_row(nombre, fecha, resultado="Normal", zona="07. RANCAGUA"):
    return {
        "Nombre asignado": nombre,
        "Fecha ejecución": pd.Timestamp(fecha),
        "Resultado visita": resultado,
        "Resultado final": "",
        "Tipo_CNR.Tipo de CNR": "",
        "Comuna": "Rancagua",
        "zona_tecnico": zona,
        "zona_inspeccion": zona,
        "regional_tecnico": "Centro",
    }


def test_dias_trabajados_cuenta_dias_unicos_del_ultimo_mes():
    # Mario en marzo 3 días diferentes, en abril 2 días — el calendario visualizado es abril
    rows = [
        _make_row("Mario Perez", "2026-03-05"),
        _make_row("Mario Perez", "2026-03-06"),
        _make_row("Mario Perez", "2026-03-07"),
        _make_row("Mario Perez", "2026-04-01"),
        _make_row("Mario Perez", "2026-04-01"),  # repetido mismo día
        _make_row("Mario Perez", "2026-04-15"),
    ]
    df = pd.DataFrame(rows)
    res = calculate_pago_tecnicos(df)
    mario = next((r for r in res if r["nombre"].upper().startswith("MARIO")), None)
    assert mario is not None, "Mario debe estar en el resultado"
    # dias_trabajados es del último mes con datos (abril): 1 y 15
    assert mario["dias_trabajados"] == [1, 15], f"Esperado [1,15], obtuvo {mario['dias_trabajados']}"
    assert mario["dias_trabajados_count"] == 2
    assert mario["sabados_trabajados_count"] == 0  # ni 1-abr ni 15-abr son sábado


def test_sabado_se_cuenta_correctamente():
    # 4 abril 2026 es sábado
    rows = [
        _make_row("Juan Soto", "2026-04-04"),
        _make_row("Juan Soto", "2026-04-07"),
    ]
    df = pd.DataFrame(rows)
    res = calculate_pago_tecnicos(df)
    juan = next((r for r in res if "JUAN" in r["nombre"].upper()), None)
    assert juan is not None
    assert juan["dias_trabajados"] == [4, 7]
    assert juan["dias_trabajados_count"] == 2
    assert juan["sabados_trabajados_count"] == 1


def test_sin_datos_devuelve_lista_vacia():
    df = pd.DataFrame(columns=[
        "Nombre asignado", "Fecha ejecución", "Resultado visita", "Resultado final",
        "Tipo_CNR.Tipo de CNR", "Comuna", "zona_tecnico", "zona_inspeccion", "regional_tecnico",
    ])
    assert calculate_pago_tecnicos(df) == []


if __name__ == "__main__":
    test_dias_trabajados_cuenta_dias_unicos_del_ultimo_mes()
    test_sabado_se_cuenta_correctamente()
    test_sin_datos_devuelve_lista_vacia()
    print("OK — dias_trabajados")
```

- [ ] **Step 2: Ejecutar el test — debe fallar**

```bash
cd backend && python test_dias_trabajados.py
```

Esperado: AssertionError porque `dias_trabajados` no existe aún en la salida.

- [ ] **Step 3: Extender `calculate_pago_tecnicos`**

Abrir `backend/app/services/pago_tecnicos.py`.

Justo después de la línea que calcula `df["es_sabado"]` (cerca de la línea 94), añadir el cálculo del "último mes con datos" y las columnas necesarias:

```python
    # Sábado = dayofweek 5
    df["es_sabado"] = (df["Fecha ejecución"].dt.dayofweek == 5).astype(int)

    # Último mes con datos (el que se visualiza en el calendario)
    fechas_validas = df["Fecha ejecución"].dropna()
    if not fechas_validas.empty:
        ultimo_periodo = fechas_validas.dt.to_period("M").max()
        año_cal = int(ultimo_periodo.year)
        mes_cal = int(ultimo_periodo.month)
    else:
        año_cal = None
        mes_cal = None

    df["_dia_mes"] = df["Fecha ejecución"].dt.day
    df["_año_mes_match"] = (
        (df["Fecha ejecución"].dt.year == año_cal) &
        (df["Fecha ejecución"].dt.month == mes_cal)
    ) if año_cal is not None else False
```

Buscar el bloque `agg = df.groupby("Nombre asignado", observed=True).agg(...)` y añadir estas claves adicionales dentro del `.agg(...)` justo después de `efectivas_sabado=("efectiva_sab", "sum"),`:

```python
        efectivas_sabado=("efectiva_sab", "sum"),
        # Nuevos campos para el calendario de brigadas
    ).reset_index()
```

Como `.agg()` no puede devolver listas, hacer una agregación aparte justo después del groupby. Después de la línea `).reset_index()` del agg principal, añadir:

```python
    # Agregación separada para días trabajados del último mes con datos
    if año_cal is not None:
        df_mes = df[df["_año_mes_match"]]
        if not df_mes.empty:
            dias_por_tec = (
                df_mes.groupby("Nombre asignado", observed=True)["_dia_mes"]
                .apply(lambda s: sorted(set(int(x) for x in s.dropna())))
                .reset_index(name="dias_trabajados")
            )
            # sábados trabajados (días únicos con es_sabado=1)
            sabs_por_tec = (
                df_mes[df_mes["es_sabado"] == 1]
                .groupby("Nombre asignado", observed=True)["_dia_mes"]
                .apply(lambda s: len(set(int(x) for x in s.dropna())))
                .reset_index(name="sabados_trabajados_count")
            )
        else:
            dias_por_tec = pd.DataFrame(columns=["Nombre asignado", "dias_trabajados"])
            sabs_por_tec = pd.DataFrame(columns=["Nombre asignado", "sabados_trabajados_count"])
    else:
        dias_por_tec = pd.DataFrame(columns=["Nombre asignado", "dias_trabajados"])
        sabs_por_tec = pd.DataFrame(columns=["Nombre asignado", "sabados_trabajados_count"])

    agg = agg.merge(dias_por_tec, on="Nombre asignado", how="left")
    agg = agg.merge(sabs_por_tec, on="Nombre asignado", how="left")
    agg["dias_trabajados"] = agg["dias_trabajados"].apply(lambda v: v if isinstance(v, list) else [])
    agg["sabados_trabajados_count"] = agg["sabados_trabajados_count"].fillna(0).astype(int)
```

Al final del archivo, dentro del loop que construye `out`, añadir los nuevos campos a cada dict:

```python
            "cumple_meta": bool(r["cumple_meta"]),
            "dias_trabajados": list(r["dias_trabajados"]) if isinstance(r["dias_trabajados"], list) else [],
            "dias_trabajados_count": int(len(r["dias_trabajados"])) if isinstance(r["dias_trabajados"], list) else 0,
            "sabados_trabajados_count": int(r["sabados_trabajados_count"]),
        })
```

- [ ] **Step 4: Ejecutar el test — debe pasar**

```bash
cd backend && python test_dias_trabajados.py
```

Esperado: `OK — dias_trabajados`.

- [ ] **Step 5: Verificar que no se rompieron los tests existentes de pago**

```bash
cd backend && python test_nuevos_calculos.py
```

Esperado: el script corre sin errores (mismo output que antes del cambio).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/pago_tecnicos.py backend/test_dias_trabajados.py
git commit -m "feat(backend): añadir dias_trabajados por brigada en pago_tecnicos"
```

---

## Task 4: Exponer `calendario_mes` en el endpoint `/dashboard`

**Files:**
- Modify: `backend/app/routers/dashboard.py`

- [ ] **Step 1: Añadir import**

Abrir `backend/app/routers/dashboard.py` y añadir junto a los otros imports de services:

```python
from app.services.calendario_mes import build_calendario_mes
```

- [ ] **Step 2: Incluir el campo en el payload del endpoint principal**

En la función `get_dashboard`, dentro del `return {...}`, justo después de `"pago_tecnicos": calculate_pago_tecnicos(filtered),` añadir:

```python
        "pago_tecnicos": calculate_pago_tecnicos(filtered),
        "calendario_mes": build_calendario_mes(filtered),
```

- [ ] **Step 3: Verificar manualmente llamando al endpoint**

Arrancar el backend (en otra terminal):

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

Consultar:

```bash
curl -s 'http://localhost:8000/api/v1/dashboard?año=2026' | python -c "import sys, json; d = json.load(sys.stdin); print('calendario_mes:', d.get('calendario_mes')); p = d.get('pago_tecnicos', []); print('primer técnico dias_trabajados:', p[0].get('dias_trabajados') if p else 'sin técnicos')"
```

Esperado: imprimir el dict de `calendario_mes` con claves `mes`, `año`, `numero_mes`, etc., y una lista de días para el primer técnico.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/dashboard.py
git commit -m "feat(backend): exponer calendario_mes en /api/v1/dashboard"
```

---

## Task 5: Tipos en frontend

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Añadir tipo `CalendarioMes`**

Abrir `frontend/src/types/index.ts`. Antes de `export interface DashboardData {` añadir:

```typescript
export interface CalendarioMes {
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

- [ ] **Step 2: Extender `PagoTecnico`**

En el mismo archivo, dentro de la interfaz `PagoTecnico` (línea ~157), añadir antes del cierre `}`:

```typescript
  cumple_meta: boolean;
  dias_trabajados: number[];
  dias_trabajados_count: number;
  sabados_trabajados_count: number;
}
```

- [ ] **Step 3: Extender `DashboardData`**

En la interfaz `DashboardData` (línea ~199), añadir el nuevo campo al final antes del `}`:

```typescript
  resultados_fallidos: ResultadoFallido[];
  resultados_fallidos_por_zona: Record<string, ResultadoFallido[]>;
  calendario_mes: CalendarioMes | null;
}
```

- [ ] **Step 4: Verificar que compila**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sin errores (o solo los errores preexistentes del proyecto — ninguno nuevo relacionado a los tipos añadidos).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(frontend): tipos CalendarioMes y extensión de PagoTecnico"
```

---

## Task 6: Default de `useDashboard`

**Files:**
- Modify: `frontend/src/hooks/useDashboard.ts`

- [ ] **Step 1: Añadir `calendario_mes: null` al objeto `defaultData`**

Abrir `frontend/src/hooks/useDashboard.ts`. En el objeto `defaultData` (línea ~5), añadir después de `resultados_fallidos_por_zona: {},`:

```typescript
  resultados_fallidos_por_zona: {},
  calendario_mes: null,
};
```

- [ ] **Step 2: Verificar tsc**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sin nuevos errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useDashboard.ts
git commit -m "feat(frontend): incluir calendario_mes en defaultData"
```

---

## Task 7: Componente `CalendarioBrigadas`

**Files:**
- Create: `frontend/src/components/views/CalendarioBrigadas.tsx`

- [ ] **Step 1: Crear el archivo con el componente completo**

Crear `frontend/src/components/views/CalendarioBrigadas.tsx`:

```tsx
'use client';

import React, { useMemo } from 'react';
import { PagoTecnico, CalendarioMes } from '@/types';

interface CalendarioBrigadasProps {
  pagoTecnicos: PagoTecnico[];
  calendario: CalendarioMes;
}

type TipoDia = 'habil' | 'sabado' | 'domingo' | 'feriado';

const INICIAL_DIA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']; // lunes=0 ... domingo=6

function dayOfWeekMon0(año: number, mes: number, dia: number): number {
  // JS Date: 0=Dom..6=Sáb. Convertimos a 0=Lun..6=Dom.
  const js = new Date(año, mes - 1, dia).getDay();
  return (js + 6) % 7;
}

function tipoDia(
  dia: number,
  sabados: Set<number>,
  domingos: Set<number>,
  feriados: Set<number>
): TipoDia {
  if (feriados.has(dia)) return 'feriado';
  if (sabados.has(dia)) return 'sabado';
  if (domingos.has(dia)) return 'domingo';
  return 'habil';
}

export default function CalendarioBrigadas({
  pagoTecnicos,
  calendario,
}: CalendarioBrigadasProps) {
  const sabadosSet = useMemo(() => new Set(calendario.sabados), [calendario.sabados]);
  const domingosSet = useMemo(() => new Set(calendario.domingos), [calendario.domingos]);
  const feriadosSet = useMemo(() => new Set(calendario.feriados), [calendario.feriados]);
  const dias = useMemo(
    () => Array.from({ length: calendario.dias_en_mes }, (_, i) => i + 1),
    [calendario.dias_en_mes]
  );

  const brigadasOperativas = useMemo(
    () => pagoTecnicos.filter((t) => t.dias_trabajados_count > 0),
    [pagoTecnicos]
  );

  const kpis = useMemo(() => {
    const operativas = brigadasOperativas.length;
    const totalDias = brigadasOperativas.reduce((a, t) => a + t.dias_trabajados_count, 0);
    const totalSabados = brigadasOperativas.reduce((a, t) => a + t.sabados_trabajados_count, 0);
    return {
      operativas,
      diasHabiles: calendario.total_habiles,
      promedioDias: operativas > 0 ? totalDias / operativas : 0,
      promedioSabados: operativas > 0 ? totalSabados / operativas : 0,
    };
  }, [brigadasOperativas, calendario.total_habiles]);

  // Agrupar por zona
  const porZona = useMemo(() => {
    const map: Record<string, PagoTecnico[]> = {};
    pagoTecnicos.forEach((t) => {
      const k = t.zona || '(sin zona)';
      if (!map[k]) map[k] = [];
      map[k].push(t);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => b.dias_trabajados_count - a.dias_trabajados_count)
    );
    const zonasOrdenadas = Object.keys(map).sort();
    return { map, zonasOrdenadas };
  }, [pagoTecnicos]);

  // Conteo operativas por día (fila de totales)
  const operativasPorDia = useMemo(() => {
    const arr = new Array(calendario.dias_en_mes + 1).fill(0);
    pagoTecnicos.forEach((t) => {
      t.dias_trabajados.forEach((d) => {
        if (d >= 1 && d <= calendario.dias_en_mes) arr[d] += 1;
      });
    });
    return arr;
  }, [pagoTecnicos, calendario.dias_en_mes]);

  // Estilos por tipo de día (columna)
  const bgCol: Record<TipoDia, string> = {
    habil: 'bg-white',
    sabado: 'bg-amber-50',
    domingo: 'bg-slate-50',
    feriado: 'bg-violet-50',
  };

  // Marca trabajada según tipo
  const dotClass = (trabajo: boolean, tipo: TipoDia): string => {
    if (!trabajo) {
      if (tipo === 'sabado') return 'bg-amber-100';
      if (tipo === 'feriado') return 'bg-violet-100';
      if (tipo === 'domingo') return 'bg-slate-100';
      return 'bg-slate-200';
    }
    switch (tipo) {
      case 'sabado':
        return 'bg-amber-500';
      case 'feriado':
        return 'bg-violet-500';
      case 'domingo':
        return 'bg-slate-400';
      default:
        return 'bg-oca-blue';
    }
  };

  const ausenciaColor = (aus: number): string => {
    if (aus <= 0) return 'text-slate-400';
    if (aus <= 3) return 'text-amber-600';
    return 'text-red-600 font-semibold';
  };

  const formatPct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Calendario Operativo · {calendario.mes} {calendario.año}
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {kpis.operativas} brigadas operativas · {calendario.dias_en_mes} días del mes · {calendario.total_habiles} hábiles
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Brigadas Operativas</p>
          <p className="text-2xl font-bold text-slate-800">{kpis.operativas}</p>
          <p className="text-[10px] text-slate-400 mt-1">de {pagoTecnicos.length} técnicos</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Días Hábiles del Mes</p>
          <p className="text-2xl font-bold text-slate-800">{kpis.diasHabiles}</p>
          <p className="text-[10px] text-slate-400 mt-1">Lun–Vie en {calendario.mes}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Promedio Días/Brigada</p>
          <p className="text-2xl font-bold text-slate-800">{kpis.promedioDias.toFixed(1)}</p>
          <p className="text-[10px] text-slate-400 mt-1">de {calendario.dias_en_mes} posibles</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Sábados Operados</p>
          <p className="text-2xl font-bold text-slate-800">{kpis.promedioSabados.toFixed(1)}</p>
          <p className="text-[10px] text-slate-400 mt-1">
            prom. por brigada · {calendario.sabados.length} sábados
          </p>
        </div>
      </div>

      {/* Matriz */}
      <div className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-[10px] border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500 min-w-[180px]">
                  Brigada
                </th>
                {dias.map((d) => {
                  const tipo = tipoDia(d, sabadosSet, domingosSet, feriadosSet);
                  return (
                    <th
                      key={`num-${d}`}
                      className={`px-0 py-1 text-center text-[10px] font-semibold text-slate-500 w-6 ${bgCol[tipo]}`}
                    >
                      {d}
                    </th>
                  );
                })}
                <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500 bg-slate-50 w-12">Trab</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500 bg-slate-50 w-12">Sáb</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500 bg-slate-50 w-14">Aus.H</th>
              </tr>
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 px-3 pb-1 text-left text-[9px] uppercase text-slate-400">
                  L/M/M/J/V/S/D
                </th>
                {dias.map((d) => {
                  const tipo = tipoDia(d, sabadosSet, domingosSet, feriadosSet);
                  const dow = dayOfWeekMon0(calendario.año, calendario.numero_mes, d);
                  return (
                    <th
                      key={`ini-${d}`}
                      className={`px-0 pb-1 text-center text-[9px] text-slate-400 ${bgCol[tipo]}`}
                    >
                      {INICIAL_DIA[dow]}
                    </th>
                  );
                })}
                <th className="bg-slate-50" />
                <th className="bg-slate-50" />
                <th className="bg-slate-50" />
              </tr>
            </thead>
            <tbody>
              {porZona.zonasOrdenadas.map((zona) => {
                const items = porZona.map[zona];
                const operZona = items.filter((t) => t.dias_trabajados_count > 0).length;
                const totDiasZona = items.reduce((a, t) => a + t.dias_trabajados_count, 0);
                const promZona = operZona > 0 ? totDiasZona / operZona : 0;
                return (
                  <React.Fragment key={zona}>
                    <tr className="bg-slate-800 text-white">
                      <td
                        className="sticky left-0 z-10 bg-slate-800 px-3 py-1.5 text-xs font-semibold"
                      >
                        {zona}
                      </td>
                      <td
                        className="px-2 py-1.5 text-[10px] text-slate-200"
                        colSpan={calendario.dias_en_mes + 3}
                      >
                        {operZona} brigadas activas · {totDiasZona} días trab · prom {promZona.toFixed(1)} d/brigada
                      </td>
                    </tr>
                    {items.map((t, idx) => {
                      const trabSet = new Set(t.dias_trabajados);
                      const diasHabilesTrabajados = t.dias_trabajados.filter(
                        (d) =>
                          !sabadosSet.has(d) &&
                          !domingosSet.has(d) &&
                          !feriadosSet.has(d)
                      ).length;
                      const ausenciasHabiles = calendario.total_habiles - diasHabilesTrabajados;
                      return (
                        <tr
                          key={`${zona}-${t.nombre}-${idx}`}
                          className="border-b border-slate-50 hover:bg-slate-50/50"
                        >
                          <td
                            className="sticky left-0 z-10 bg-white px-3 py-1 text-[11px] text-slate-700 truncate max-w-[180px]"
                            title={t.nombre}
                          >
                            {t.nombre}
                          </td>
                          {dias.map((d) => {
                            const tipo = tipoDia(d, sabadosSet, domingosSet, feriadosSet);
                            const trabajo = trabSet.has(d);
                            const dotCls = dotClass(trabajo, tipo);
                            return (
                              <td
                                key={`c-${t.nombre}-${d}`}
                                className={`px-0 py-1 text-center ${bgCol[tipo]}`}
                                title={`Día ${d}${trabajo ? ' · trabajado' : ''}`}
                              >
                                <span
                                  className={`inline-block w-1.5 h-1.5 rounded-full ${dotCls}`}
                                />
                              </td>
                            );
                          })}
                          <td className="px-2 py-1 text-right tabular-nums text-[11px] text-slate-700 font-semibold">
                            {t.dias_trabajados_count}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums text-[11px] text-amber-600">
                            {t.sabados_trabajados_count}
                          </td>
                          <td className={`px-2 py-1 text-right tabular-nums text-[11px] ${ausenciaColor(ausenciasHabiles)}`}>
                            {Math.max(0, ausenciasHabiles)}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300">
              <tr>
                <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase text-slate-500">
                  Brigadas operativas/día
                </td>
                {dias.map((d) => {
                  const tipo = tipoDia(d, sabadosSet, domingosSet, feriadosSet);
                  return (
                    <td
                      key={`tot-${d}`}
                      className={`px-0 py-1 text-center text-[10px] tabular-nums text-slate-600 ${bgCol[tipo]}`}
                    >
                      {operativasPorDia[d] || ''}
                    </td>
                  );
                })}
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-oca-blue" /> Trabajado hábil
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500" /> Sábado trabajado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-violet-500" /> Feriado trabajado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-50 border border-amber-200" /> Columna sábado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-slate-50 border border-slate-200" /> Columna domingo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-violet-50 border border-violet-200" /> Columna feriado
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/views/CalendarioBrigadas.tsx
git commit -m "feat(frontend): componente CalendarioBrigadas con matriz brigada x día"
```

---

## Task 8: Integrar `CalendarioBrigadas` en `ProduccionMensual`

**Files:**
- Modify: `frontend/src/components/views/ProduccionMensual.tsx`

- [ ] **Step 1: Añadir import y prop**

Abrir `frontend/src/components/views/ProduccionMensual.tsx`.

Reemplazar la línea de imports:

```tsx
import { PagoTecnico } from '@/types';
import { exportPagoExcel } from '@/lib/exportPagoExcel';
```

por:

```tsx
import { PagoTecnico, CalendarioMes } from '@/types';
import { exportPagoExcel } from '@/lib/exportPagoExcel';
import CalendarioBrigadas from './CalendarioBrigadas';
```

Reemplazar la interfaz de props:

```tsx
interface ProduccionMensualProps {
  pagoTecnicos: PagoTecnico[];
  mesesSeleccionados?: string[];
}
```

por:

```tsx
interface ProduccionMensualProps {
  pagoTecnicos: PagoTecnico[];
  mesesSeleccionados?: string[];
  calendarioMes?: CalendarioMes | null;
}
```

En la firma del componente:

```tsx
export default function ProduccionMensual({ pagoTecnicos, mesesSeleccionados }: ProduccionMensualProps) {
```

cambiar a:

```tsx
export default function ProduccionMensual({ pagoTecnicos, mesesSeleccionados, calendarioMes }: ProduccionMensualProps) {
```

- [ ] **Step 2: Renderizar la sección entre el bloque de brecha y el grid por zona**

Buscar el cierre del bloque "Análisis de Brecha" (la línea `</div>` que cierra el `<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">` tras el Top 10 Técnicos, seguido del comentario `{/* Búsqueda + filtro activo */}`).

Justo antes de `{/* Búsqueda + filtro activo */}` insertar:

```tsx
      {/* Calendario Operativo de Brigadas */}
      {calendarioMes && pagoTecnicos.some((t) => t.dias_trabajados_count > 0) && (
        <CalendarioBrigadas
          pagoTecnicos={tecnicosFiltrados}
          calendario={calendarioMes}
        />
      )}

      {/* Búsqueda + filtro activo */}
```

- [ ] **Step 3: Verificar tsc**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/views/ProduccionMensual.tsx
git commit -m "feat(frontend): integrar CalendarioBrigadas en ProduccionMensual"
```

---

## Task 9: Pasar `calendario_mes` desde `page.tsx`

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Localizar el render de `ProduccionMensual`**

Abrir `frontend/src/app/page.tsx` y buscar:

```bash
cd frontend && grep -n "ProduccionMensual" src/app/page.tsx
```

Encontrarás la línea ~140 donde se usa el componente.

- [ ] **Step 2: Pasar el prop**

Modificar el JSX de `<ProduccionMensual .../>` para añadir `calendarioMes={data.calendario_mes}`. Si el render actual es:

```tsx
<ProduccionMensual
  pagoTecnicos={data.pago_tecnicos}
  mesesSeleccionados={filters.mes}
/>
```

Reemplazar por:

```tsx
<ProduccionMensual
  pagoTecnicos={data.pago_tecnicos}
  mesesSeleccionados={filters.mes}
  calendarioMes={data.calendario_mes}
/>
```

- [ ] **Step 3: Verificar tsc**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sin errores nuevos.

- [ ] **Step 4: Verificación visual con dev server**

En una terminal:

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

En otra:

```bash
cd frontend && npm run dev
```

Abrir `http://localhost:3000` en el navegador. Navegar a la vista **Producción Mensual**. Verificar:
- Aparece el bloque "Calendario Operativo · {mes} {año}" entre el análisis de brecha y el grid por zona.
- Los 4 KPI cards tienen valores razonables.
- La matriz muestra brigadas agrupadas por zona.
- Los sábados (4, 11, 18, 25 en abril 2026) tienen fondo ámbar.
- Los domingos tienen fondo gris claro.
- Los feriados (3 y 4 abril si se está en 2026) tienen fondo lila.
- La fila de pie muestra conteo de brigadas operativas por día.
- Cambiar el filtro de mes — la matriz debe actualizarse al último mes con datos.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(frontend): pasar calendario_mes a ProduccionMensual"
```

---

## Task 10: Hoja "Calendario Brigadas" en Excel

**Files:**
- Modify: `frontend/src/lib/exportPagoExcel.ts`

- [ ] **Step 1: Extender `ExportOptions` y firma de `exportPagoExcel`**

Abrir `frontend/src/lib/exportPagoExcel.ts`.

Reemplazar el import inicial:

```ts
import ExcelJS from 'exceljs';
import { PagoTecnico } from '@/types';
```

por:

```ts
import ExcelJS from 'exceljs';
import { PagoTecnico, CalendarioMes } from '@/types';
```

Reemplazar:

```ts
export interface ExportOptions {
  scope?: 'global' | 'zona';
  zonaNombre?: string;
  periodo?: string;
}
```

por:

```ts
export interface ExportOptions {
  scope?: 'global' | 'zona';
  zonaNombre?: string;
  periodo?: string;
  calendarioMes?: CalendarioMes | null;
}
```

Y cambiar la destructuración en la función `exportPagoExcel`:

```ts
  const { scope = 'global', zonaNombre = '', periodo = 'Todo el período' } = options;
```

por:

```ts
  const { scope = 'global', zonaNombre = '', periodo = 'Todo el período', calendarioMes = null } = options;
```

- [ ] **Step 2: Añadir colores nuevos al objeto `COLORS`**

Buscar el objeto `COLORS` (~línea 7). Añadir estas claves:

```ts
const COLORS = {
  primary: 'FF294D6D',
  slate800: 'FF1E293B',
  slate500: 'FF64748B',
  slate200: 'FFE2E8F0',
  slate100: 'FFF1F5F9',
  slate50:  'FFF8FAFC',
  white:    'FFFFFFFF',
  green:    'FF10B981',
  red:      'FFDE473C',
  amber:    'FFF59E0B',
  amberSoft: 'FFFEF3C7',
  violet:    'FF8B5CF6',
  violetSoft:'FFEDE9FE',
  greenSoft: 'FFECFDF5',
  redSoft:   'FFFEF2F2',
};
```

- [ ] **Step 3: Añadir la nueva hoja antes de la hoja "Metodología"**

Justo antes de la sección `// Hoja 3: METODOLOGÍA` (buscar el comentario y la línea `const wsMeta = wb.addWorksheet('Metodología', ...)`), insertar el bloque completo de generación de la hoja de calendario:

```ts
  // -------------------------------------------------------------------------
  // Hoja 3: CALENDARIO BRIGADAS
  // -------------------------------------------------------------------------
  if (calendarioMes) {
    const wsCal = wb.addWorksheet('Calendario Brigadas', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
      views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }],
      properties: { defaultRowHeight: 14 },
    });

    const dias = Array.from({ length: calendarioMes.dias_en_mes }, (_, i) => i + 1);
    const sabadosSet = new Set(calendarioMes.sabados);
    const domingosSet = new Set(calendarioMes.domingos);
    const feriadosSet = new Set(calendarioMes.feriados);

    const tipoDia = (d: number): 'habil' | 'sabado' | 'domingo' | 'feriado' => {
      if (feriadosSet.has(d)) return 'feriado';
      if (sabadosSet.has(d)) return 'sabado';
      if (domingosSet.has(d)) return 'domingo';
      return 'habil';
    };

    const bgPorTipo = (tipo: 'habil' | 'sabado' | 'domingo' | 'feriado'): string => {
      switch (tipo) {
        case 'sabado': return COLORS.amberSoft;
        case 'domingo': return COLORS.slate100;
        case 'feriado': return COLORS.violetSoft;
        default: return COLORS.white;
      }
    };

    const colorMarca = (tipo: 'habil' | 'sabado' | 'domingo' | 'feriado'): string => {
      switch (tipo) {
        case 'sabado': return COLORS.amber;
        case 'feriado': return COLORS.violet;
        case 'domingo': return COLORS.slate500;
        default: return COLORS.primary;
      }
    };

    const totalCols = 2 + dias.length + 3;

    // Fila 1: título
    wsCal.mergeCells(1, 1, 1, totalCols);
    wsCal.getCell(1, 1).value = `Calendario Operativo — ${calendarioMes.mes} ${calendarioMes.año}`;
    wsCal.getCell(1, 1).font = { name: 'Inter', size: 14, bold: true, color: { argb: COLORS.slate800 } };
    wsCal.getRow(1).height = 22;

    // Fila 2: subtítulo
    wsCal.mergeCells(2, 1, 2, totalCols);
    const brigadasOp = pagoTecnicos.filter((t) => (t.dias_trabajados_count ?? 0) > 0).length;
    wsCal.getCell(2, 1).value = `Período: ${periodo} · ${brigadasOp} brigadas operativas · ${calendarioMes.total_habiles} días hábiles`;
    wsCal.getCell(2, 1).font = { name: 'Inter', size: 9, color: { argb: COLORS.slate500 } };
    wsCal.getRow(2).height = 14;

    // Fila 3: agrupadores
    wsCal.mergeCells(3, 1, 3, 2);
    wsCal.getCell(3, 1).value = 'Identidad';
    wsCal.mergeCells(3, 3, 3, 2 + dias.length);
    wsCal.getCell(3, 3).value = `Días del mes (${calendarioMes.dias_en_mes})`;
    wsCal.mergeCells(3, 3 + dias.length, 3, totalCols);
    wsCal.getCell(3, 3 + dias.length).value = 'Totales';
    [1, 3, 3 + dias.length].forEach((c) => {
      const cell = wsCal.getCell(3, c);
      cell.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
      cell.fill = headerFill(COLORS.slate800);
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = border('thin', COLORS.slate800);
    });
    wsCal.getRow(3).height = 18;

    // Fila 4: números de día + headers identidad/totales
    wsCal.getCell(4, 1).value = 'Brigada';
    wsCal.getCell(4, 2).value = 'Zona';
    dias.forEach((d, i) => {
      const cell = wsCal.getCell(4, 3 + i);
      cell.value = d;
      const tipo = tipoDia(d);
      cell.fill = headerFill(bgPorTipo(tipo));
      cell.font = { name: 'Inter', size: 8, bold: true, color: { argb: COLORS.slate500 } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = border('thin', COLORS.slate100);
    });
    ['Días Trab', 'Sáb Trab', 'Aus.H'].forEach((label, i) => {
      const cell = wsCal.getCell(4, 3 + dias.length + i);
      cell.value = label;
      cell.fill = headerFill(COLORS.slate800);
      cell.font = { name: 'Inter', size: 8, bold: true, color: { argb: COLORS.white } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = border('thin', COLORS.slate800);
    });
    [1, 2].forEach((c) => {
      const cell = wsCal.getCell(4, c);
      cell.fill = headerFill(COLORS.slate800);
      cell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = border('thin', COLORS.slate800);
    });
    wsCal.getRow(4).height = 18;

    // Fila 5: inicial día semana
    const INICIAL = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const dowMon0 = (d: number) => (new Date(calendarioMes.año, calendarioMes.numero_mes - 1, d).getDay() + 6) % 7;
    wsCal.getCell(5, 1).value = '';
    wsCal.getCell(5, 2).value = '';
    dias.forEach((d, i) => {
      const cell = wsCal.getCell(5, 3 + i);
      cell.value = INICIAL[dowMon0(d)];
      const tipo = tipoDia(d);
      cell.fill = headerFill(bgPorTipo(tipo));
      cell.font = { name: 'Inter', size: 8, color: { argb: COLORS.slate500 } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = border('thin', COLORS.slate100);
    });
    for (let c = 3 + dias.length; c <= totalCols; c++) {
      wsCal.getCell(5, c).fill = headerFill(COLORS.slate50);
      wsCal.getCell(5, c).border = border('thin', COLORS.slate100);
    }
    wsCal.getRow(5).height = 14;

    // Agrupar técnicos por zona
    const grupos = new Map<string, PagoTecnico[]>();
    pagoTecnicos.forEach((t) => {
      const z = t.zona || '(sin zona)';
      if (!grupos.has(z)) grupos.set(z, []);
      grupos.get(z)!.push(t);
    });
    const zonasOrdenadas = Array.from(grupos.keys()).sort();

    let r = 6;
    zonasOrdenadas.forEach((zona) => {
      const items = grupos.get(zona)!.slice().sort(
        (a, b) => (b.dias_trabajados_count ?? 0) - (a.dias_trabajados_count ?? 0)
      );
      const operZ = items.filter((t) => (t.dias_trabajados_count ?? 0) > 0).length;
      const totDiasZ = items.reduce((a, t) => a + (t.dias_trabajados_count ?? 0), 0);
      const promZ = operZ > 0 ? totDiasZ / operZ : 0;

      // Subheader zona
      wsCal.mergeCells(r, 1, r, totalCols);
      const cZona = wsCal.getCell(r, 1);
      cZona.value = `${zona}  ·  ${operZ} brigadas activas  ·  ${totDiasZ} días trab  ·  prom ${promZ.toFixed(1)}`;
      cZona.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
      cZona.fill = headerFill(COLORS.primary);
      cZona.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cZona.border = border('thin', COLORS.primary);
      wsCal.getRow(r).height = 18;
      r += 1;

      items.forEach((t) => {
        wsCal.getCell(r, 1).value = t.nombre;
        wsCal.getCell(r, 2).value = t.zona;
        [1, 2].forEach((c) => {
          const cell = wsCal.getCell(r, c);
          cell.font = { name: 'Inter', size: 9, color: { argb: COLORS.slate800 } };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.border = border('thin', COLORS.slate100);
        });

        const trabSet = new Set(t.dias_trabajados ?? []);
        let diasHabTrab = 0;
        dias.forEach((d, i) => {
          const tipo = tipoDia(d);
          const cell = wsCal.getCell(r, 3 + i);
          const trabajo = trabSet.has(d);
          if (trabajo) {
            cell.value = '●';
            cell.font = { name: 'Inter', size: 9, bold: true, color: { argb: colorMarca(tipo) } };
            if (tipo === 'habil') diasHabTrab += 1;
          } else {
            cell.value = '';
          }
          cell.fill = headerFill(bgPorTipo(tipo));
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = border('thin', COLORS.slate100);
        });

        const ausH = Math.max(0, calendarioMes.total_habiles - diasHabTrab);
        const totales: Array<[number, string]> = [
          [t.dias_trabajados_count ?? 0, COLORS.slate800],
          [t.sabados_trabajados_count ?? 0, COLORS.amber],
          [ausH, ausH === 0 ? COLORS.slate500 : ausH <= 3 ? COLORS.amber : COLORS.red],
        ];
        totales.forEach(([v, color], i) => {
          const cell = wsCal.getCell(r, 3 + dias.length + i);
          cell.value = v;
          cell.numFmt = numFmt;
          cell.font = { name: 'Inter', size: 9, bold: true, color: { argb: color } };
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.border = border('thin', COLORS.slate100);
        });

        r += 1;
      });
    });

    // Fila final: brigadas operativas por día
    wsCal.mergeCells(r, 1, r, 2);
    const cTotLbl = wsCal.getCell(r, 1);
    cTotLbl.value = 'Brigadas operativas/día';
    cTotLbl.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
    cTotLbl.fill = headerFill(COLORS.slate800);
    cTotLbl.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    cTotLbl.border = border('medium', COLORS.slate800);

    const operPorDia = new Array(calendarioMes.dias_en_mes + 1).fill(0);
    pagoTecnicos.forEach((t) => {
      (t.dias_trabajados ?? []).forEach((d) => {
        if (d >= 1 && d <= calendarioMes.dias_en_mes) operPorDia[d] += 1;
      });
    });
    dias.forEach((d, i) => {
      const cell = wsCal.getCell(r, 3 + i);
      cell.value = operPorDia[d];
      cell.numFmt = numFmt;
      const tipo = tipoDia(d);
      cell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.slate800 } };
      cell.fill = headerFill(bgPorTipo(tipo));
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = border('thin', COLORS.slate200);
    });
    [0, 1, 2].forEach((i) => {
      const cell = wsCal.getCell(r, 3 + dias.length + i);
      cell.fill = headerFill(COLORS.slate800);
      cell.border = border('medium', COLORS.slate800);
    });
    wsCal.getRow(r).height = 18;

    // Anchos de columna
    wsCal.getColumn(1).width = 30;
    wsCal.getColumn(2).width = 22;
    for (let i = 0; i < dias.length; i++) {
      wsCal.getColumn(3 + i).width = 3.2;
    }
    wsCal.getColumn(3 + dias.length).width = 10;
    wsCal.getColumn(3 + dias.length + 1).width = 10;
    wsCal.getColumn(3 + dias.length + 2).width = 10;
  }

```

- [ ] **Step 4: Ajustar la hoja "Metodología" para mencionar el calendario**

Buscar el array `explicaciones` en la hoja Metodología. Antes del cierre `];` añadir:

```ts
    { text: '' },
    { title: '6. Calendario Operativo de Brigadas' },
    { text: '   • Muestra, por brigada, qué días del mes trabajó (cualquier inspección registrada).' },
    { text: '   • Identifica sábados (ámbar), domingos (gris) y feriados (lila) como columnas destacadas.' },
    { text: '   • Totales por brigada: Días Trab, Sáb Trab y Ausencias Hábiles (Hábiles del mes − Días hábiles trabajados).' },
    { text: '   • Pie: número de brigadas operativas por cada día del mes visualizado.' },
    { text: '   • Mes visualizado: el último mes del período filtrado con al menos un registro.' },
```

- [ ] **Step 5: Actualizar el llamado a `exportPagoExcel` desde `ProduccionMensual.tsx`**

Abrir `frontend/src/components/views/ProduccionMensual.tsx`. Buscar las dos llamadas a `exportPagoExcel(...)` y añadir `calendarioMes` a las opciones.

Botón principal (cerca del header, línea ~212):

```tsx
          onClick={() => exportPagoExcel(tecnicosFiltrados, { scope: 'global', periodo })}
```

cambiar a:

```tsx
          onClick={() => exportPagoExcel(tecnicosFiltrados, { scope: 'global', periodo, calendarioMes })}
```

Botón del modal (cerca de la línea ~572):

```tsx
                onClick={() => exportPagoExcel(items, {
                  scope: vista.tipo === 'zona' ? 'zona' : 'global',
                  zonaNombre: vista.tipo === 'zona' ? vista.zona : '',
                  periodo,
                })}
```

cambiar a:

```tsx
                onClick={() => exportPagoExcel(items, {
                  scope: vista.tipo === 'zona' ? 'zona' : 'global',
                  zonaNombre: vista.tipo === 'zona' ? vista.zona : '',
                  periodo,
                  calendarioMes,
                })}
```

Para esto el modal necesita acceso a `calendarioMes`. Buscar la interfaz `DetalleModalProps` y el componente `DetalleModal` más abajo en el mismo archivo. Añadir `calendarioMes?: CalendarioMes | null;` a las props del modal y propagarlo:

En la firma de `DetalleModal`:

```tsx
function DetalleModal({ vista, onClose, onNavegar, onSeleccionarTecnico, periodo }: DetalleModalProps) {
```

cambiar a:

```tsx
function DetalleModal({ vista, onClose, onNavegar, onSeleccionarTecnico, periodo, calendarioMes }: DetalleModalProps) {
```

En `DetalleModalProps`:

```tsx
interface DetalleModalProps {
  vista: VistaDetalle;
  onClose: () => void;
  onNavegar: (dir: 'anterior' | 'siguiente') => void;
  onSeleccionarTecnico: (t: PagoTecnico) => void;
  periodo?: string;
  calendarioMes?: CalendarioMes | null;
}
```

En el render del modal (el JSX que pasa props al componente `DetalleModal`, línea ~499):

```tsx
        <DetalleModal
          vista={vistaDetalle}
          onClose={() => setVistaDetalle(null)}
          onNavegar={navegarTecnico}
          onSeleccionarTecnico={(t) => setVistaDetalle({ tipo: 'tecnico', tecnico: t })}
          periodo={periodo}
        />
```

cambiar a:

```tsx
        <DetalleModal
          vista={vistaDetalle}
          onClose={() => setVistaDetalle(null)}
          onNavegar={navegarTecnico}
          onSeleccionarTecnico={(t) => setVistaDetalle({ tipo: 'tecnico', tecnico: t })}
          periodo={periodo}
          calendarioMes={calendarioMes}
        />
```

- [ ] **Step 6: Verificar tsc**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 7: Verificación funcional**

En el navegador con el dev server corriendo:
1. Hacer click en "Descargar Excel" en la vista Producción Mensual.
2. Abrir el archivo `.xlsx` descargado.
3. Verificar que existen las hojas: "Resumen", "Detalle Técnicos", "Calendario Brigadas", "Metodología".
4. En "Calendario Brigadas":
   - Título correcto con mes y año.
   - Headers con números de día y letras L/M/M/J/V/S/D.
   - Columnas de sábado/domingo/feriado con colores de fondo.
   - Filas agrupadas por zona con subheader azul oca.
   - Marca `●` en los días trabajados con color según tipo de día.
   - Fila final con brigadas operativas por día.
   - Freeze panes funciona: al hacer scroll horizontal, columnas Brigada/Zona quedan fijas; al hacer scroll vertical, filas 1–5 quedan fijas.
5. En "Metodología": sección 6 sobre Calendario Operativo presente.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/exportPagoExcel.ts frontend/src/components/views/ProduccionMensual.tsx
git commit -m "feat(frontend): hoja Calendario Brigadas en el Excel exportado"
```

---

## Task 11: QA final

- [ ] **Step 1: Correr todos los tests backend nuevos**

```bash
cd backend && python test_calendario_mes.py && python test_dias_trabajados.py
```

Esperado: ambos imprimen "OK — ...".

- [ ] **Step 2: Correr tests previos existentes del proyecto (no deben romperse)**

```bash
cd backend && python test_nuevos_calculos.py
```

Esperado: mismo output que antes de los cambios, sin errores.

- [ ] **Step 3: Verificación visual completa en el dev server**

Con backend y frontend arrancados:
- Vista **Producción Mensual** muestra el Calendario Operativo entre el análisis de brecha y el grid por zona.
- KPIs principales (Total a Pago, Brecha, etc.) siguen mostrando los mismos valores que antes.
- Cambiar zona, mes y búsqueda en el filtro global — el calendario responde.
- Descargar Excel y verificar las 4 hojas.

- [ ] **Step 4: Commit final (si hay ajustes menores) o skip**

Si hubo ajustes durante el QA:

```bash
git add -A
git commit -m "fix: ajustes de QA en calendario de brigadas"
```

De lo contrario, no se requiere commit adicional.

---

## Resumen de commits esperados

1. `feat(backend): añadir FERIADOS_CL para 2025-2026`
2. `feat(backend): helper build_calendario_mes para metadata del mes visualizado`
3. `feat(backend): añadir dias_trabajados por brigada en pago_tecnicos`
4. `feat(backend): exponer calendario_mes en /api/v1/dashboard`
5. `feat(frontend): tipos CalendarioMes y extensión de PagoTecnico`
6. `feat(frontend): incluir calendario_mes en defaultData`
7. `feat(frontend): componente CalendarioBrigadas con matriz brigada x día`
8. `feat(frontend): integrar CalendarioBrigadas en ProduccionMensual`
9. `feat(frontend): pasar calendario_mes a ProduccionMensual`
10. `feat(frontend): hoja Calendario Brigadas en el Excel exportado`
11. (opcional) `fix: ajustes de QA en calendario de brigadas`
