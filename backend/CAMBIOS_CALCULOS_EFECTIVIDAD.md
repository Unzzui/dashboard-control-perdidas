# Cambios en Cálculo de Visitas Efectivas

## Resumen de Cambios

Este documento detalla los cambios realizados en el cálculo de **Visitas Efectivas** y la reorganización de información en el Dashboard de Control de Pérdidas.

**Fecha de implementación**: Abril 2026
**Versión**: 2.0

---

## 1. Nueva Fórmula de Visitas Efectivas

### Fórmula Anterior
```
Visitas Efectivas = CNR + Normal
```

### Nueva Fórmula
```
Visitas Efectivas = CNR + Normal + VF CGE Pagables + Mantenimiento Medidor
```

### Justificación
1. Las **Visitas Fallidas CGE Pagables** son responsabilidad de CGE y se pagan al contratista
2. El **Mantenimiento Medidor** es una actividad efectiva donde el técnico realizó un trabajo válido
3. Todas estas visitas deben considerarse efectivas desde el punto de vista de producción y cumplimiento de metas

---

## 2. Clasificación de Visitas Fallidas

Las Visitas Fallidas ahora se dividen en dos categorías:

### 2.1 VF CGE Pagables (Efectivas)
Son visitas fallidas donde el contratista SÍ cumplió pero existe una situación no imputable a él:

- **Sitio eriazo**: No hay construcción en el lugar
- **Sin empalme**: No existe conexión eléctrica
- **Sin acceso medidor**: Cualquier variante que contenga este texto
  - Ejemplos: "Sin acceso medidor en altura", "Sin acceso medidor por reja", etc.

**Código de identificación**:
```python
es_vf_cge_pagable = (
    (Resultado_visita == 'Visita fallida') &
    (
        Resultado_final.isin(['Sitio eriazo', 'Sin empalme']) |
        Resultado_final.str.contains('Sin acceso medidor', case=False, na=False)
    )
)
```

### 2.2 VF No Efectivas
Todas las demás visitas fallidas que NO cumplen los criterios anteriores:

- Medidor no instalado
- Dirección incorrecta
- Cliente no permite acceso
- Etc.

**Código de identificación**:
```python
es_vf_no_efectiva = (
    (Resultado_visita == 'Visita fallida') &
    ~(
        Resultado_final.isin(['Sitio eriazo', 'Sin empalme']) |
        Resultado_final.str.contains('Sin acceso medidor', case=False, na=False)
    )
)
```

---

## 3. Reorganización de Columnas

Todas las tablas ahora siguen el siguiente orden estándar:

### Orden de Columnas
1. **Total visitas** - Total de todas las acciones
2. **Efectivas** - CNR + Normal + VF CGE + Mantenimiento (destacado en verde)
3. **Normal** - Visitas normales (sin CNR)
4. **Mantenimiento** - Mantenimiento de medidor (efectiva)
5. **VF CGE Pagable** - Visitas fallidas efectivas (pagadas por CGE)
6. **VF No Efectiva** - Visitas fallidas no efectivas
7. **CNR** - Consumos No Registrados
8. **kWh Recuperado** - kWh recuperados en CNR

### Ejemplo Visual
```
┌────────────┬────────┬─────────┬──────────┬─────┬────────┐
│ Tot Visit  │ Normal │ VF CGE  │ VF No Ef │ CNR │  kWh   │
├────────────┼────────┼─────────┼──────────┼─────┼────────┤
│   2,035    │ 1,184  │   11    │   622    │ 184 │102,648 │
└────────────┴────────┴─────────┴──────────┴─────┴────────┘
```

---

## 4. Cambios en Servicios Backend

### 4.1 `/app/services/tecnicos.py`

**Función**: `calculate_tecnicos()`

**Cambios principales**:
- Cálculo de VF CGE pagables
- Nueva fórmula de efectivas
- Reorganización de campos retornados

**Campos nuevos en respuesta**:
```python
{
    "normal": int,                  # Visitas normales
    "vf_cge_pagable": int,         # VF efectivas CGE
    "vf_no_efectiva": int,         # VF no efectivas
    "kwh_recuperado": int,         # kWh recuperados
    "efectivas": int,              # CNR + Normal + VF CGE
}
```

### 4.2 `/app/services/detalle_tecnico.py`

**Función**: `calculate_detalle_tecnico_diario()`

**Cambios principales**:
- Mismo cálculo de VF CGE pagables
- Desglose por zonas incluye los nuevos campos
- Detalle diario incluye los nuevos campos

**Estructura de respuesta actualizada**:
```python
{
    "nombre": str,
    "zona": str,  # "TODAS" para consolidado
    "zona_origen": str,
    "desglose_zonas": [
        {
            "zona": str,
            "visitas_totales": int,
            "normal": int,
            "vf_cge_pagable": int,
            "vf_no_efectiva": int,
            "cnr": int,
            "kwh_recuperado": int,
            "efectivas": int,
            "pct_efectivas": float,
        }
    ],
    "dias": [
        {
            "fecha": str,
            "visitas_totales": int,
            "normal": int,
            "vf_cge_pagable": int,
            "vf_no_efectiva": int,
            "cnr": int,
            "kwh_recuperado": int,
            "efectivas": int,
            "pct_efectivas": float,
        }
    ]
}
```

---

## 5. Cambios en Frontend

### 5.1 Tipos TypeScript (`/frontend/src/types/index.ts`)

**Interfaces actualizadas**:
- `TecnicoRanking`
- `DetalleDiaTecnico`
- `DesglosePorZona`

Todas incluyen ahora:
```typescript
normal: number;
vf_cge_pagable: number;
vf_no_efectiva: number;
kwh_recuperado: number;
```

### 5.2 Componente ControlMetas (`/frontend/src/components/views/ControlMetas.tsx`)

**Tablas actualizadas**:
1. Tabla de Desglose por Zonas
2. Tabla de Detalle Diario

Ambas ahora muestran las columnas en el orden estándar.

---

## 6. Ejemplo Real de Cálculo

### Técnico: Jair Eleazar Perez Mardones
**Zona**: 07. RANCAGUA

#### Datos
- Total visitas: **2,035**
- Normal: **1,184**
- VF CGE Pagable: **11** ✓ (efectivas)
- VF No Efectiva: **622**
- CNR: **184**
- kWh Recuperado: **102,648**

#### Cálculo de Efectivas
```
Efectivas = Normal + VF CGE + CNR
Efectivas = 1,184 + 11 + 184
Efectivas = 1,379 ✓
```

#### Porcentaje de Efectividad
```
% Efectivas = (Efectivas / Total visitas) × 100
% Efectivas = (1,379 / 2,035) × 100
% Efectivas = 67.8%
```

---

## 7. Impacto en Indicadores

### Antes vs Después

**Ejemplo con 1,000 visitas**:

| Indicador | Antes | Después | Diferencia |
|-----------|-------|---------|------------|
| Normal | 600 | 600 | - |
| CNR | 100 | 100 | - |
| VF CGE | 20 | 20 | - |
| VF No Efectiva | 280 | 280 | - |
| **Efectivas** | **700** | **720** | **+20** |
| **% Efectivas** | **70%** | **72%** | **+2%** |

**Impacto**: Las VF CGE pagables ahora se contabilizan correctamente como efectivas, mejorando el indicador de cumplimiento en aproximadamente 2-3 puntos porcentuales.

---

## 8. Consideraciones Técnicas

### 8.1 Compatibilidad hacia atrás
Se mantienen campos legacy para compatibilidad:
- `kwh_estimado` = `kwh_recuperado`
- `visita_fallida` = `vf_total` (suma de CGE y No Efectivas)

### 8.2 Validación de datos
El sistema valida que:
```python
visitas_totales == normal + vf_cge_pagable + vf_no_efectiva + cnr + mantenimiento
efectivas == normal + vf_cge_pagable + cnr
```

### 8.3 Performance
Los cálculos se realizan de forma vectorizada usando pandas para máxima eficiencia:
```python
# Operaciones vectorizadas en lugar de loops
ejecutores['es_vf_cge_pagable'] = (...).astype(int)
agg_result['efectivas'] = agg_result['cnr'] + agg_result['normal'] + agg_result['vf_cge_pagable']
```

---

## 9. Verificación y Testing

### Script de prueba
Ejecutar: `/backend/test_nuevos_calculos.py`

```bash
python test_nuevos_calculos.py
```

### Salida esperada
```
✓ VF CGE Pagables ahora se suman a Visitas Efectivas
✓ Visitas Efectivas = CNR + Normal + VF CGE Pagables
✓ VF No Efectivas = Todas las VF - VF CGE Pagables
✓ Columnas reorganizadas en orden correcto
✓ kWh Recuperados agregado en todas las vistas
```

---

## 10. Preguntas Frecuentes

### ¿Por qué las VF CGE se consideran efectivas?
Porque son situaciones fuera del control del técnico y CGE las paga. El técnico cumplió su trabajo correctamente.

### ¿Cambió el cálculo de CNR?
No, el cálculo de CNR se mantiene igual. Solo cambió lo que se considera "efectivo".

### ¿Afecta a datos históricos?
Sí, el cálculo se aplica a todos los datos. Los porcentajes de efectividad históricos pueden aumentar 2-3%.

### ¿Qué pasa si "Sin acceso medidor" tiene texto adicional?
Se captura cualquier variante que contenga "Sin acceso medidor", como:
- "Sin acceso medidor en altura"
- "Sin acceso medidor por reja"
- "Sin acceso medidor terreno privado"

---

## 11. Archivos Modificados

### Backend
- `/app/services/tecnicos.py` - Cálculo principal de rankings
- `/app/services/detalle_tecnico.py` - Detalle diario y desglose por zonas

### Frontend
- `/frontend/src/types/index.ts` - Tipos TypeScript
- `/frontend/src/components/views/ControlMetas.tsx` - UI del modal
- `/frontend/src/lib/api.ts` - Llamadas API

### Tests
- `/backend/test_nuevos_calculos.py` - Verificación de cálculos
- `/backend/verificar_vf_cge.py` - Verificación de VF CGE

---

## 12. Contacto y Soporte

Para consultas sobre estos cambios, contactar al equipo de desarrollo.

---

## 13. Control de Metas Globales (Técnicos Multi-Zona)

### Problema Anterior

Cuando un técnico trabajaba en múltiples zonas (por ejemplo, apoyando en otra zona), aparecía en la tabla de Control de Metas **una vez por cada zona**, y se evaluaba su meta **por zona individual**.

**Ejemplo del problema**:
- Jair trabaja en RANCAGUA: 150 efectivas → ✗ No cumple meta (< 160)
- Jair apoya en QUINTA MELIPILLA: 20 efectivas → ✗ No cumple meta (< 160)
- **Total global**: 170 efectivas → ✓ SÍ cumple meta

Pero el sistema mostraba que NO cumplía en ninguna zona.

### Solución Implementada

La **meta de 160 efectivas mensuales (8 efectivas/día) es GLOBAL**, no por zona individual.

Ahora el sistema:
1. Calcula totales GLOBALES por técnico (suma de todas las zonas)
2. Evalúa el cumplimiento de meta usando los totales globales
3. Muestra un badge "META GLOBAL" para técnicos multi-zona
4. Mantiene el detalle por zona para visibilidad de dónde trabaja

### Campos Globales Agregados

**Backend (`tecnicos.py`)**:
```python
{
    "efectivas_global": int,        # Total efectivas en TODAS las zonas
    "cnr_global": int,              # Total CNR en TODAS las zonas
    "normal_global": int,           # Total Normal en TODAS las zonas
    "visitas_totales_global": int,  # Total visitas en TODAS las zonas
    "kwh_global": int,              # Total kWh en TODAS las zonas
    "dias_global": int,             # Total días trabajados en TODAS las zonas
    "promedio_efectivas_global": float,  # Promedio efectivas/día global
    "promedio_cnr_global": float,   # Promedio CNR/día global
    "cumple_meta_global": bool,     # True si ≥8 efectivas/día globalmente
    "cantidad_zonas": int,          # Número de zonas donde trabaja
}
```

### Lógica de Evaluación

**Para técnicos que trabajan en UNA sola zona**:
- Usar métricas por zona (como antes)
- Evaluar meta por zona

**Para técnicos que trabajan en MÚLTIPLES zonas**:
- Usar totales GLOBALES para evaluar meta
- Mostrar badge "META GLOBAL" en la UI
- Mantener detalle por zona para transparencia

### Ejemplo Real

**Jair Eleazar Perez Mardones**:

```
Trabaja en 2 zonas:

07. RANCAGUA (Zona Origen):
├─ Días: 187
├─ Efectivas: 1,379
└─ Promedio: 7.4 ef/día

05. QUINTA MELIPILLA (Apoyando):
├─ Días: 5
├─ Efectivas: 23
└─ Promedio: 4.6 ef/día

TOTALES GLOBALES:
├─ Días: 192
├─ Efectivas: 1,402
├─ Promedio: 7.3 ef/día
└─ Meta mensual (160): ✓ CUMPLE (1,402 ≥ 160)
```

### Indicadores Visuales en UI

**Badge "META GLOBAL"**:
- Aparece cuando `cantidad_zonas > 1`
- Color azul claro para distinguirlo de otros indicadores
- Tooltip explica que se evalúa meta globalmente

**Badge "APOYO"** (existente):
- Indica que está trabajando en una zona que no es su zona de origen

### Estadísticas del Sistema

Con los datos actuales:
- **99 técnicos únicos**
  - 90 trabajan en 1 zona
  - 9 trabajan en 2+ zonas

De los 9 técnicos multi-zona:
- 3 cumplen meta global (≥8 ef/día)
- 6 no cumplen meta global

### Archivos Modificados

**Backend**:
- `/app/services/tecnicos.py` - Cálculo de totales globales

**Frontend**:
- `/frontend/src/types/index.ts` - Interfaces TypeScript actualizadas
- `/frontend/src/components/views/ControlMetas.tsx` - Lógica de evaluación y UI

**Tests**:
- `/backend/test_metas_globales.py` - Verificación de cálculos globales

---

## 14. Detalle de Inspecciones Mejorado

### Problema Anterior

Cuando un técnico trabajaba en múltiples zonas y se veía su consolidado, al hacer click en un día específico para ver inspecciones:

1. **No se mostraban inspecciones**: El sistema buscaba solo en una zona específica, pero ese día pudo haber trabajado en otra zona
2. **Faltaban métricas**: No se mostraban efectivas ni el desglose de resultados del día

### Solución Implementada

**Backend (`detalle_tecnico.py`)**:
- Función `get_inspecciones_dia()` acepta `zona=None` o `zona="TODAS"`
- Cuando zona es None/"TODAS", busca en TODAS las zonas donde trabajó
- Calcula métricas del día: efectivas, CNR, normal, VF CGE pagables, VF no efectivas
- Agrega campo `zona_inspeccion` a cada inspección (para saber dónde fue)

**Frontend (`ControlMetas.tsx` y `api.ts`)**:
- Pasa `detalleTecnico.zona` (que es "TODAS" si es consolidado) al buscar inspecciones
- Muestra métricas en el header del modal (Total, Efectivas, Normal, VF CGE, VF No Ef, CNR)
- Agrega columna "Zona" en tabla cuando es consolidado

### Ejemplo de Uso

**Caso: Jair trabajó en QUINTA MELIPILLA el 14-04-2026**

```
ANTES (búsqueda por zona específica RANCAGUA):
❌ 0 inspecciones encontradas

AHORA (búsqueda consolidada):
✅ 7 inspecciones encontradas
├─ Zona: 05. QUINTA MELIPILLA
├─ Efectivas: 0
├─ CNR: 0
├─ Normal: 0
├─ VF CGE Pagable: 0
└─ VF No Efectiva: 7
```

### Estructura de Respuesta

```python
{
    "nombre": "Jair Eleazar Perez Mardones",
    "zona": "TODAS",  # o zona específica
    "fecha": "2026-04-14",
    "total_inspecciones": 7,
    "efectivas": 0,
    "cnr": 0,
    "normal": 0,
    "vf_cge_pagable": 0,
    "vf_no_efectiva": 7,
    "inspecciones": [
        {
            "zona_inspeccion": "05. QUINTA MELIPILLA",  # ← Nuevo campo
            "ID Medida": 3312657,
            "Aviso": 123456,
            "Resultado visita": "Visita fallida",
            "Resultado final": "...",
            ...
        }
    ]
}
```

### UI Mejorada

**Header del Modal**:
```
Jair Eleazar Perez Mardones | TODAS | 14-04-2026
┌─────────┬──────────┬────────┬────────┬──────────┬─────┐
│ Total:7 │ Ef:0 ✓  │ Norm:0 │ VF CGE │ VF No Ef │ CNR │
└─────────┴──────────┴────────┴────────┴──────────┴─────┘
```

**Tabla con Zona** (solo cuando es consolidado):
```
┌──────────────────┬──────────┬────────┬────────────┐
│ Zona             │ ID Med   │ Aviso  │ Resultado  │
├──────────────────┼──────────┼────────┼────────────┤
│ QUINTA MELIPILLA │ 3312657  │ 123456 │ VF         │
└──────────────────┴──────────┴────────┴────────────┘
```

### Archivos Modificados

**Backend**:
- `/app/services/detalle_tecnico.py` - Búsqueda consolidada y métricas
- `/app/routers/detalle_tecnico.py` - Endpoint acepta zona opcional

**Frontend**:
- `/frontend/src/types/index.ts` - Interfaces actualizadas
- `/frontend/src/lib/api.ts` - API acepta zona null
- `/frontend/src/components/views/ControlMetas.tsx` - UI mejorada con métricas

**Tests**:
- `/backend/test_inspecciones_dia.py` - Verificación de búsqueda consolidada

---

**Última actualización**: Abril 2026
