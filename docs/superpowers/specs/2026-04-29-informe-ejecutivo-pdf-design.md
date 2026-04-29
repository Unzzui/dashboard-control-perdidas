# Informe Ejecutivo Mensual PDF — Diseño

**Fecha**: 2026-04-29
**Autor**: Diego Bravo (con asistencia de Claude)
**Estado**: Aprobado — pendiente de plan de implementación

---

## 1. Objetivo

Crear un módulo de exportación que genere un **Informe Ejecutivo Mensual en PDF** consolidando los KPIs operativos, financieros y de productividad del contrato CGE TUSAN para un mes seleccionado, con comparativos contra el mes anterior y narrativa autogenerada por reglas heurísticas.

El informe está pensado para audiencia ejecutiva (gerencia OCA, contraparte CGE) y reemplaza la elaboración manual mensual del documento.

---

## 2. Decisiones de diseño

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| Modo de generación | One-click totalmente automático | Volumen + interpretación cualitativa cubierta por reglas; sin intervención manual entre clic y descarga |
| Período | Selector explícito de año/mes en el módulo | Independiente de los filtros del dashboard; trazable y predecible |
| Stack PDF | Backend FastAPI + ReportLab | Reusa la lógica de cálculo ya existente en `services/`; ReportLab maneja paginación y tablas largas mejor que las alternativas JS |
| Stack gráficos | matplotlib en backend | Coherencia con ReportLab; no requiere coordinación front-back; estilizable a paleta OCA |
| UX módulo | Minimalista (selector + botón); sin preview ni historial en v1 | Maximiza valor con mínima complejidad; deja arquitectura abierta para sumar historial luego |
| Coherencia analítica | Reusa servicios existentes (`kpis`, `tecnicos`, `visitas_fallidas`, etc.) | Garantiza que lo del PDF = lo del dashboard |

---

## 3. Arquitectura

### 3.1 Estructura de archivos

```
backend/
├── app/
│   ├── routers/
│   │   └── exports.py                    # NEW — endpoint GET /api/v1/exports/informe-mensual
│   └── services/
│       └── exports/                      # NEW package
│           ├── __init__.py
│           ├── informe_mensual.py       # Orquestador
│           ├── narrative.py             # Reglas heurísticas de redacción
│           ├── charts.py                # matplotlib → PNG bytes
│           └── pdf_builder.py           # Composición ReportLab
└── requirements.txt                      # +reportlab>=4.0.0, +matplotlib>=3.7.0

frontend/
└── src/
    ├── app/
    │   └── page.tsx                     # +case 'exportar-informe' en switch
    ├── components/
    │   ├── layout/
    │   │   └── Sidebar.tsx              # +entry en sección "Herramientas"
    │   └── views/
    │       └── ExportarInforme.tsx      # NEW — vista del módulo
    └── lib/
        └── api.ts                        # +downloadInformeMensual()
```

El logo OCA ya existe en `frontend/public/logo-oca.png`. Se copia a `backend/assets/logo_oca.png` (path nuevo) para que ReportLab pueda embeberlo. Si el archivo no existe, la portada omite el logo silenciosamente (no falla).

### 3.2 Flujo de datos

1. Usuario navega a "Exportar Informe" desde el sidebar.
2. Selecciona año y mes (defaults: último año/mes con datos).
3. Click en "Generar PDF".
4. Frontend llama `GET /api/v1/exports/informe-mensual?año=2026&mes=4`.
5. Backend:
   - Filtra el dataframe global (`get_filtered_dataframe`) por mes solicitado.
   - Filtra por mes anterior (ajustando año si `mes==1`).
   - Llama a servicios existentes para computar KPIs de ambos meses.
   - Genera 3 charts PNG en memoria (matplotlib).
   - Compila narrativa con reglas heurísticas.
   - Construye PDF con ReportLab.
   - Devuelve `application/pdf` con `Content-Disposition: attachment`.
6. Frontend dispara descarga.

### 3.3 Principio de no recálculo

El módulo **no duplica lógica**. Reutiliza:
- `services/kpis.calculate_kpis` para KPIs principales.
- `services/promedio_efectivas.*` para promedios oficiales.
- `services/tecnicos.*` para ranking, top/bottom, cumplimiento de meta.
- `services/visitas_fallidas.*` para causas y responsabilidad.
- `services/produccion.*` para monto económico.
- `services/alertas_operativas.*` para ausentismo y problemas de jornada.
- `services/zonas.*` para análisis por zona.
- `services/calendario_mes.*` para días hábiles y meta dinámica.

Cualquier divergencia con el dashboard sería un bug en los servicios subyacentes, no en este módulo.

---

## 4. Estructura del PDF

### 4.1 Página 1 — Portada

- Logo OCA centrado arriba si existe en `backend/assets/logo_oca.png`.
- Título: **"Informe Ejecutivo Mensual"** — Helvetica 24pt bold, color `#294D6D`.
- Subtítulo: **"CGE TUSAN — {Mes} {Año}"** — Helvetica 16pt, color `#4A7BA7`.
- Línea divisoria delgada azul.
- Bloque inferior:
  - "Documento generado el {fecha actual en formato dd/mm/yyyy}"
  - "Documento Confidencial — Uso Interno" (gris, itálica, 9pt).

### 4.2 Páginas 2+ — Contenido

| # | Sección | Contenido principal | Visual |
|---|---------|---------------------|--------|
| 1 | Contexto Operativo y Expansión | Q brigadas, días hábiles, % dotación | Mini-KPI row + texto narrativo |
| 2 | Pulso de la Operación: KPIs Críticos | Cuadro de Mando Contractual + Mix CNR + kWh | Tabla KPIs + gráfico Tendencia Diaria |
| 3 | Desempeño por Brigada | Cumplimiento meta + Top/Bottom 5 | Tabla nombrada + gráfico Top/Bottom |
| 4 | Radiografía de Visitas Fallidas | Top 3 causas + responsabilidad + Efectividad Ajustada | Tabla causas + comparativa Real/Ajustada |
| 5 | Análisis de Productividad y Desviaciones | Por zona + ausentismo + outliers | Tabla zonas + tabla jornada + gráfico zonas |
| 6 | Resultado Económico (Producción) | Monto mes + Δ MoM + productividad/brigada | Bloque KPI |
| 7 | Conclusión y Plan de Acción | Narrativa generada por reglas | Texto |

### 4.3 Cuadro de Mando Contractual (sección 2)

Tabla con 5 columnas:

| KPI TUSAN | Resultado mes actual | Resultado mes anterior | Meta | Variación |
|-----------|----------------------|------------------------|------|-----------|
| Promedio Efectivas Diarias | valor | valor | 8.0 | flecha + delta |
| CNR Promedio (%) | % | % | < 20% | estado ✓/✗ |
| % Visita Efectiva | % | % | 80% | flecha + pp |
| Q Total Visitas Realizadas | número | número | — | % MoM |

Flechas (▲▼) y colores (verde/rojo) se renderizan vía `Paragraph` de ReportLab con tags HTML embebidos.

### 4.4 Mix CNR Falla vs Hurto (subsección 2)

Pequeña tabla 2x2: tipo (Falla / Hurto) × (Q absoluta, % del total CNR). Útil para que la audiencia entienda la naturaleza de la pérdida.

### 4.5 KPI kWh Recuperados (subsección 2)

Línea destacada: "kWh recuperados en el mes: {valor} (Δ vs mes anterior)".

### 4.6 Gráficos (matplotlib, paleta OCA)

| # | Gráfico | Datos | Tipo | Sección |
|---|---------|-------|------|---------|
| 1 | Tendencia Diaria de Efectivas | `DailyStats` filtrado por mes | Línea con línea horizontal en meta diaria (8) | 2 |
| 2 | Top 10 / Bottom 10 brigadas | `TecnicoRanking` ordenado por `efectivas_global` | Barras horizontales, dos paneles | 3 |
| 3 | Desempeño por Zona — actual vs anterior | `ZonaStats` mes actual vs anterior | Barras agrupadas | 5 |

Configuración común:
- Fondo blanco, sin grid pesado.
- Color primario `#294D6D`; secundario `#94A3B8`; positivo `#10B981`; negativo `#DE473C`.
- Tipografía: matplotlib default (DejaVu Sans).
- Tamaño: ~16cm de ancho, 150 DPI.
- Salida: `BytesIO` PNG, embebido en ReportLab vía `Image`.

### 4.7 Estilo general (alineado con CLAUDE.md)

- Fuente: Helvetica (built-in ReportLab).
- Color primario: `#294D6D`.
- Texto principal: `#1E293B`.
- Texto secundario: `#64748B`.
- Headers de tabla: fondo `#1E293B`, texto blanco.
- Filas alternadas: blanco / `#F8FAFC`.
- Estados: verde `#10B981`, ámbar `#F59E0B`, rojo `#DE473C`.
- Sin emojis, sin iconografía decorativa, sin bordes gruesos.
- Sin texto sobre fondo de color salvo headers de tabla.

---

## 5. Motor de narrativa

`backend/app/services/exports/narrative.py` expone funciones puras que reciben un `InformeContext` (dataclass con todos los datos consolidados de ambos meses) y devuelven strings.

### 5.1 Reglas principales

| Variable | Regla |
|----------|-------|
| Variación promedio efectivas | `Δ > +0.3 → "subió"`; `Δ < -0.3 → "bajó, posiblemente por curva de aprendizaje de las brigadas activadas"`; resto → "se mantuvo" |
| CNR vs meta | `valor < meta → "dentro del estándar"`; `valor > meta → "sobre el umbral, requiere atención"` |
| Efectividad Ajustada vs Real | Si `(ajustada - real) > 5pp → "factores externos pesan significativamente"`; resto → "factores externos con impacto acotado" |
| Cumplimiento meta brigadas | `% ≥ 70 → "operación robusta"`; `40-70 → "operación en consolidación"`; `< 40 → "brecha relevante en el cumplimiento"` |
| Outliers brigadas | Top: `efectivas/día > μ + 1σ`; Bottom: `efectivas/día < μ - 1σ`. Listadas con nombre. |
| Δ Producción económica | `> +5% → "incremento"`; `< -5% → "decremento"`; resto → "estabilidad" |
| Top causas VF | `value_counts().head(3)` sobre columna "Resultado final" del df filtrado |
| Plan de Acción | Combina hallazgos críticos en 3-4 bullets generados: zonas con peor desempeño, brigadas bottom, % responsabilidad CGE alto, problemas de jornada |

### 5.2 Tono

- Tercera persona, ejecutivo.
- Frases cortas, datos concretos.
- Sin emojis ni adornos.
- Cuando un valor es 0 o null, omitir la frase en lugar de imprimir vacío sin contexto.

### 5.3 Edge cases

- **No hay datos para el mes seleccionado**: el endpoint devuelve 400. El frontend muestra mensaje "No hay datos para el período seleccionado".
- **No hay mes anterior** (ej. primer mes con datos): la narrativa de comparativos omite las variaciones; las tablas muestran "—" en columna anterior.
- **Mes anterior cruza año** (ej. mes=1): se calcula correctamente como (año-1, mes=12).

---

## 6. Endpoint

### 6.1 Definición

```
GET /api/v1/exports/informe-mensual?año={año}&mes={mes}
```

**Query params**:
- `año` (int, requerido)
- `mes` (int 1-12, requerido)

**Responses**:
- `200 OK` → `application/pdf`
  - `Content-Disposition: attachment; filename="Informe_TUSAN_{año}-{mes:02d}.pdf"`
- `400 Bad Request` → JSON `{"detail": "..."}` cuando:
  - Parámetros inválidos (mes fuera de 1-12).
  - Dataframe filtrado vacío.
- `500 Internal Server Error` → fallback con logging.

### 6.2 Implementación de routers

```python
# backend/app/routers/exports.py
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from app.services.exports.informe_mensual import generar_informe_mensual

router = APIRouter(prefix="/api/v1/exports", tags=["exports"])

@router.get("/informe-mensual")
def informe_mensual(año: int = Query(...), mes: int = Query(..., ge=1, le=12)):
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

### 6.3 Cliente frontend

```typescript
// frontend/src/lib/api.ts
export async function downloadInformeMensual(año: number, mes: number): Promise<void> {
  const res = await fetch(`/api/v1/exports/informe-mensual?año=${año}&mes=${mes}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error generando informe' }));
    throw new Error(err.detail);
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

---

## 7. UI del módulo

### 7.1 Vista `ExportarInforme.tsx`

Layout (estilo minimalismo ejecutivo):

- **Header**: título "Exportar Informe" + subtítulo "Genera el Informe Ejecutivo Mensual en PDF".
- **Card "Período del Informe"** (`bg-white rounded-lg border border-slate-200/60 p-4`):
  - Selectores año + mes (mismo estilo que filtros del dashboard).
  - Texto explicativo corto (`text-sm text-slate-500`).
  - Botón principal: "Generar PDF" (`bg-slate-800 text-white`, mismo patrón que "Descargar Excel" en `ProduccionMensual`).
- **Card "Contenido del Informe"** (informativo):
  - Lista de las 7 secciones que incluirá el informe.

### 7.2 Estados del botón

- **Idle**: texto "Generar PDF".
- **Loading**: spinner + "Generando informe..." (botón deshabilitado).
- **Error**: mensaje rojo bajo el botón con `{error.message}`.
- **Éxito**: descarga automática (sin modal de confirmación).

### 7.3 Selector año/mes

- Reusa `getFilterOptions()` para listar años y meses con datos.
- Default: último año + último mes disponibles.
- Mes mostrado en español ("Enero", "Febrero", ...).

### 7.4 Sidebar y routing

- **`frontend/src/components/layout/Sidebar.tsx`**: añadir entry `{ id: 'exportar-informe', label: 'Exportar Informe', icon: FileText }` (lucide-react) en la sección **"Herramientas"** (al lado de "Detalle Aviso" y "Mapa Operaciones").
- **`frontend/src/app/page.tsx`**: añadir `case 'exportar-informe'` en el `switch (activeTab)` que renderiza `<ExportarInforme />`. El componente recibe los filtros vigentes como prop por consistencia con otros views, aunque internamente solo usa el selector año/mes propio.

---

## 8. Dependencias nuevas

### Backend
```
reportlab>=4.0.0
matplotlib>=3.7.0
```

### Frontend
Ninguna nueva — todo se hace con APIs nativas (`fetch`, `Blob`, `URL.createObjectURL`).

---

## 9. Testing

- **Unit tests backend** (`backend/tests/exports/`):
  - `test_narrative.py`: cada regla heurística con casos representativos (subió / bajó / mantuvo, etc.).
  - `test_charts.py`: smoke test que cada función de chart devuelve bytes PNG válidos.
  - `test_informe_mensual.py`: integración — genera el PDF para un mes con datos sintéticos y valida que tiene > N páginas y `Content-Type` correcto.
- **Manual QA**:
  - Generar PDF para Abril 2026 y revisar visualmente.
  - Probar mes sin datos → debe devolver 400 con mensaje claro.
  - Probar mes=1 (rollover de año al mes anterior).

---

## 10. Fuera de alcance (v1)

- Historial persistido de informes generados (queda como upgrade futuro; arquitectura preparada).
- Preview en pantalla previo a la descarga.
- Personalización de la narrativa por el usuario.
- Múltiples idiomas (solo español).
- Logo del cliente CGE en portada (solo OCA).
- Adjuntar el PDF por email automático.

---

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Tablas que excedan ancho de página A4 | ReportLab `Table` con `splitByRow=True` y columnas dimensionadas explícitamente |
| Charts con muchos técnicos (Top/Bottom) ilegibles | Limitar a Top 10 / Bottom 10; usar fuente reducida si > 10 |
| Filtrado del df por mes lento si el dataset es grande | Caché de servicios ya existente (`@lru_cache` en dependencias) cubre esto |
| Generación bloquea event loop FastAPI por matplotlib + ReportLab | Usar `def` (sync) endpoint — FastAPI lo corre en threadpool. Si se vuelve cuello de botella, mover a `BackgroundTasks` |
| Helvetica no acepta tildes/ñ correctamente | ReportLab + Helvetica soporta latin-1 nativo. Validar con texto "TUSAN — Año 2026 — Análisis" |

---

## 12. Roadmap de implementación (orden sugerido)

1. Añadir dependencias en `requirements.txt` y verificar instalación.
2. Crear paquete `services/exports/` con stubs.
3. Implementar `narrative.py` con tests unitarios.
4. Implementar `charts.py` con tests unitarios.
5. Implementar `pdf_builder.py` (portada + estructura básica de secciones).
6. Implementar `informe_mensual.py` (orquestador) y conectar todo.
7. Crear `routers/exports.py` y registrar en `main.py`.
8. Smoke test end-to-end con Abril 2026.
9. Crear `ExportarInforme.tsx` y añadir entrada al sidebar.
10. Implementar `downloadInformeMensual()` en `api.ts`.
11. QA visual del PDF y ajustes de estilo.

El plan detallado lo escribe la skill `writing-plans` a continuación.
