# Replicación de Cálculos del Dashboard en Power BI (DAX)

Documento de referencia para replicar los cálculos del Dashboard Control de Pérdidas (CNR) en Power BI. Las medidas DAX están listas para copiar y pegar.

**Tabla principal:** `'Control Perdidas Expandido'`

> Convención DAX: nombres de tabla con espacios o acentos requieren comillas simples (`'...'`). Nombres de columna van entre corchetes (`[...]`). Las medidas que ya existen en el modelo se referencian solo con `[Nombre Medida]`.

---

## 1. Modelo de Datos y Convenciones

### 1.1 Columnas críticas

| Categoría | Columna | Valores / Formato |
|---|---|---|
| Resultado | `[Resultado visita]` | `Normal`, `CNR`, `Visita fallida`, `Mantenimiento Medidor` |
| Tipo CNR | `[Tipo_CNR.Tipo de CNR]` | `CNR Falla`, `CNR Hurto` |
| Resultado VF | `[Resultado final]` | `Sitio eriazo`, `Sin empalme`, `Desconectado en BT/MT`, `Sin acceso medidor...` |
| Responsabilidad | `[Responsabilidad]` | `Responsabilidad CGE`, `Responsabilidad Contratista` |
| Tratamiento | `[Tratamiento]` | `Normalizado`, `No normalizado` |
| Zona | `[zona]` | Zona del técnico. Excluir `No Asignados` |
| Regional | `[Regional]` | Agregación superior |
| Técnico | `[Nombre asignado]` | Excluir nombres con `BOT` |
| Tiempo | `[Fecha ejecución]`, `[Hora inicio]`, `[Hora fin]` | Fechas / `HH:MM` |
| Económico | `[Valor Unitario]`, `[kWh CNR]` | Numéricos |
| Campaña | `[Descripción del aviso]` | Texto |

### 1.2 Filtros base (tabla virtual reutilizable)

```DAX
Filtros Base =
    FILTER(
        'Control Perdidas Expandido',
        'Control Perdidas Expandido'[zona] <> "No Asignados"
            && NOT ISBLANK( 'Control Perdidas Expandido'[zona] )
            && NOT ISBLANK( 'Control Perdidas Expandido'[Nombre asignado] )
            && NOT ( SEARCH( "BOT", 'Control Perdidas Expandido'[Nombre asignado], 1, 0 ) > 0 )
            && NOT ISBLANK( 'Control Perdidas Expandido'[Fecha ejecución] )
    )
```

---

## 2. Conteos Base por Resultado

### 2.1 NORMAL *(ya existe)*
```DAX
NORMAL =
CALCULATE(
    COUNTROWS( 'Control Perdidas Expandido' ),
    'Control Perdidas Expandido'[Resultado visita] = "Normal"
)
```

### 2.2 CNR *(ya existe)*
```DAX
CNR =
CALCULATE(
    COUNTROWS( 'Control Perdidas Expandido' ),
    'Control Perdidas Expandido'[Resultado visita] = "CNR"
)
```

### 2.3 VISITA FALLIDA *(ya existe)*
```DAX
VISITA FALLIDA =
CALCULATE(
    COUNTROWS( 'Control Perdidas Expandido' ),
    'Control Perdidas Expandido'[Resultado visita] = "Visita fallida"
)
```

### 2.4 MANTENIMIENTO MEDIDOR *(ya existe)*
```DAX
MANTENIMIENTO MEDIDOR =
CALCULATE(
    COUNTROWS( 'Control Perdidas Expandido' ),
    'Control Perdidas Expandido'[Resultado visita] = "Mantenimiento Medidor"
)
```

### 2.5 TOTAL *(ya existe)*
```DAX
TOTAL = COUNTROWS( 'Control Perdidas Expandido' )
```

### 2.6 CNR FALLA *(ya existe)*
```DAX
CNR FALLA =
CALCULATE(
    COUNTROWS( 'Control Perdidas Expandido' ),
    'Control Perdidas Expandido'[Resultado visita]     = "CNR",
    'Control Perdidas Expandido'[Tipo_CNR.Tipo de CNR] = "CNR Falla"
)
```

### 2.7 CNR HURTO *(ya existe)*
```DAX
CNR HURTO =
CALCULATE(
    COUNTROWS( 'Control Perdidas Expandido' ),
    'Control Perdidas Expandido'[Resultado visita]     = "CNR",
    'Control Perdidas Expandido'[Tipo_CNR.Tipo de CNR] = "CNR Hurto"
)
```

### 2.8 NORMALIZADO / NO NORMALIZADO *(ya existen)*
```DAX
NORMALIZADO =
CALCULATE(
    COUNTROWS( 'Control Perdidas Expandido' ),
    'Control Perdidas Expandido'[Resultado visita] = "CNR",
    'Control Perdidas Expandido'[Tratamiento]      = "Normalizado"
)

NO NORMALIZADO =
CALCULATE(
    COUNTROWS( 'Control Perdidas Expandido' ),
    'Control Perdidas Expandido'[Resultado visita] = "CNR",
    'Control Perdidas Expandido'[Tratamiento]      = "No normalizado"
)

TOTAL TRATAMIENTO = [NORMALIZADO] + [NO NORMALIZADO]
```

---

## 3. EFECTIVAS — Definición Oficial

> **Regla de negocio:** una visita es **EFECTIVA** si es `Normal`, `CNR` (cualquier tipo), o `Visita fallida` con `Responsabilidad = Responsabilidad CGE` (VF CGE). El `Mantenimiento Medidor` se contabiliza separado.
>
> Pago de técnicos usa una variante donde VF CGE se determina por `Resultado final` (whitelist). Ver §9.

### 3.1 VF CGE / VF Contratista
```DAX
VF CGE =
CALCULATE(
    COUNTROWS( 'Control Perdidas Expandido' ),
    'Control Perdidas Expandido'[Resultado visita] = "Visita fallida",
    'Control Perdidas Expandido'[Responsabilidad]  = "Responsabilidad CGE"
)

VF Contratista =
CALCULATE(
    COUNTROWS( 'Control Perdidas Expandido' ),
    'Control Perdidas Expandido'[Resultado visita] = "Visita fallida",
    'Control Perdidas Expandido'[Responsabilidad]  = "Responsabilidad Contratista"
)
```

### 3.2 EFECTIVAS *(ya existe)*
```DAX
EFECTIVAS = [NORMAL] + [CNR]
```

Variante con VF CGE reclasificada:
```DAX
EFECTIVAS con VF CGE = [NORMAL] + [CNR] + [VF CGE]
```

### 3.3 % EFECTIVAS *(ya existe)*
```DAX
% EFECTIVAS =
DIVIDE(
    [EFECTIVAS],
    [NORMAL] + [CNR] + [VISITA FALLIDA] + [MANTENIMIENTO MEDIDOR],
    0
)
```

Variantes:
```DAX
% EFECTIVAS sin CGE (excluida) =
DIVIDE( [EFECTIVAS], [TOTAL] - [VF CGE], 0 )

% EFECTIVAS sin CGE (reclasificada) =
DIVIDE( [EFECTIVAS] + [VF CGE], [TOTAL], 0 )
```

### 3.4 % V.FALLIDA *(ya existe)*
```DAX
% V.FALLIDA = DIVIDE( [VISITA FALLIDA], [TOTAL], 0 )
```

---

## 4. Métricas % CNR

### 4.1 % CNR *(ya existe)*
> CNR respecto a **efectivas**, no respecto al total.
```DAX
% CNR = DIVIDE( [CNR], [NORMAL] + [CNR], 0 )
```

### 4.2 % CNR FALLA / % CNR HURTO *(ya existen)*
```DAX
% CNR Falla = DIVIDE( [CNR FALLA], [CNR], 0 )
% CNR Hurto = DIVIDE( [CNR HURTO], [CNR], 0 )
```

### 4.3 % NORMALIZADO / % NO NORMALIZADO *(ya existen)*
```DAX
% NORMALIZADO    = DIVIDE( [NORMALIZADO],    [TOTAL TRATAMIENTO], 0 )
% NO NORMALIZADO = DIVIDE( [NO NORMALIZADO], [TOTAL TRATAMIENTO], 0 )
```

---

## 5. Métricas Económicas y de Energía

### 5.1 MONTO_CNR *(ya existe)*
```DAX
MONTO_CNR =
CALCULATE(
    SUM( 'Control Perdidas Expandido'[Valor Unitario] ),
    'Control Perdidas Expandido'[Resultado visita] = "CNR"
)
```

### 5.2 PROMEDIO_MONTO_CNR *(ya existe)*
```DAX
PROMEDIO_MONTO_CNR = DIVIDE( [MONTO_CNR], [CNR], 0 )
```

### 5.3 Días Trabajados (auxiliar)
```DAX
Días Trabajados =
CALCULATE(
    DISTINCTCOUNT( 'Control Perdidas Expandido'[Fecha ejecución] ),
    'Control Perdidas Expandido'[Resultado visita]
        IN { "Normal", "CNR", "Visita fallida", "Mantenimiento Medidor" }
)
```

### 5.4 PROMEDIO_CNR *(ya existe)*
```DAX
PROMEDIO_CNR = DIVIDE( [CNR], [Días Trabajados], 0 )
```

### 5.5 PROMEDIO_EFECTIVAS *(ya existe — ver §10 versión deduplicada)*
```DAX
PROMEDIO_EFECTIVAS = DIVIDE( [EFECTIVAS], [Días Trabajados], 0 )
```

### 5.6 kWh y % Zona vs Regional *(ya existen)*
```DAX
kWh CNR Total = SUM( 'Control Perdidas Expandido'[kWh CNR] )

Total_kWh_Regional =
CALCULATE(
    SUM( 'Control Perdidas Expandido'[kWh CNR] ),
    ALL( 'Control Perdidas Expandido'[zona] )
)

% kWh Zona vs Total Regional =
DIVIDE( [kWh CNR Total], [Total_kWh_Regional], 0 )
```

---

## 6. Metas y Objetivos

### 6.1 Constantes de negocio
| Constante | Valor | Uso |
|---|---|---|
| Meta efectivas/día por técnico | `8` | Pago, alertas, cumplimiento diario |
| Meta económica por brigada | `6.500.000` | % cumplimiento producción |
| Meta CNR diaria por técnico | `2` | Alerta de baja producción |
| Umbral baja producción | `0,5` (50%) | Filtro alertas |

### 6.2 Días hábiles dinámicos
> Requiere tabla `Feriados` con columna `[Fecha]`. Si no existe, omitir la condición de feriados.

```DAX
Días Hábiles Mes =
VAR Inicio = STARTOFMONTH( 'Control Perdidas Expandido'[Fecha ejecución] )
VAR Fin    = ENDOFMONTH(   'Control Perdidas Expandido'[Fecha ejecución] )
RETURN
    COUNTROWS(
        FILTER(
            CALENDAR( Inicio, Fin ),
            WEEKDAY( [Date], 2 ) <= 5
                && NOT ( [Date] IN VALUES( Feriados[Fecha] ) )
        )
    )
```

### 6.3 Metas dinámicas mensuales
```DAX
EFECTIVAS META = 8 * [Días Hábiles Mes]
CNR META       = 2 * [Días Hábiles Mes]
NORMAL META    = [EFECTIVAS META] - [CNR META]
```

### 6.4 Objetivos porcentuales *(parametrizar)*
```DAX
Efectividad objetivo = 0.80
V.Falida Objetivo    = 0.15
CNR Objetivo         = 0.30
CNR Falla Objetivo   = 0.55
CNR Hurto Objetivo   = 0.45
```

### 6.5 Cumplimiento
```DAX
% Cumplimiento Efectividad = DIVIDE( [% EFECTIVAS], [Efectividad objetivo], 0 )
% Cumplimiento CNR         = DIVIDE( [% CNR],       [CNR Objetivo],         0 )

Cumple Meta Efectivas Mes =
IF( [EFECTIVAS] >= [EFECTIVAS META], 1, 0 )
```

---

## 7. Producción Económica

### 7.1 Producción por zona
```DAX
Producción Zona = SUM( 'Control Perdidas Expandido'[Valor Unitario] )
```

### 7.2 Brigadas activas y meta
> Requiere tabla `Brigadas` con columnas `[zona]` y `[cantidad_brigadas]`.

```DAX
Brigadas Activas =
LOOKUPVALUE(
    Brigadas[cantidad_brigadas],
    Brigadas[zona], SELECTEDVALUE( 'Control Perdidas Expandido'[zona] )
)

Meta Producción Zona = [Brigadas Activas] * 6500000

% Cumplimiento Producción =
DIVIDE( [Producción Zona], [Meta Producción Zona], 0 )
```

---

## 8. Análisis de Jornada

### 8.1 Columnas calculadas auxiliares (en `'Control Perdidas Expandido'`)
```DAX
inicio_min =
IF(
    ISBLANK( 'Control Perdidas Expandido'[Hora inicio] ),
    BLANK(),
    VALUE( LEFT( 'Control Perdidas Expandido'[Hora inicio], 2 ) ) * 60
        + VALUE( RIGHT( 'Control Perdidas Expandido'[Hora inicio], 2 ) )
)

fin_min =
IF(
    ISBLANK( 'Control Perdidas Expandido'[Hora fin] ),
    BLANK(),
    VALUE( LEFT( 'Control Perdidas Expandido'[Hora fin], 2 ) ) * 60
        + VALUE( RIGHT( 'Control Perdidas Expandido'[Hora fin], 2 ) )
)

Es Sábado = WEEKDAY( 'Control Perdidas Expandido'[Fecha ejecución], 2 ) = 6
```

### 8.2 Tabla virtual de Jornadas (técnico × fecha)
> Crear como tabla calculada o vista en Power Query:

```DAX
Jornadas =
SUMMARIZE(
    'Control Perdidas Expandido',
    'Control Perdidas Expandido'[zona],
    'Control Perdidas Expandido'[Nombre asignado],
    'Control Perdidas Expandido'[Fecha ejecución],
    "inicio",      MIN( 'Control Perdidas Expandido'[inicio_min] ),
    "fin",         MAX( 'Control Perdidas Expandido'[fin_min] ),
    "actividades", COUNTROWS( 'Control Perdidas Expandido' )
)
```

### 8.3 Métricas de jornada
```DAX
Duración Promedio (min) =
AVERAGEX( Jornadas, Jornadas[fin] - Jornadas[inicio] )

Productividad (act/h) =
AVERAGEX(
    Jornadas,
    DIVIDE( Jornadas[actividades], ( Jornadas[fin] - Jornadas[inicio] ) / 60, 0 )
)

Hora Inicio Promedio =
VAR M = AVERAGEX( Jornadas, Jornadas[inicio] )
RETURN FORMAT( INT( M / 60 ), "00" ) & ":" & FORMAT( MOD( M, 60 ), "00" )

Hora Fin Promedio =
VAR M = AVERAGEX( Jornadas, Jornadas[fin] )
RETURN FORMAT( INT( M / 60 ), "00" ) & ":" & FORMAT( MOD( M, 60 ), "00" )

Jornadas Cortas =
COUNTROWS( FILTER( Jornadas, Jornadas[fin] - Jornadas[inicio] < 360 ) )

% Jornadas Cortas =
DIVIDE( [Jornadas Cortas], COUNTROWS( Jornadas ), 0 )
```

### 8.4 Outliers por Z-Score (severidad por técnico)

| Z-score | Severidad |
|---|---|
| `z < -1` | crítico |
| `-1 ≤ z < -0,5` | alerta |
| `-0,5 ≤ z ≤ 1` | normal |
| `z > 1` | destacado |

> Para métricas "donde más es peor" (% jornadas cortas), invertir signo de `z` antes de clasificar.

```DAX
Productividad Técnico =
AVERAGEX(
    VALUES( 'Control Perdidas Expandido'[Nombre asignado] ),
    [Productividad (act/h)]
)

Productividad Media Zona =
CALCULATE(
    [Productividad Técnico],
    ALLEXCEPT( 'Control Perdidas Expandido', 'Control Perdidas Expandido'[zona] )
)

Productividad Std Zona =
CALCULATE(
    STDEVX.P(
        VALUES( 'Control Perdidas Expandido'[Nombre asignado] ),
        [Productividad Técnico]
    ),
    ALLEXCEPT( 'Control Perdidas Expandido', 'Control Perdidas Expandido'[zona] )
)

Z-Score Productividad =
DIVIDE(
    [Productividad Técnico] - [Productividad Media Zona],
    [Productividad Std Zona],
    0
)

Severidad Productividad =
SWITCH(
    TRUE(),
    [Z-Score Productividad] < -1,    "crítico",
    [Z-Score Productividad] < -0.5,  "alerta",
    [Z-Score Productividad] >  1,    "destacado",
    "normal"
)
```

### 8.5 Delta vs zona / vs global
```DAX
Δ Productividad vs Zona (%) =
DIVIDE(
    [Productividad Técnico] - [Productividad Media Zona],
    [Productividad Media Zona],
    0
)

Productividad Media Global =
CALCULATE(
    [Productividad Técnico],
    ALL( 'Control Perdidas Expandido'[zona] )
)

Δ Productividad vs Global (%) =
DIVIDE(
    [Productividad Técnico] - [Productividad Media Global],
    [Productividad Media Global],
    0
)
```

---

## 9. Pago de Técnicos

> Esta vista usa **EFECTIVAS** ampliada con VF CGE determinada por `Resultado final` (whitelist), no por `Responsabilidad`.

### 9.1 VF CGE Pagable (whitelist)
```DAX
VF CGE Pagable =
CALCULATE(
    COUNTROWS( 'Control Perdidas Expandido' ),
    'Control Perdidas Expandido'[Resultado visita] = "Visita fallida",
    OR(
        'Control Perdidas Expandido'[Resultado final]
            IN { "Sitio eriazo", "Sin empalme", "Desconectado en BT/MT" },
        CONTAINSSTRING( 'Control Perdidas Expandido'[Resultado final], "Sin acceso medidor" )
    )
)
```

### 9.2 Efectivas pagables
```DAX
Efectivas Pago = [NORMAL] + [CNR FALLA] + [CNR HURTO] + [VF CGE Pagable]
```

### 9.3 Subtotales sábado vs hábil
```DAX
Efectivas Sábado =
CALCULATE(
    [Efectivas Pago],
    'Control Perdidas Expandido'[Es Sábado] = TRUE()
)

Efectivas Hábiles =
MAX( 0, [Efectivas Pago] - [Efectivas Sábado] )
```

### 9.4 Meta dinámica y valor por efectiva
> Requiere tabla `Precios` con `[Zona]`, `[Comuna]`, `[Precio Base]`.

```DAX
Meta Efectivas Mes = 8 * [Días Hábiles Mes]

Precio Base Técnico =
LOOKUPVALUE(
    Precios[Precio Base],
    Precios[Zona],   SELECTEDVALUE( 'Control Perdidas Expandido'[zona] ),
    Precios[Comuna], SELECTEDVALUE( 'Control Perdidas Expandido'[Comuna] )
)

Valor por Efectiva =
DIVIDE( [Precio Base Técnico], [Meta Efectivas Mes], 0 )
```

### 9.5 Pago hábil, sábado y total
```DAX
Monto Hábil =
MIN(
    [Valor por Efectiva] * [Efectivas Hábiles],
    [Precio Base Técnico]
)

Monto Sábado = [Valor por Efectiva] * [Efectivas Sábado]

Total Pago = [Monto Hábil] + [Monto Sábado]
```

> **Regla:** `Monto Hábil` se capea al precio base — si el técnico supera la meta en hábiles no gana más; lo extra solo se paga vía sábados.

---

## 10. Promedio Efectivas Oficial (deduplicado por brigada)

### 10.1 Días únicos por técnico (global, no por zona)
```DAX
Días Únicos Técnico =
CALCULATE(
    DISTINCTCOUNT( 'Control Perdidas Expandido'[Fecha ejecución] ),
    ALLEXCEPT( 'Control Perdidas Expandido', 'Control Perdidas Expandido'[Nombre asignado] )
)
```

### 10.2 Promedio efectivas global por técnico
```DAX
Promedio Efectivas Global Técnico =
DIVIDE(
    CALCULATE(
        [EFECTIVAS],
        ALLEXCEPT( 'Control Perdidas Expandido', 'Control Perdidas Expandido'[Nombre asignado] )
    ),
    [Días Únicos Técnico],
    0
)
```

### 10.3 Promedio Efectivas Oficial
```DAX
Promedio Efectivas Oficial =
AVERAGEX(
    VALUES( 'Control Perdidas Expandido'[Nombre asignado] ),
    [Promedio Efectivas Global Técnico]
)
```

### 10.4 Ajustado (escenario sin VF CGE)
```DAX
Ratio Ajuste VF CGE =
DIVIDE( [EFECTIVAS] + [VF CGE], [EFECTIVAS], 1 )

Promedio Efectivas Ajustado =
[Promedio Efectivas Oficial] * [Ratio Ajuste VF CGE]
```

---

## 11. Alertas Operativas

| Tipo | Umbral | Medida DAX |
|---|---|---|
| Ausentismo | ≥ 2 días hábiles sin trabajar | `[Días Hábiles Mes] - [Días Trabajados] >= 2` |
| Baja CNR | promedio CNR diario < 2 | `[PROMEDIO_CNR] < 2` |
| Baja Efectividad | promedio efectivas diario < 8 | `[PROMEDIO_EFECTIVAS] < 8` |
| Inicio tardío | hora inicio promedio > 09:00 (540 min) | `AVERAGE([inicio_min]) > 540` |
| Cierre temprano | hora fin promedio < 17:00 (1020 min) | `AVERAGE([fin_min]) < 1020` |
| Jornada corta | duración < 6h (360 min) | `[Duración Promedio (min)] < 360` |
| Alta VF | % VF > 30% | `[% V.FALLIDA] > 0.30` |

### 11.1 Gravedad por técnico
```DAX
Gravedad Alerta =
SWITCH(
    TRUE(),
    [PROMEDIO_CNR] < 1 || [PROMEDIO_EFECTIVAS] < 5, "alta",
    [PROMEDIO_CNR] < 2 || [PROMEDIO_EFECTIVAS] < 8, "media",
    "ok"
)
```

### 11.2 Última actualización
```DAX
Last_Update = MAX( 'Control Perdidas Expandido'[Fecha Modificación] )
```
2026-05-07T15:44:25
---

## 12. Reglas y Casos Especiales

1. **División por cero:** TODA medida porcentual usa `DIVIDE(num, den, 0)`. Nunca `/`.
2. **Excluir `No Asignados`** en agrupaciones por zona.
3. **Excluir nombres con `BOT`** en `[Nombre asignado]`.
4. **Días únicos GLOBALES:** para técnicos multi-zona, `DISTINCTCOUNT(Fecha)` SIN agrupar por zona.
5. **VF CGE tiene dos definiciones:**
   - Por **`Responsabilidad = Responsabilidad CGE`** → KPIs y % Efectivas variantes.
   - Por **`Resultado final` ∈ whitelist** → Pago de Técnicos.
6. **Meta dinámica mensual:** descontar sábados, domingos y feriados. NO usar 160 fijo.
7. **Sábado:** `WEEKDAY(fecha, 2) = 6` (lunes=1).
8. **Filtro de ruido en campañas:** ignorar `Descripción del aviso` con menos de 10 registros.
9. **Tipo CNR es sub-clasificador de CNR:** `CNR FALLA + CNR HURTO ≈ CNR` (puede haber CNR sin tipo).
10. **Tratamiento solo aplica a CNR:** `% NORMALIZADO` se calcula sobre el universo CNR, no sobre toda la tabla.

---

## 13. Mapeo Medidas Existentes ↔ Cálculo

| Medida Power BI | Definición |
|---|---|
| `TOTAL` | `COUNTROWS( 'Control Perdidas Expandido' )` |
| `NORMAL` | `CALCULATE( COUNTROWS, [Resultado visita]="Normal" )` |
| `CNR` | `CALCULATE( COUNTROWS, [Resultado visita]="CNR" )` |
| `CNR FALLA` | `CALCULATE( COUNTROWS, "CNR" && [Tipo de CNR]="CNR Falla" )` |
| `CNR HURTO` | `CALCULATE( COUNTROWS, "CNR" && [Tipo de CNR]="CNR Hurto" )` |
| `VISITA FALLIDA` | `CALCULATE( COUNTROWS, [Resultado visita]="Visita fallida" )` |
| `MANTENIMIENTO MEDIDOR` | `CALCULATE( COUNTROWS, [Resultado visita]="Mantenimiento Medidor" )` |
| `EFECTIVAS` | `[NORMAL] + [CNR]` |
| `% EFECTIVAS` | `DIVIDE([EFECTIVAS], [NORMAL]+[CNR]+[VISITA FALLIDA]+[MANTENIMIENTO MEDIDOR], 0)` |
| `% CNR` | `DIVIDE([CNR], [NORMAL]+[CNR], 0)` |
| `% CNR Falla` | `DIVIDE([CNR FALLA], [CNR], 0)` |
| `% CNR Hurto` | `DIVIDE([CNR HURTO], [CNR], 0)` |
| `% V.FALLIDA` | `DIVIDE([VISITA FALLIDA], [TOTAL], 0)` |
| `NORMALIZADO` | `CALCULATE( COUNTROWS, "CNR" && [Tratamiento]="Normalizado" )` |
| `NO NORMALIZADO` | `CALCULATE( COUNTROWS, "CNR" && [Tratamiento]="No normalizado" )` |
| `TOTAL TRATAMIENTO` | `[NORMALIZADO] + [NO NORMALIZADO]` |
| `% NORMALIZADO` | `DIVIDE([NORMALIZADO], [TOTAL TRATAMIENTO], 0)` |
| `% NO NORMALIZADO` | `DIVIDE([NO NORMALIZADO], [TOTAL TRATAMIENTO], 0)` |
| `MONTO_CNR` | `CALCULATE( SUM([Valor Unitario]), [Resultado visita]="CNR" )` |
| `PROMEDIO_MONTO_CNR` | `DIVIDE([MONTO_CNR], [CNR], 0)` |
| `PROMEDIO_CNR` | `DIVIDE([CNR], [Días Trabajados], 0)` |
| `PROMEDIO_EFECTIVAS` | `DIVIDE([EFECTIVAS], [Días Trabajados], 0)` |
| `Total_kWh_Regional` | `CALCULATE( SUM([kWh CNR]), ALL([zona]) )` |
| `% kWh Zona vs Total Regional` | `DIVIDE( SUM([kWh CNR]), [Total_kWh_Regional], 0 )` |
| `EFECTIVAS META` | `8 * [Días Hábiles Mes]` |
| `CNR META` | `2 * [Días Hábiles Mes]` |
| `NORMAL META` | `[EFECTIVAS META] - [CNR META]` |
| `Last_Update` | `MAX( 'Control Perdidas Expandido'[Fecha Modificación] )` |

---

## 14. Ruta de Implementación

1. **Validar columnas:** confirmar que `'Control Perdidas Expandido'` trae `[Tipo_CNR.Tipo de CNR]`, `[Resultado final]` y `[Tratamiento]` con los valores documentados en §1.1.
2. **Crear tabla `Calendario`** y marcarla como tabla de fechas (relacionar con `[Fecha ejecución]`).
3. **Cargar tabla `Feriados`** con feriados chilenos del año.
4. **Cargar tablas `Brigadas` y `Precios`** (solo si se replicará pago).
5. **Crear columnas calculadas** `inicio_min`, `fin_min`, `Es Sábado` en la tabla principal.
6. **Crear medidas base** (§2, §3) y validar contra el dashboard actual con un mes de prueba.
7. **Crear tabla calculada `Jornadas`** (§8.2) o equivalente en Power Query.
8. **Implementar metas dinámicas** (§6).
9. **Replicar pago de técnicos** (§9) si está en alcance.
10. **Validar `Promedio Efectivas Oficial`** (§10) contra el endpoint `/promedio_efectivas` del backend.
