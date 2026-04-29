# Informe Ejecutivo Mensual PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el módulo de exportación que genera el "Informe Ejecutivo Mensual" en PDF para CGE TUSAN, consumiendo los servicios analíticos existentes y combinando KPIs, comparativos MoM, gráficos y narrativa autogenerada.

**Architecture:** Backend FastAPI + ReportLab (PDF) + matplotlib (gráficos), reusando los servicios de `backend/app/services/` para no duplicar lógica de cálculo. Frontend Next.js con vista nueva conectada al sidebar; cliente API que descarga el blob PDF. Endpoint único `GET /api/v1/exports/informe-mensual?año=X&mes=Y`.

**Tech Stack:** Python 3.12, FastAPI, pandas, ReportLab 4.x, matplotlib 3.x, Next.js 14, React 18, TypeScript, Tailwind, lucide-react.

**Spec:** [`docs/superpowers/specs/2026-04-29-informe-ejecutivo-pdf-design.md`](../specs/2026-04-29-informe-ejecutivo-pdf-design.md)

---

## File Map

### Backend (NEW)
- `backend/app/services/exports/__init__.py` — package marker
- `backend/app/services/exports/context.py` — `InformeContext` dataclass + `build_context(año, mes)`
- `backend/app/services/exports/narrative.py` — funciones puras de redacción por reglas
- `backend/app/services/exports/charts.py` — generadores matplotlib → bytes PNG
- `backend/app/services/exports/pdf_builder.py` — composición ReportLab
- `backend/app/services/exports/informe_mensual.py` — orquestador `generar_informe_mensual(año, mes) -> bytes`
- `backend/app/routers/exports.py` — router FastAPI
- `backend/assets/logo_oca.png` — copia del logo desde `frontend/public/logo-oca.png`
- `backend/tests/__init__.py` — package marker (si no existe)
- `backend/tests/exports/__init__.py` — package marker
- `backend/tests/exports/test_narrative.py`
- `backend/tests/exports/test_charts.py`
- `backend/tests/exports/test_context.py`
- `backend/tests/exports/test_informe_mensual.py`

### Backend (MODIFY)
- `backend/requirements.txt` — añadir `reportlab>=4.0.0` y `matplotlib>=3.7.0`
- `backend/app/main.py` — registrar router `exports`

### Frontend (NEW)
- `frontend/src/components/views/ExportarInforme.tsx` — vista del módulo

### Frontend (MODIFY)
- `frontend/src/lib/api.ts` — añadir `downloadInformeMensual(año, mes)`
- `frontend/src/components/layout/Sidebar.tsx` — añadir entry "Exportar Informe" en sección "Herramientas"
- `frontend/src/app/page.tsx` — añadir `case 'exportar-informe'` en el `switch (activeTab)`

---

## Convenciones del repo

- **Tests existentes**: están en `backend/test_*.py` (raíz). Para este feature usamos un subdirectorio `backend/tests/exports/` para no contaminar la raíz. La invocación es desde `backend/` con `python -m pytest tests/exports/ -v`.
- **No hay `pytest` en `requirements.txt`** actualmente. Lo añadimos como dev dependency.
- **Venv**: `backend/venv/bin/python` y `backend/venv/bin/pip`. Ejecutar comandos desde `backend/`.

---

## Task 1: Añadir dependencias (reportlab, matplotlib, pytest)

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Añadir las dependencias al archivo**

Reemplazar el contenido de `backend/requirements.txt` por:

```
fastapi>=0.100.0
uvicorn[standard]>=0.22.0
pandas>=2.0.0
pyarrow>=12.0.0
python-multipart>=0.0.6
pydantic>=2.0.0
reportlab>=4.0.0
matplotlib>=3.7.0
pytest>=8.0.0
```

- [ ] **Step 2: Instalar en el venv**

Run: `backend/venv/bin/pip install -r backend/requirements.txt`
Expected: instalación exitosa de reportlab, matplotlib y pytest.

- [ ] **Step 3: Smoke check de los imports**

Run: `backend/venv/bin/python -c "import reportlab; import matplotlib; import pytest; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore(backend): añadir reportlab, matplotlib y pytest a requirements"
```

---

## Task 2: Copiar logo OCA al backend

**Files:**
- Create: `backend/assets/logo_oca.png` (copia binaria)

- [ ] **Step 1: Crear directorio y copiar el logo**

```bash
mkdir -p backend/assets
cp frontend/public/logo-oca.png backend/assets/logo_oca.png
```

- [ ] **Step 2: Verificar que el archivo se copió**

Run: `ls -la backend/assets/logo_oca.png`
Expected: archivo presente con > 0 bytes.

- [ ] **Step 3: Commit**

```bash
git add backend/assets/logo_oca.png
git commit -m "chore(backend): añadir logo OCA para portada de informes PDF"
```

---

## Task 3: Crear estructura del paquete `services/exports`

**Files:**
- Create: `backend/app/services/exports/__init__.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/exports/__init__.py`

- [ ] **Step 1: Crear los `__init__.py` vacíos**

`backend/app/services/exports/__init__.py`:
```python
```

`backend/tests/__init__.py`:
```python
```

`backend/tests/exports/__init__.py`:
```python
```

- [ ] **Step 2: Verificar que pytest descubre el paquete**

Run: `cd backend && venv/bin/python -m pytest tests/ --collect-only`
Expected: `no tests ran` (0 errores, no items colectados aún).

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/exports/__init__.py backend/tests/__init__.py backend/tests/exports/__init__.py
git commit -m "chore(backend): scaffold paquete services/exports y tests/exports"
```

---

## Task 4: Definir `InformeContext` y test base

**Files:**
- Create: `backend/app/services/exports/context.py`
- Create: `backend/tests/exports/test_context.py`

- [ ] **Step 1: Escribir el test de la dataclass**

`backend/tests/exports/test_context.py`:
```python
from app.services.exports.context import InformeContext, MesData


def test_informe_context_default_construction():
    actual = MesData(
        año=2026, mes=4, mes_nombre="Abril",
        kpis={"total_efectivas": 100},
        tecnicos=[],
        zonas=[],
        daily=[],
        produccion_total=1_000_000,
        visitas_fallidas_resp=[],
        resultados_fallidos=[],
        alertas={},
        calendario={"total_habiles": 22, "meta_efectivas": 176},
        promedio_efectivas_oficial=8.0,
        brigadas_unicas=51,
    )
    anterior = MesData(
        año=2026, mes=3, mes_nombre="Marzo",
        kpis={"total_efectivas": 90},
        tecnicos=[],
        zonas=[],
        daily=[],
        produccion_total=900_000,
        visitas_fallidas_resp=[],
        resultados_fallidos=[],
        alertas={},
        calendario={"total_habiles": 20, "meta_efectivas": 160},
        promedio_efectivas_oficial=7.5,
        brigadas_unicas=45,
    )
    ctx = InformeContext(actual=actual, anterior=anterior)

    assert ctx.actual.brigadas_unicas == 51
    assert ctx.anterior.brigadas_unicas == 45
    assert ctx.delta_brigadas == 6
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `cd backend && venv/bin/python -m pytest tests/exports/test_context.py -v`
Expected: ImportError porque `app.services.exports.context` no existe.

- [ ] **Step 3: Implementar `context.py`**

`backend/app/services/exports/context.py`:
```python
from dataclasses import dataclass
from typing import Any


@dataclass
class MesData:
    """Datos consolidados de un mes para el informe."""
    año: int
    mes: int
    mes_nombre: str
    kpis: dict
    tecnicos: list
    zonas: list
    daily: list
    produccion_total: float
    visitas_fallidas_resp: list
    resultados_fallidos: list
    alertas: dict
    calendario: dict | None
    promedio_efectivas_oficial: float
    brigadas_unicas: int


@dataclass
class InformeContext:
    """Contexto completo del informe: mes actual + mes anterior (para comparativos)."""
    actual: MesData
    anterior: MesData | None  # None si no hay mes anterior con datos

    @property
    def delta_brigadas(self) -> int:
        if self.anterior is None:
            return 0
        return self.actual.brigadas_unicas - self.anterior.brigadas_unicas
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `cd backend && venv/bin/python -m pytest tests/exports/test_context.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/exports/context.py backend/tests/exports/test_context.py
git commit -m "feat(exports): InformeContext y MesData para datos consolidados del informe"
```

---

## Task 5: Implementar `build_context` (orquestación de servicios)

**Files:**
- Modify: `backend/app/services/exports/context.py`
- Modify: `backend/tests/exports/test_context.py`

- [ ] **Step 1: Escribir test que filtra por mes y construye contexto**

Añadir al final de `backend/tests/exports/test_context.py`:
```python
import pytest
from app.services.exports.context import build_context


def test_build_context_returns_data_for_existing_month():
    """Smoke test: construye contexto para un mes que existe en el dataset."""
    from app.dependencies import get_dataframe
    df = get_dataframe()
    años_disponibles = sorted(df['año'].dropna().unique().tolist())
    if not años_disponibles:
        pytest.skip("No hay datos en el dataset")
    año = int(años_disponibles[-1])
    meses_año = sorted(df[df['año'] == año]['mes'].dropna().unique().tolist())
    mes = int(meses_año[-1])

    ctx = build_context(año, mes)

    assert ctx.actual.año == año
    assert ctx.actual.mes == mes
    assert ctx.actual.kpis is not None
    assert isinstance(ctx.actual.brigadas_unicas, int)
    assert ctx.actual.brigadas_unicas >= 0


def test_build_context_raises_on_missing_month():
    """Mes sin datos lanza ValueError."""
    with pytest.raises(ValueError, match="No hay datos"):
        build_context(1900, 1)
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `cd backend && venv/bin/python -m pytest tests/exports/test_context.py -v`
Expected: ImportError de `build_context`.

- [ ] **Step 3: Implementar `build_context`**

Añadir al final de `backend/app/services/exports/context.py`:
```python
import calendar
import pandas as pd

from app.config import MESES_MAP
from app.dependencies import get_dataframe
from app.services.kpis import calculate_kpis
from app.services.tecnicos import calculate_tecnicos
from app.services.zonas import calculate_zonas
from app.services.daily import calculate_daily
from app.services.produccion import calculate_produccion
from app.services.pago_tecnicos import calculate_pago_tecnicos
from app.services.visitas_fallidas import calculate_visitas_fallidas
from app.services.resultados_fallidos import calculate_resultados_fallidos
from app.services.alertas_operativas import calculate_alertas_operativas
from app.services.calendario_mes import compute_estructura_mes, compute_meta_efectivas
from app.services.promedio_efectivas import calculate_promedio_efectivas


def _filter_mes(df: pd.DataFrame, año: int, mes: int) -> pd.DataFrame:
    return df[(df['año'] == año) & (df['mes'] == mes)].copy()


def _previous_month(año: int, mes: int) -> tuple[int, int]:
    if mes == 1:
        return año - 1, 12
    return año, mes - 1


def _build_mes_data(filtered: pd.DataFrame, año: int, mes: int) -> MesData:
    mes_nombre = MESES_MAP.get(mes, str(mes)).capitalize()
    kpis = calculate_kpis(filtered)
    tecnicos = calculate_tecnicos(filtered)
    kpis.update(calculate_promedio_efectivas(tecnicos, kpis.get("total_visita_fallida_cge", 0)))

    pago = calculate_pago_tecnicos(filtered)
    produccion_total = sum(t.get("total_pago", 0) for t in pago)

    estructura = compute_estructura_mes(año, mes)
    calendario = {
        **estructura,
        "meta_efectivas": compute_meta_efectivas(estructura["total_habiles"]),
    }

    return MesData(
        año=año,
        mes=mes,
        mes_nombre=mes_nombre,
        kpis=kpis,
        tecnicos=tecnicos,
        zonas=calculate_zonas(filtered),
        daily=calculate_daily(filtered),
        produccion_total=produccion_total,
        visitas_fallidas_resp=calculate_visitas_fallidas(filtered),
        resultados_fallidos=calculate_resultados_fallidos(filtered),
        alertas=calculate_alertas_operativas(filtered, año, [mes_nombre.lower()]),
        calendario=calendario,
        promedio_efectivas_oficial=float(kpis.get("promedio_efectivas_oficial", 0.0)),
        brigadas_unicas=int(kpis.get("total_brigadas_unicas", 0)),
    )


def build_context(año: int, mes: int) -> InformeContext:
    """
    Construye el InformeContext consolidando datos del mes actual y mes anterior.
    Lanza ValueError si el mes solicitado no tiene datos.
    """
    df = get_dataframe()
    filtered_actual = _filter_mes(df, año, mes)
    if filtered_actual.empty:
        raise ValueError(f"No hay datos para {año}-{mes:02d}")

    actual = _build_mes_data(filtered_actual, año, mes)

    año_prev, mes_prev = _previous_month(año, mes)
    filtered_prev = _filter_mes(df, año_prev, mes_prev)
    anterior = _build_mes_data(filtered_prev, año_prev, mes_prev) if not filtered_prev.empty else None

    return InformeContext(actual=actual, anterior=anterior)
```

- [ ] **Step 4: Correr los tests (deben pasar)**

Run: `cd backend && venv/bin/python -m pytest tests/exports/test_context.py -v`
Expected: ambos tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/exports/context.py backend/tests/exports/test_context.py
git commit -m "feat(exports): build_context orquesta servicios para mes actual + anterior"
```

---

## Task 6: Implementar `narrative.py` — narradores por sección

**Files:**
- Create: `backend/app/services/exports/narrative.py`
- Create: `backend/tests/exports/test_narrative.py`

- [ ] **Step 1: Escribir tests para los narradores**

`backend/tests/exports/test_narrative.py`:
```python
from app.services.exports.context import InformeContext, MesData
from app.services.exports.narrative import (
    narrar_contexto,
    narrar_pulso,
    narrar_visitas_fallidas,
    narrar_plan_accion,
)


def _mes(brigadas=51, prom=7.2, vf_cge=10, total_efectivas=1000, prod=10_000_000):
    return MesData(
        año=2026, mes=4, mes_nombre="Abril",
        kpis={
            "total_efectivas": total_efectivas,
            "total_visita_fallida_cge": vf_cge,
            "total_visita_fallida": 100,
            "pct_efectivas": 78.0,
            "pct_efectivas_sin_cge_excluida": 84.0,
            "pct_cnr": 18.5,
            "total_registros": 1280,
            "promedio_efectivas_oficial": prom,
        },
        tecnicos=[], zonas=[], daily=[], produccion_total=prod,
        visitas_fallidas_resp=[], resultados_fallidos=[], alertas={},
        calendario={"total_habiles": 22, "meta_efectivas": 176},
        promedio_efectivas_oficial=prom,
        brigadas_unicas=brigadas,
    )


def test_narrar_contexto_con_incremento_brigadas():
    ctx = InformeContext(actual=_mes(brigadas=51), anterior=_mes(brigadas=45))
    texto = narrar_contexto(ctx)
    assert "51" in texto
    assert "incremento" in texto.lower()
    assert "marzo" in texto.lower() or "anterior" in texto.lower()


def test_narrar_contexto_sin_mes_anterior():
    ctx = InformeContext(actual=_mes(brigadas=51), anterior=None)
    texto = narrar_contexto(ctx)
    assert "51" in texto
    assert "sin comparativo" in texto.lower() or "primer mes" in texto.lower()


def test_narrar_pulso_promedio_subio():
    ctx = InformeContext(actual=_mes(prom=8.0), anterior=_mes(prom=7.0))
    texto = narrar_pulso(ctx)
    assert "subió" in texto.lower() or "incrementó" in texto.lower()


def test_narrar_pulso_promedio_bajo():
    ctx = InformeContext(actual=_mes(prom=6.5), anterior=_mes(prom=7.5))
    texto = narrar_pulso(ctx)
    assert "bajó" in texto.lower() or "curva de aprendizaje" in texto.lower()


def test_narrar_visitas_fallidas_efectividad_ajustada():
    ctx = InformeContext(actual=_mes(), anterior=None)
    texto = narrar_visitas_fallidas(ctx)
    assert "78" in texto or "84" in texto


def test_narrar_plan_accion_devuelve_bullets():
    ctx = InformeContext(actual=_mes(), anterior=_mes(brigadas=45))
    bullets = narrar_plan_accion(ctx)
    assert isinstance(bullets, list)
    assert len(bullets) >= 1
    assert all(isinstance(b, str) and len(b) > 10 for b in bullets)
```

- [ ] **Step 2: Correr tests (deben fallar)**

Run: `cd backend && venv/bin/python -m pytest tests/exports/test_narrative.py -v`
Expected: ImportError o todos los tests fallan.

- [ ] **Step 3: Implementar narradores**

`backend/app/services/exports/narrative.py`:
```python
from app.services.exports.context import InformeContext


META_PROMEDIO_DIARIO = 8.0
META_CNR_PCT = 20.0
META_EFECTIVAS_PCT = 80.0


def _safe_pct(num: float, den: float) -> float:
    return (num / den * 100) if den else 0.0


def narrar_contexto(ctx: InformeContext) -> str:
    actual = ctx.actual
    if ctx.anterior is None:
        return (
            f"Este mes de {actual.mes_nombre} {actual.año} iniciamos la operación con un total de "
            f"{actual.brigadas_unicas} brigadas. Este es el primer mes con datos disponibles, por lo "
            f"que no aplica comparativo con el período anterior (sin comparativo previo)."
        )
    anterior = ctx.anterior
    delta = ctx.delta_brigadas
    if delta > 0:
        cambio = f"un incremento respecto a las {anterior.brigadas_unicas} brigadas operativas en {anterior.mes_nombre}"
    elif delta < 0:
        cambio = f"una reducción respecto a las {anterior.brigadas_unicas} brigadas en {anterior.mes_nombre}"
    else:
        cambio = f"misma dotación que en {anterior.mes_nombre} ({anterior.brigadas_unicas} brigadas)"
    dias_habiles = actual.calendario.get("total_habiles", 0) if actual.calendario else 0
    return (
        f"Este mes de {actual.mes_nombre} {actual.año} representa un período de operación con un total de "
        f"{actual.brigadas_unicas} brigadas, lo que supone {cambio}. "
        f"El período comprende {dias_habiles} días hábiles de operación."
    )


def narrar_pulso(ctx: InformeContext) -> str:
    actual = ctx.actual
    prom_actual = actual.promedio_efectivas_oficial
    if ctx.anterior is None:
        return (
            f"El promedio de efectivas diarias consolidado se ubicó en {prom_actual:.1f}, "
            f"contra una meta de {META_PROMEDIO_DIARIO:.1f} efectivas por día."
        )
    prom_anterior = ctx.anterior.promedio_efectivas_oficial
    delta = prom_actual - prom_anterior
    if delta > 0.3:
        tendencia = "subió"
        explicacion = "lo que refleja una operación en mayor ritmo respecto al mes anterior."
    elif delta < -0.3:
        tendencia = "bajó"
        explicacion = (
            "lo que se explica probablemente por la curva de aprendizaje de las brigadas "
            "recientemente activadas y por factores operativos del período."
        )
    else:
        tendencia = "se mantuvo estable"
        explicacion = "consolidando el ritmo del período anterior."
    return (
        f"El promedio de efectivas diarias consolidado se situó en {prom_actual:.1f}. "
        f"Al comparar con {ctx.anterior.mes_nombre} ({prom_anterior:.1f}), el indicador {tendencia}, "
        f"{explicacion}"
    )


def narrar_visitas_fallidas(ctx: InformeContext) -> str:
    k = ctx.actual.kpis
    pct_real = float(k.get("pct_efectivas", 0))
    pct_ajustada = float(k.get("pct_efectivas_sin_cge_excluida", 0))
    delta = pct_ajustada - pct_real
    vf_cge = int(k.get("total_visita_fallida_cge", 0))
    vf_total = int(k.get("total_visita_fallida", 0))
    pct_cge = _safe_pct(vf_cge, vf_total)
    if delta > 5:
        cierre = (
            "Esto demuestra que factores externos (responsabilidad CGE) pesan significativamente "
            "sobre el indicador final de efectividad."
        )
    else:
        cierre = "El impacto de factores externos es acotado en el período."
    return (
        f"De las {vf_total} visitas fallidas totales del período, el {pct_cge:.1f}% corresponden a "
        f"responsabilidad CGE. La efectividad real fue {pct_real:.1f}%, mientras que la efectividad "
        f"ajustada (excluyendo responsabilidad CGE) sube a {pct_ajustada:.1f}%. {cierre}"
    )


def narrar_plan_accion(ctx: InformeContext) -> list[str]:
    actual = ctx.actual
    bullets: list[str] = []
    k = actual.kpis
    pct_efectivas = float(k.get("pct_efectivas", 0))
    pct_cnr = float(k.get("pct_cnr", 0))
    vf_cge = int(k.get("total_visita_fallida_cge", 0))
    vf_total = int(k.get("total_visita_fallida", 0))
    pct_cge = _safe_pct(vf_cge, vf_total)

    if pct_cge > 30:
        bullets.append(
            f"Trabajar en conjunto con CGE para mitigar las causas de falla externas, "
            f"que representan el {pct_cge:.1f}% de las visitas fallidas del período."
        )

    no_cumplen = sum(1 for t in actual.tecnicos if not t.get("cumple_meta_global", False))
    if no_cumplen > 0:
        bullets.append(
            f"Reforzar el acompañamiento operativo a las {no_cumplen} brigadas que no alcanzaron "
            f"la meta de efectivas/día, con foco en las de reciente activación."
        )

    if pct_cnr > META_CNR_PCT:
        bullets.append(
            f"Revisar la calidad de la información de terreno: el CNR del {pct_cnr:.1f}% supera "
            f"el umbral contractual del {META_CNR_PCT:.0f}%."
        )

    if pct_efectivas < META_EFECTIVAS_PCT:
        bullets.append(
            f"Ejecutar plan de cierre de brecha en zonas con menor desempeño para acercar el "
            f"% de visita efectiva ({pct_efectivas:.1f}%) a la meta ({META_EFECTIVAS_PCT:.0f}%)."
        )

    if not bullets:
        bullets.append(
            "Mantener el ritmo operativo del período y consolidar las prácticas de las brigadas "
            "que destacaron en cumplimiento de meta."
        )
    return bullets
```

- [ ] **Step 4: Correr tests (deben pasar)**

Run: `cd backend && venv/bin/python -m pytest tests/exports/test_narrative.py -v`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/exports/narrative.py backend/tests/exports/test_narrative.py
git commit -m "feat(exports): motor de narrativa por reglas heurísticas"
```

---

## Task 7: Implementar `charts.py` — generadores matplotlib

**Files:**
- Create: `backend/app/services/exports/charts.py`
- Create: `backend/tests/exports/test_charts.py`

- [ ] **Step 1: Escribir tests smoke**

`backend/tests/exports/test_charts.py`:
```python
import struct

from app.services.exports.charts import (
    chart_tendencia_diaria,
    chart_top_bottom_brigadas,
    chart_zonas_actual_vs_anterior,
)


def _is_png(blob: bytes) -> bool:
    """PNG signature: 89 50 4E 47 0D 0A 1A 0A."""
    return len(blob) > 8 and blob[:8] == b"\x89PNG\r\n\x1a\n"


def test_chart_tendencia_diaria_returns_png_bytes():
    daily = [
        {"fecha": "2026-04-01", "dia": 1, "cnr": 30, "normal": 100, "visita_fallida": 10},
        {"fecha": "2026-04-02", "dia": 2, "cnr": 25, "normal": 95, "visita_fallida": 8},
        {"fecha": "2026-04-03", "dia": 3, "cnr": 28, "normal": 110, "visita_fallida": 12},
    ]
    blob = chart_tendencia_diaria(daily, meta_diaria=8.0, brigadas=51)
    assert _is_png(blob)
    assert len(blob) > 1000


def test_chart_top_bottom_brigadas_returns_png_bytes():
    tecnicos = [
        {"nombre": f"Tec {i}", "promedio_efectivas_global": 8.0 + i * 0.1, "cumple_meta_global": i >= 5}
        for i in range(15)
    ]
    blob = chart_top_bottom_brigadas(tecnicos)
    assert _is_png(blob)


def test_chart_zonas_actual_vs_anterior_returns_png_bytes():
    actual = [
        {"zona": "Zona Norte", "pct_efectivas": 80.0},
        {"zona": "Zona Centro", "pct_efectivas": 75.0},
    ]
    anterior = [
        {"zona": "Zona Norte", "pct_efectivas": 78.0},
        {"zona": "Zona Centro", "pct_efectivas": 73.0},
    ]
    blob = chart_zonas_actual_vs_anterior(actual, anterior)
    assert _is_png(blob)


def test_chart_zonas_sin_anterior_devuelve_png():
    actual = [{"zona": "Zona A", "pct_efectivas": 80.0}]
    blob = chart_zonas_actual_vs_anterior(actual, None)
    assert _is_png(blob)
```

- [ ] **Step 2: Correr tests (deben fallar)**

Run: `cd backend && venv/bin/python -m pytest tests/exports/test_charts.py -v`
Expected: ImportError.

- [ ] **Step 3: Implementar `charts.py`**

`backend/app/services/exports/charts.py`:
```python
import io

import matplotlib

matplotlib.use("Agg")  # backend sin GUI; obligatorio en servidor
import matplotlib.pyplot as plt


COLOR_PRIMARY = "#294D6D"
COLOR_SECONDARY = "#94A3B8"
COLOR_GREEN = "#10B981"
COLOR_RED = "#DE473C"
COLOR_GRID = "#F1F5F9"
COLOR_TEXT = "#1E293B"


def _new_figure(width_in: float = 6.3, height_in: float = 2.6):
    fig, ax = plt.subplots(figsize=(width_in, height_in), dpi=150)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax.spines[spine].set_color("#CBD5E1")
    ax.tick_params(colors=COLOR_TEXT, labelsize=8)
    return fig, ax


def _save_png(fig) -> bytes:
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def chart_tendencia_diaria(daily: list[dict], meta_diaria: float, brigadas: int) -> bytes:
    """Línea: efectivas/día con línea horizontal en meta * brigadas."""
    if not daily:
        fig, ax = _new_figure()
        ax.text(0.5, 0.5, "Sin datos diarios", ha="center", va="center",
                color=COLOR_SECONDARY, transform=ax.transAxes)
        return _save_png(fig)

    dias = [d.get("dia", 0) for d in daily]
    efectivas = [int(d.get("normal", 0)) + int(d.get("cnr", 0)) for d in daily]
    fig, ax = _new_figure()
    ax.plot(dias, efectivas, color=COLOR_PRIMARY, linewidth=2, marker="o", markersize=4)
    meta_total = meta_diaria * max(brigadas, 1)
    ax.axhline(meta_total, color=COLOR_RED, linestyle="--", linewidth=1, alpha=0.6,
               label=f"Meta diaria ({meta_total:.0f})")
    ax.set_xlabel("Día", fontsize=8, color=COLOR_TEXT)
    ax.set_ylabel("Efectivas", fontsize=8, color=COLOR_TEXT)
    ax.set_title("Tendencia diaria de efectivas", fontsize=10, color=COLOR_TEXT, loc="left")
    ax.grid(True, color=COLOR_GRID, linewidth=0.5)
    ax.legend(loc="upper right", fontsize=7, frameon=False)
    return _save_png(fig)


def chart_top_bottom_brigadas(tecnicos: list[dict], n: int = 10) -> bytes:
    """Barras horizontales: Top N y Bottom N por promedio_efectivas_global."""
    if not tecnicos:
        fig, ax = _new_figure()
        ax.text(0.5, 0.5, "Sin brigadas", ha="center", va="center",
                color=COLOR_SECONDARY, transform=ax.transAxes)
        return _save_png(fig)

    ordenados = sorted(tecnicos, key=lambda t: t.get("promedio_efectivas_global", 0), reverse=True)
    top = ordenados[:n]
    bottom = ordenados[-n:][::-1] if len(ordenados) > n else []

    fig, axes = plt.subplots(1, 2, figsize=(7.5, 3.0), dpi=150)
    fig.patch.set_facecolor("white")
    for ax, datos, titulo, color in (
        (axes[0], top, f"Top {len(top)} brigadas", COLOR_GREEN),
        (axes[1], bottom, f"Bottom {len(bottom)} brigadas", COLOR_RED),
    ):
        ax.set_facecolor("white")
        for spine in ("top", "right"):
            ax.spines[spine].set_visible(False)
        if not datos:
            ax.text(0.5, 0.5, "Sin datos", ha="center", va="center", transform=ax.transAxes)
            ax.set_title(titulo, fontsize=10, color=COLOR_TEXT, loc="left")
            continue
        nombres = [t.get("nombre", "")[:24] for t in datos]
        valores = [float(t.get("promedio_efectivas_global", 0)) for t in datos]
        ax.barh(range(len(datos)), valores, color=color, height=0.7)
        ax.set_yticks(range(len(datos)))
        ax.set_yticklabels(nombres, fontsize=7, color=COLOR_TEXT)
        ax.invert_yaxis()
        ax.set_xlabel("Efectivas/día", fontsize=8, color=COLOR_TEXT)
        ax.set_title(titulo, fontsize=10, color=COLOR_TEXT, loc="left")
        ax.tick_params(colors=COLOR_TEXT, labelsize=7)
        ax.grid(True, axis="x", color=COLOR_GRID, linewidth=0.5)
    return _save_png(fig)


def chart_zonas_actual_vs_anterior(actual: list[dict], anterior: list[dict] | None) -> bytes:
    """Barras agrupadas: % efectivas por zona (mes actual vs anterior)."""
    if not actual:
        fig, ax = _new_figure()
        ax.text(0.5, 0.5, "Sin datos de zonas", ha="center", va="center",
                color=COLOR_SECONDARY, transform=ax.transAxes)
        return _save_png(fig)

    nombres = [z.get("zona", "")[:20] for z in actual]
    valores_act = [float(z.get("pct_efectivas", 0)) for z in actual]
    anterior_map = {z.get("zona"): float(z.get("pct_efectivas", 0)) for z in (anterior or [])}
    valores_ant = [anterior_map.get(z.get("zona"), 0.0) for z in actual]

    fig, ax = _new_figure(width_in=7.0, height_in=3.0)
    x = list(range(len(nombres)))
    width = 0.35
    ax.bar([i - width / 2 for i in x], valores_act, width, color=COLOR_PRIMARY, label="Mes actual")
    if anterior is not None:
        ax.bar([i + width / 2 for i in x], valores_ant, width, color=COLOR_SECONDARY, label="Mes anterior")
    ax.set_xticks(x)
    ax.set_xticklabels(nombres, fontsize=7, color=COLOR_TEXT, rotation=30, ha="right")
    ax.set_ylabel("% Efectivas", fontsize=8, color=COLOR_TEXT)
    ax.set_title("Desempeño por zona (% efectivas)", fontsize=10, color=COLOR_TEXT, loc="left")
    ax.grid(True, axis="y", color=COLOR_GRID, linewidth=0.5)
    ax.legend(loc="upper right", fontsize=7, frameon=False)
    return _save_png(fig)
```

- [ ] **Step 4: Correr tests (deben pasar)**

Run: `cd backend && venv/bin/python -m pytest tests/exports/test_charts.py -v`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/exports/charts.py backend/tests/exports/test_charts.py
git commit -m "feat(exports): generadores matplotlib para gráficos del informe PDF"
```

---

## Task 8: Implementar `pdf_builder.py` — composición ReportLab

**Files:**
- Create: `backend/app/services/exports/pdf_builder.py`

(Sin tests dedicados — se valida en el test de integración del Task 9.)

- [ ] **Step 1: Implementar el builder completo**

`backend/app/services/exports/pdf_builder.py`:
```python
import io
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.services.exports.charts import (
    chart_tendencia_diaria,
    chart_top_bottom_brigadas,
    chart_zonas_actual_vs_anterior,
)
from app.services.exports.context import InformeContext
from app.services.exports.narrative import (
    narrar_contexto,
    narrar_pulso,
    narrar_visitas_fallidas,
    narrar_plan_accion,
    META_PROMEDIO_DIARIO,
    META_CNR_PCT,
    META_EFECTIVAS_PCT,
)


# Paleta OCA
OCA_BLUE = colors.HexColor("#294D6D")
OCA_BLUE_LIGHT = colors.HexColor("#4A7BA7")
SLATE_800 = colors.HexColor("#1E293B")
SLATE_500 = colors.HexColor("#64748B")
SLATE_200 = colors.HexColor("#E2E8F0")
SLATE_50 = colors.HexColor("#F8FAFC")
GREEN = colors.HexColor("#10B981")
RED = colors.HexColor("#DE473C")
AMBER = colors.HexColor("#F59E0B")

LOGO_PATH = Path(__file__).resolve().parents[3] / "assets" / "logo_oca.png"


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontSize=24,
                                textColor=OCA_BLUE, alignment=TA_CENTER, spaceAfter=10),
        "subtitle": ParagraphStyle("subtitle", parent=base["Title"], fontSize=16,
                                   textColor=OCA_BLUE_LIGHT, alignment=TA_CENTER, spaceAfter=18),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontSize=14,
                             textColor=OCA_BLUE, spaceBefore=12, spaceAfter=6),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontSize=11,
                             textColor=OCA_BLUE, spaceBefore=8, spaceAfter=4),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontSize=9,
                               textColor=SLATE_800, leading=13, alignment=TA_LEFT),
        "bullet": ParagraphStyle("bullet", parent=base["BodyText"], fontSize=9,
                                 textColor=SLATE_800, leading=13, leftIndent=12, bulletIndent=0),
        "footer": ParagraphStyle("footer", parent=base["BodyText"], fontSize=8,
                                 textColor=SLATE_500, alignment=TA_CENTER),
        "confidential": ParagraphStyle("confidential", parent=base["BodyText"], fontSize=8,
                                       textColor=RED, alignment=TA_CENTER, fontName="Helvetica-Oblique"),
    }


def _table_style(header_bg=SLATE_800, header_fg=colors.white, alt_row=SLATE_50):
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, 0), header_fg),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("TEXTCOLOR", (0, 1), (-1, -1), SLATE_800),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, alt_row]),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, SLATE_200),
        ("BOX", (0, 0), (-1, -1), 0.5, SLATE_200),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, SLATE_200),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])


def _arrow(delta: float, suffix: str = "") -> str:
    if delta > 0:
        return f'<font color="#10B981">▲ +{delta:.1f}{suffix}</font>'
    if delta < 0:
        return f'<font color="#DE473C">▼ {delta:.1f}{suffix}</font>'
    return f'<font color="#64748B">— 0{suffix}</font>'


def _portada(story, ctx: InformeContext, styles):
    if LOGO_PATH.exists():
        story.append(Spacer(1, 1.5 * cm))
        img = Image(str(LOGO_PATH), width=4.5 * cm, height=1.5 * cm, kind="proportional")
        img.hAlign = "CENTER"
        story.append(img)
    else:
        story.append(Spacer(1, 3 * cm))
    story.append(Spacer(1, 2.5 * cm))
    story.append(Paragraph("Informe Ejecutivo Mensual", styles["title"]))
    story.append(Paragraph(
        f"CGE TUSAN — {ctx.actual.mes_nombre} {ctx.actual.año}",
        styles["subtitle"],
    ))
    story.append(Spacer(1, 4 * cm))
    fecha_gen = datetime.now().strftime("%d/%m/%Y")
    story.append(Paragraph(f"Documento generado el {fecha_gen}", styles["footer"]))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("Documento Confidencial — Uso Interno", styles["confidential"]))
    story.append(PageBreak())


def _seccion_contexto(story, ctx, styles):
    story.append(Paragraph("1. Contexto Operativo y Expansión de Capacidad", styles["h1"]))
    story.append(Paragraph(narrar_contexto(ctx), styles["body"]))
    story.append(Spacer(1, 0.4 * cm))


def _seccion_pulso(story, ctx, styles):
    story.append(Paragraph("2. Pulso de la Operación: KPIs Críticos", styles["h1"]))
    story.append(Paragraph(narrar_pulso(ctx), styles["body"]))
    story.append(Spacer(1, 0.3 * cm))

    a = ctx.actual.kpis
    p = ctx.anterior.kpis if ctx.anterior else {}
    prom_a = ctx.actual.promedio_efectivas_oficial
    prom_p = ctx.anterior.promedio_efectivas_oficial if ctx.anterior else 0.0
    delta_prom = prom_a - prom_p if ctx.anterior else 0.0

    pct_cnr_a = float(a.get("pct_cnr", 0))
    pct_cnr_p = float(p.get("pct_cnr", 0))
    pct_ef_a = float(a.get("pct_efectivas", 0))
    pct_ef_p = float(p.get("pct_efectivas", 0))
    visitas_a = int(a.get("total_registros", 0))
    visitas_p = int(p.get("total_registros", 0))
    delta_visitas_pct = ((visitas_a - visitas_p) / visitas_p * 100) if visitas_p else 0.0

    rows = [
        ["KPI TUSAN", f"{ctx.actual.mes_nombre}", ctx.anterior.mes_nombre if ctx.anterior else "—", "Meta", "Variación"],
        ["Promedio Efectivas Diarias", f"{prom_a:.1f}", f"{prom_p:.1f}" if ctx.anterior else "—",
         f"{META_PROMEDIO_DIARIO:.1f}",
         Paragraph(_arrow(delta_prom) if ctx.anterior else "—", styles["body"])],
        ["CNR Promedio (%)", f"{pct_cnr_a:.1f}%", f"{pct_cnr_p:.1f}%" if ctx.anterior else "—",
         f"< {META_CNR_PCT:.0f}%",
         Paragraph(_arrow(pct_cnr_a - pct_cnr_p, " pp") if ctx.anterior else "—", styles["body"])],
        ["% Visita Efectiva", f"{pct_ef_a:.1f}%", f"{pct_ef_p:.1f}%" if ctx.anterior else "—",
         f"{META_EFECTIVAS_PCT:.0f}%",
         Paragraph(_arrow(pct_ef_a - pct_ef_p, " pp") if ctx.anterior else "—", styles["body"])],
        ["Q Total Visitas Realizadas", f"{visitas_a:,}", f"{visitas_p:,}" if ctx.anterior else "—",
         "—",
         Paragraph(_arrow(delta_visitas_pct, "%") if ctx.anterior else "—", styles["body"])],
    ]
    table = Table(rows, colWidths=[5.5 * cm, 2.8 * cm, 2.8 * cm, 2.0 * cm, 3.5 * cm])
    table.setStyle(_table_style())
    story.append(table)
    story.append(Spacer(1, 0.4 * cm))

    # Mix CNR
    story.append(Paragraph("Mix de CNR: Falla vs Hurto", styles["h2"]))
    cnr_falla = int(a.get("cnr_falla", 0))
    cnr_hurto = int(a.get("cnr_hurto", 0))
    pct_falla = float(a.get("pct_cnr_falla", 0))
    pct_hurto = float(a.get("pct_cnr_hurto", 0))
    mix_rows = [
        ["Tipo", "Cantidad", "% del CNR"],
        ["CNR Falla", f"{cnr_falla:,}", f"{pct_falla:.1f}%"],
        ["CNR Hurto", f"{cnr_hurto:,}", f"{pct_hurto:.1f}%"],
    ]
    mix_table = Table(mix_rows, colWidths=[5.0 * cm, 4.0 * cm, 4.0 * cm])
    mix_table.setStyle(_table_style())
    story.append(mix_table)
    story.append(Spacer(1, 0.3 * cm))

    # kWh recuperados
    kwh = int(a.get("kwh_recuperado", 0))
    kwh_p = int(p.get("kwh_recuperado", 0)) if ctx.anterior else 0
    delta_kwh = kwh - kwh_p
    if ctx.anterior:
        story.append(Paragraph(
            f"<b>kWh recuperados:</b> {kwh:,} kWh "
            f"({_arrow(delta_kwh, ' kWh')} vs {ctx.anterior.mes_nombre})",
            styles["body"],
        ))
    else:
        story.append(Paragraph(f"<b>kWh recuperados:</b> {kwh:,} kWh", styles["body"]))
    story.append(Spacer(1, 0.4 * cm))

    # Chart Tendencia diaria
    blob = chart_tendencia_diaria(
        ctx.actual.daily,
        meta_diaria=META_PROMEDIO_DIARIO,
        brigadas=ctx.actual.brigadas_unicas,
    )
    img = Image(io.BytesIO(blob), width=16 * cm, height=6.5 * cm, kind="proportional")
    img.hAlign = "CENTER"
    story.append(img)
    story.append(PageBreak())


def _seccion_brigadas(story, ctx, styles):
    story.append(Paragraph("3. Desempeño por Brigada: Cumplimiento de Metas", styles["h1"]))
    tecs = ctx.actual.tecnicos
    cumplen = sum(1 for t in tecs if t.get("cumple_meta_global", False))
    no_cumplen = len(tecs) - cumplen
    story.append(Paragraph(
        f"De un universo de {len(tecs)} brigadas operativas: {cumplen} cumplen la meta de efectivas/día "
        f"y {no_cumplen} presentan brechas.",
        styles["body"],
    ))
    story.append(Spacer(1, 0.3 * cm))

    blob = chart_top_bottom_brigadas(tecs)
    img = Image(io.BytesIO(blob), width=16 * cm, height=6.5 * cm, kind="proportional")
    img.hAlign = "CENTER"
    story.append(img)
    story.append(Spacer(1, 0.3 * cm))

    # Tabla Top 5 / Bottom 5
    ordenados = sorted(tecs, key=lambda t: t.get("promedio_efectivas_global", 0), reverse=True)
    top5 = ordenados[:5]
    bottom5 = ordenados[-5:][::-1] if len(ordenados) > 5 else []

    rows = [["Posición", "Brigada", "Zona", "Efectivas/día", "Estado"]]
    for i, t in enumerate(top5, start=1):
        estado = "Cumple" if t.get("cumple_meta_global") else "No cumple"
        rows.append([f"Top {i}", t.get("nombre", "")[:30], t.get("zona", "")[:20],
                     f"{float(t.get('promedio_efectivas_global', 0)):.1f}", estado])
    for i, t in enumerate(bottom5, start=1):
        estado = "Cumple" if t.get("cumple_meta_global") else "No cumple"
        rows.append([f"Bottom {i}", t.get("nombre", "")[:30], t.get("zona", "")[:20],
                     f"{float(t.get('promedio_efectivas_global', 0)):.1f}", estado])

    table = Table(rows, colWidths=[2.0 * cm, 5.0 * cm, 4.0 * cm, 2.5 * cm, 2.5 * cm])
    table.setStyle(_table_style())
    story.append(table)
    story.append(PageBreak())


def _seccion_visitas_fallidas(story, ctx, styles):
    story.append(Paragraph("4. Radiografía de Visitas Fallidas", styles["h1"]))
    story.append(Paragraph(narrar_visitas_fallidas(ctx), styles["body"]))
    story.append(Spacer(1, 0.3 * cm))

    causas = sorted(
        ctx.actual.resultados_fallidos,
        key=lambda r: r.get("cantidad", 0),
        reverse=True,
    )[:5]
    if causas:
        story.append(Paragraph("Top causas de visitas fallidas", styles["h2"]))
        rows = [["Causa", "Cantidad", "Resp. CGE", "Resp. TUSAN"]]
        for c in causas:
            rows.append([
                str(c.get("resultado", ""))[:50],
                f"{int(c.get('cantidad', 0)):,}",
                f"{int(c.get('cantidad_cge', 0)):,}",
                f"{int(c.get('cantidad_oca', 0)):,}",
            ])
        table = Table(rows, colWidths=[8.0 * cm, 2.5 * cm, 2.5 * cm, 3.0 * cm])
        table.setStyle(_table_style())
        story.append(table)
    story.append(Spacer(1, 0.4 * cm))


def _seccion_productividad(story, ctx, styles):
    story.append(Paragraph("5. Análisis de Productividad y Desviaciones", styles["h1"]))

    blob = chart_zonas_actual_vs_anterior(
        ctx.actual.zonas,
        ctx.anterior.zonas if ctx.anterior else None,
    )
    img = Image(io.BytesIO(blob), width=16 * cm, height=7 * cm, kind="proportional")
    img.hAlign = "CENTER"
    story.append(img)
    story.append(Spacer(1, 0.3 * cm))

    alertas = ctx.actual.alertas or {}
    inactivos = alertas.get("tecnicos_inactivos", []) or []
    jornada = alertas.get("problemas_jornada", []) or []

    story.append(Paragraph("Ausentismo y problemas de jornada", styles["h2"]))
    if inactivos or jornada:
        rows = [["Tipo", "Brigada", "Zona", "Detalle"]]
        for it in inactivos[:5]:
            rows.append([
                "Ausentismo",
                str(it.get("tecnico", ""))[:30],
                str(it.get("zona", ""))[:20],
                f"{int(it.get('dias_no_trabajados', 0))} días no trabajados",
            ])
        for it in jornada[:5]:
            rows.append([
                "Jornada",
                str(it.get("tecnico", ""))[:30],
                str(it.get("zona", ""))[:20],
                str(it.get("problemas", ""))[:40],
            ])
        table = Table(rows, colWidths=[2.5 * cm, 5.0 * cm, 4.0 * cm, 5.0 * cm])
        table.setStyle(_table_style())
        story.append(table)
    else:
        story.append(Paragraph("Sin alertas relevantes en el período.", styles["body"]))
    story.append(PageBreak())


def _seccion_economico(story, ctx, styles):
    story.append(Paragraph("6. Resultado Económico (Producción)", styles["h1"]))
    monto = ctx.actual.produccion_total
    monto_p = ctx.anterior.produccion_total if ctx.anterior else 0.0
    delta = monto - monto_p
    productividad = monto / max(ctx.actual.brigadas_unicas, 1)

    story.append(Paragraph(f"<b>Monto producción del mes:</b> ${monto:,.0f}", styles["body"]))
    if ctx.anterior:
        signo = "incremento" if delta > 0 else ("decremento" if delta < 0 else "estabilidad")
        story.append(Paragraph(
            f"<b>Comparativa vs {ctx.anterior.mes_nombre}:</b> {signo} de ${abs(delta):,.0f} "
            f"(${monto_p:,.0f} en {ctx.anterior.mes_nombre}).",
            styles["body"],
        ))
    story.append(Paragraph(
        f"<b>Productividad promedio por brigada:</b> ${productividad:,.0f} "
        f"({ctx.actual.brigadas_unicas} brigadas).",
        styles["body"],
    ))
    story.append(Spacer(1, 0.4 * cm))


def _seccion_conclusion(story, ctx, styles):
    story.append(Paragraph("7. Conclusión y Plan de Acción", styles["h1"]))
    story.append(Paragraph(
        f"El mes de {ctx.actual.mes_nombre} consolidó la operación con {ctx.actual.brigadas_unicas} "
        f"brigadas. Los focos identificados para el próximo período son:",
        styles["body"],
    ))
    story.append(Spacer(1, 0.2 * cm))
    for bullet in narrar_plan_accion(ctx):
        story.append(Paragraph(f"• {bullet}", styles["bullet"]))
    story.append(Spacer(1, 0.3 * cm))


def build_pdf(ctx: InformeContext) -> bytes:
    """Construye el PDF completo a partir del InformeContext y devuelve los bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
        title=f"Informe Ejecutivo {ctx.actual.mes_nombre} {ctx.actual.año}",
        author="OCA Chile - Dashboard Control de Pérdidas",
    )
    styles = _styles()
    story: list = []

    _portada(story, ctx, styles)
    _seccion_contexto(story, ctx, styles)
    _seccion_pulso(story, ctx, styles)
    _seccion_brigadas(story, ctx, styles)
    _seccion_visitas_fallidas(story, ctx, styles)
    _seccion_productividad(story, ctx, styles)
    _seccion_economico(story, ctx, styles)
    _seccion_conclusion(story, ctx, styles)

    doc.build(story)
    buf.seek(0)
    return buf.read()
```

- [ ] **Step 2: Smoke check de import**

Run: `cd backend && venv/bin/python -c "from app.services.exports.pdf_builder import build_pdf; print('OK')"`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/exports/pdf_builder.py
git commit -m "feat(exports): pdf_builder compone el PDF con ReportLab y paleta OCA"
```

---

## Task 9: Implementar `informe_mensual.py` (orquestador) + test e2e

**Files:**
- Create: `backend/app/services/exports/informe_mensual.py`
- Create: `backend/tests/exports/test_informe_mensual.py`

- [ ] **Step 1: Escribir test e2e**

`backend/tests/exports/test_informe_mensual.py`:
```python
import pytest

from app.services.exports.informe_mensual import generar_informe_mensual


def _is_pdf(blob: bytes) -> bool:
    return blob.startswith(b"%PDF-")


def test_generar_informe_mensual_para_mes_existente():
    from app.dependencies import get_dataframe
    df = get_dataframe()
    años_disponibles = sorted(df['año'].dropna().unique().tolist())
    if not años_disponibles:
        pytest.skip("No hay datos en el dataset")
    año = int(años_disponibles[-1])
    meses_año = sorted(df[df['año'] == año]['mes'].dropna().unique().tolist())
    mes = int(meses_año[-1])

    pdf_bytes = generar_informe_mensual(año, mes)

    assert _is_pdf(pdf_bytes)
    assert len(pdf_bytes) > 5000  # PDF mínimamente útil


def test_generar_informe_mensual_sin_datos_lanza_error():
    with pytest.raises(ValueError, match="No hay datos"):
        generar_informe_mensual(1900, 1)
```

- [ ] **Step 2: Correr test (debe fallar)**

Run: `cd backend && venv/bin/python -m pytest tests/exports/test_informe_mensual.py -v`
Expected: ImportError.

- [ ] **Step 3: Implementar el orquestador**

`backend/app/services/exports/informe_mensual.py`:
```python
from app.services.exports.context import build_context
from app.services.exports.pdf_builder import build_pdf


def generar_informe_mensual(año: int, mes: int) -> bytes:
    """
    Orquesta la generación del Informe Ejecutivo Mensual en PDF.

    Args:
        año: año del informe (ej. 2026).
        mes: mes del informe (1-12).

    Returns:
        bytes: contenido binario del PDF.

    Raises:
        ValueError: si no hay datos para el mes solicitado.
    """
    ctx = build_context(año, mes)
    return build_pdf(ctx)
```

- [ ] **Step 4: Correr toda la suite de exports**

Run: `cd backend && venv/bin/python -m pytest tests/exports/ -v`
Expected: todos los tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/exports/informe_mensual.py backend/tests/exports/test_informe_mensual.py
git commit -m "feat(exports): orquestador generar_informe_mensual + test e2e"
```

---

## Task 10: Crear el router `exports` y registrarlo

**Files:**
- Create: `backend/app/routers/exports.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Crear el router**

`backend/app/routers/exports.py`:
```python
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.services.exports.informe_mensual import generar_informe_mensual

router = APIRouter(prefix="/api/v1/exports", tags=["exports"])


@router.get("/informe-mensual")
def informe_mensual(
    año: int = Query(..., description="Año del informe"),
    mes: int = Query(..., ge=1, le=12, description="Mes del informe (1-12)"),
):
    """
    Genera y devuelve el Informe Ejecutivo Mensual en PDF para el mes solicitado.
    """
    try:
        pdf_bytes = generar_informe_mensual(año, mes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    filename = f"Informe_TUSAN_{año}-{mes:02d}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

- [ ] **Step 2: Registrar en `main.py`**

En `backend/app/main.py` reemplazar:

```python
from app.routers import dashboard, filters, geo, retiro_medidores, detalle_aviso, control_diario, detalle_tecnico
```

por:

```python
from app.routers import dashboard, filters, geo, retiro_medidores, detalle_aviso, control_diario, detalle_tecnico, exports
```

Y añadir después de la última línea `app.include_router(detalle_tecnico.router)`:

```python
app.include_router(exports.router)
```

- [ ] **Step 3: Levantar el servidor en background y testear el endpoint**

Run (en background):
```bash
cd backend && venv/bin/uvicorn app.main:app --port 8011 &
```
Wait ~3 seconds (basta `sleep 3`).

Run:
```bash
curl -s -o /tmp/informe_test.pdf -w "%{http_code} %{content_type}\n" \
  "http://localhost:8011/api/v1/exports/informe-mensual?a%C3%B1o=2026&mes=4"
file /tmp/informe_test.pdf
```
Expected:
- HTTP 200 con `application/pdf`
- `file` reporta `PDF document, version 1.x` y tamaño > 5 KB.

Probar también el caso de error:
```bash
curl -s -w "\n%{http_code}\n" \
  "http://localhost:8011/api/v1/exports/informe-mensual?a%C3%B1o=1900&mes=1"
```
Expected: HTTP 400 con JSON `{"detail": "No hay datos para 1900-01"}`.

Detener el servidor:
```bash
pkill -f "uvicorn app.main:app --port 8011"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/exports.py backend/app/main.py
git commit -m "feat(exports): endpoint GET /api/v1/exports/informe-mensual"
```

---

## Task 11: Cliente API frontend `downloadInformeMensual`

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Añadir la función al final de `api.ts`**

Añadir al final de `frontend/src/lib/api.ts`:

```typescript
export async function downloadInformeMensual(año: number, mes: number): Promise<void> {
  const params = new URLSearchParams({ año: String(año), mes: String(mes) });
  const res = await fetch(`/api/v1/exports/informe-mensual?${params.toString()}`);
  if (!res.ok) {
    let detail = 'Error generando informe';
    try {
      const err = await res.json();
      if (err?.detail) detail = err.detail;
    } catch {
      // ignore parse error
    }
    throw new Error(detail);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Informe_TUSAN_${año}-${String(mes).padStart(2, '0')}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Verificar que TypeScript compila**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): cliente API downloadInformeMensual"
```

---

## Task 12: Crear vista `ExportarInforme`

**Files:**
- Create: `frontend/src/components/views/ExportarInforme.tsx`

- [ ] **Step 1: Implementar la vista**

`frontend/src/components/views/ExportarInforme.tsx`:
```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { getFilterOptions, downloadInformeMensual } from '@/lib/api';
import { FilterOptions } from '@/types';

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const SECCIONES = [
  'Contexto operativo y expansión de capacidad',
  'Cuadro de mando contractual (KPIs vs meta)',
  'Desempeño por brigada (Top y Bottom 5)',
  'Radiografía de visitas fallidas',
  'Análisis por zona y productividad',
  'Resultado económico (producción)',
  'Conclusión y plan de acción',
];

function nombreToNumero(mesLower: string): number | null {
  const idx = MESES_NOMBRES.findIndex((m) => m.toLowerCase() === mesLower.toLowerCase());
  return idx >= 0 ? idx + 1 : null;
}

export default function ExportarInforme() {
  const [opciones, setOpciones] = useState<FilterOptions | null>(null);
  const [año, setAño] = useState<number | null>(null);
  const [mes, setMes] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    getFilterOptions()
      .then((opts) => {
        if (cancelado) return;
        setOpciones(opts);
        const ultimoAño = opts.años?.[opts.años.length - 1] ?? null;
        setAño(ultimoAño);
        const ultimoMes = opts.meses?.[opts.meses.length - 1];
        if (ultimoMes) {
          const num = nombreToNumero(ultimoMes);
          setMes(num);
        }
      })
      .catch((e) => setError(e.message ?? 'Error cargando opciones'));
    return () => {
      cancelado = true;
    };
  }, []);

  const mesesDisponibles = useMemo(() => {
    if (!opciones) return [] as { value: number; label: string }[];
    return (opciones.meses || [])
      .map((m) => {
        const num = nombreToNumero(m);
        return num !== null ? { value: num, label: MESES_NOMBRES[num - 1] } : null;
      })
      .filter((m): m is { value: number; label: string } => m !== null);
  }, [opciones]);

  const handleGenerar = async () => {
    if (año === null || mes === null) return;
    setLoading(true);
    setError(null);
    try {
      await downloadInformeMensual(año, mes);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error generando informe';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const puedeGenerar = año !== null && mes !== null && !loading;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Exportar Informe</h2>
        <p className="text-sm text-slate-500">Genera el Informe Ejecutivo Mensual en PDF</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200/60 p-4 space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Período del informe</p>

        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2">
            <span className="text-xs text-slate-600">Año</span>
            <select
              value={año ?? ''}
              onChange={(e) => setAño(e.target.value ? Number(e.target.value) : null)}
              className="text-[11px] px-3 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-oca-blue"
            >
              {(opciones?.años || []).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="text-xs text-slate-600">Mes</span>
            <select
              value={mes ?? ''}
              onChange={(e) => setMes(e.target.value ? Number(e.target.value) : null)}
              className="text-[11px] px-3 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-oca-blue"
            >
              {mesesDisponibles.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>

          <button
            onClick={handleGenerar}
            disabled={!puedeGenerar}
            className="text-[11px] px-3 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            {loading ? 'Generando informe...' : 'Generar PDF'}
          </button>
        </div>

        <p className="text-xs text-slate-500">
          El informe consolida los KPIs operativos del mes seleccionado, comparativos con el mes anterior,
          análisis por zona, y plan de acción ejecutivo. Se descarga como PDF.
        </p>

        {error && (
          <p className="text-xs text-red-600">Error: {error}</p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" />
          Contenido del informe
        </p>
        <ul className="space-y-1">
          {SECCIONES.map((sec) => (
            <li key={sec} className="text-xs text-slate-600 flex items-start gap-2">
              <span className="text-slate-300 mt-0.5">•</span>
              <span>{sec}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/views/ExportarInforme.tsx
git commit -m "feat(frontend): vista ExportarInforme con selector año/mes y descarga PDF"
```

---

## Task 13: Conectar la vista al Sidebar y al routing de `page.tsx`

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Añadir el icono `FileText` y el entry al sidebar**

En `frontend/src/components/layout/Sidebar.tsx`:

1. Verificar el import de iconos existente y añadir `FileText`. La línea de imports de `lucide-react` ya importa varios iconos; localizarla y añadir `FileText` a la lista. Si `FileText` ya está importado, dejarlo.

2. Reemplazar el bloque de la sección "Herramientas":

```typescript
  {
    title: 'Herramientas',
    items: [
      { id: 'detalle-aviso', label: 'Detalle Aviso', icon: Search },
      { id: 'mapa', label: 'Mapa Operaciones', icon: Map },
    ],
  },
```

por:

```typescript
  {
    title: 'Herramientas',
    items: [
      { id: 'detalle-aviso', label: 'Detalle Aviso', icon: Search },
      { id: 'mapa', label: 'Mapa Operaciones', icon: Map },
      { id: 'exportar-informe', label: 'Exportar Informe', icon: FileText },
    ],
  },
```

- [ ] **Step 2: Añadir el case en `page.tsx`**

En `frontend/src/app/page.tsx`:

1. Localizar la sección de imports de views y añadir:

```typescript
import ExportarInforme from '@/components/views/ExportarInforme';
```

2. Localizar el `switch (activeTab)` y añadir un nuevo case **antes** del `default` (justo después del último case existente, típicamente `case 'mapa':`):

```typescript
      case 'exportar-informe':
        return <ExportarInforme />;
```

- [ ] **Step 3: Verificar TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: QA visual manual**

Levantar backend y frontend:
```bash
cd backend && venv/bin/uvicorn app.main:app --port 8000 &
cd frontend && npm run dev &
```
Esperar a que ambos estén listos (~10 segundos).

Abrir http://localhost:3000 en el navegador, ir a la sección "Herramientas" en el sidebar y click en "Exportar Informe":
- La vista renderiza con el título correcto.
- Selectores año/mes pre-seleccionan último año/mes disponible.
- Click en "Generar PDF" descarga un archivo `Informe_TUSAN_AAAA-MM.pdf`.
- Abrir el PDF descargado: portada + 7 secciones + 3 gráficos visibles.

Detener procesos:
```bash
pkill -f "uvicorn app.main:app --port 8000"
pkill -f "next dev"
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx frontend/src/app/page.tsx
git commit -m "feat(frontend): integrar vista Exportar Informe al sidebar y routing"
```

---

## Task 14: Validación final — suite completa de tests

**Files:** ninguno

- [ ] **Step 1: Correr toda la suite de tests del feature**

Run: `cd backend && venv/bin/python -m pytest tests/exports/ -v`
Expected: todos los tests PASS (>= 14 tests).

- [ ] **Step 2: Verificar TypeScript del frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Verificar que `git status` está limpio**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

---

## Self-Review Notes

- **Spec coverage**: las 7 secciones del informe están implementadas (Tasks 8 secciones); narrativa cubierta (Task 6); gráficos cubiertos (Task 7); endpoint y client cubiertos (Tasks 10-11); UI y sidebar cubiertos (Tasks 12-13).
- **Métodos consistentes**: `generar_informe_mensual` (orquestador), `build_context` (datos), `build_pdf` (PDF), `chart_*` (gráficos), `narrar_*` (narrativa) — sin duplicaciones de nombres.
- **Sin placeholders**: todos los pasos contienen el código completo para copiar.
- **TDD aplicado**: Tasks 4, 5, 6, 7, 9 escriben test antes de implementación.
- **Commits frecuentes**: 13 commits a lo largo del plan.
- **Edge cases**: mes sin datos (400), sin mes anterior (narrativa adapta texto), tablas con 0 filas (mensaje fallback).
