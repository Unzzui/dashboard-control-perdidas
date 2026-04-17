# Cambios en Estructura de Zonas - Dashboard Control de Pérdidas

## Fecha: 2026-04-16

## Resumen
Se actualizó la estructura de datos del parquet consolidado para diferenciar entre la **zona del técnico** y la **zona donde se realizó la inspección**.

## Problema Anterior
- Solo existía una columna `zona` que representaba la zona de origen del técnico (del mapeo)
- No se podía identificar cuándo un técnico prestaba apoyo en otra zona
- Las tarifas y métricas no reflejaban correctamente dónde se realizaba el trabajo
- Cuando los datos venían del Excel (sin columna Zonal de CGE), `zona_inspeccion` quedaba vacía

## Nueva Estructura

### Columnas Agregadas

#### 1. Información del Técnico (del mapeo de usuarios)
- **`zona_tecnico`**: Zona de origen del técnico
- **`regional_tecnico`**: Regional del técnico

#### 2. Información de la Inspección (de data CGE/Metabase)
- **`zona_inspeccion`**: Zona donde se realizó la inspección
- **`regional_inspeccion`**: Regional de la inspección

#### 3. Columnas Calculadas (para compatibilidad)
- **`zona`**: Prioriza `zona_inspeccion`, fallback a `zona_tecnico`
- **`Regional`**: Prioriza `regional_inspeccion`, fallback a `regional_tecnico`

### 4. Auto-Poblado Inteligente ⭐
**Cuando los datos vienen del Excel** (sin columna "Zonal" de CGE):
- `zona_inspeccion` se llena automáticamente con `zona_tecnico`
- `regional_inspeccion` se llena automáticamente con `regional_tecnico`
- **Resultado**: 100% de cobertura en todas las columnas, sin valores vacíos

**Cuando los datos vienen del CSV de Metabase**:
- `zona_inspeccion` usa el valor real de la columna "Zonal" del CSV
- `zona_tecnico` viene del mapeo de usuarios
- **Resultado**: Permite detectar técnicos trabajando en otras zonas (2.9% de casos)

## Cambios en el Código Fuente

### 1. `/utils/transforms.py` - `aplicar_joins_mapeo()`
**Auto-poblado de zona_inspeccion**:
```python
# Si zona_inspeccion no existe o está vacía, poblarla con zona_tecnico
if 'zona_inspeccion' not in df.columns:
    df['zona_inspeccion'] = df['zona_tecnico'].copy()
else:
    # Llenar valores vacíos/nulos con zona_tecnico
    mask_vacio = (
        df['zona_inspeccion'].isna() |
        (df['zona_inspeccion'].astype(str).str.strip() == '') |
        (df['zona_inspeccion'].astype(str).str.strip() == 'nan')
    )
    df.loc[mask_vacio, 'zona_inspeccion'] = df.loc[mask_vacio, 'zona_tecnico']
```

### 2. `/utils/transforms.py` - `aplicar_tarifa()`
**Cálculo robusto de columnas combinadas**:
```python
# Crear columna 'zona' con fallback inteligente
df['zona'] = df['zona_inspeccion'].copy()
mask_vacio = (
    df['zona'].isna() |
    (df['zona'].astype(str).str.strip() == '')
)
df.loc[mask_vacio, 'zona'] = df.loc[mask_vacio, 'zona_tecnico']
```

## Cambios en el Backend

### 1. `/backend/app/dependencies.py`
```python
# Se agregaron las nuevas columnas de zona como categorías
cat_columns = [
    'zona', 'Regional',  # Columnas calculadas (compatibilidad)
    'zona_tecnico', 'regional_tecnico',  # Zona del técnico
    'zona_inspeccion', 'regional_inspeccion',  # Zona de la inspección
    # ... otras columnas
]
```

### 2. `/backend/app/services/alertas_operativas.py` ⭐ MODIFICADO
**Cambio**: Ahora usa `zona_tecnico` para todas las alertas de técnicos.

```python
# ANTES: Agrupaba por 'zona' (ambiguo)
for zona in sorted(df['zona'].unique()):
    zona_df = df[df['zona'] == zona]

# DESPUÉS: Agrupa por 'zona_tecnico' (zona de origen del técnico)
for zona_tecnico in sorted(df['zona_tecnico'].unique()):
    zona_df = df[df['zona_tecnico'] == zona_tecnico]
```

**Secciones modificadas**:
- Técnicos inactivos
- Metas no cumplidas
- Problemas de jornada
- Alta visita fallida
- Resumen por zona

### 3. `/backend/app/services/produccion.py` ⭐ MODIFICADO
**Cambio**: Ahora usa `zona_inspeccion` para calcular producción.

```python
# ANTES: Calculaba por 'zona' (ambiguo)
for zona_name in filtered['zona'].dropna().unique():
    zona_df = filtered[filtered['zona'] == zona_name]

# DESPUÉS: Calcula por 'zona_inspeccion' (donde se hizo el trabajo)
zona_col = 'zona_inspeccion' if 'zona_inspeccion' in filtered.columns else 'zona'
for zona_name in filtered[zona_col].dropna().unique():
    zona_df = filtered[filtered[zona_col] == zona_name]
```

### 4. `/backend/app/services/zonas.py` ⭐ MODIFICADO
**Cambio**: Ahora usa `zona_inspeccion` para métricas por zona.

```python
# Calcula métricas (CNR, efectividad) por zona donde se trabajó
zona_col = 'zona_inspeccion' if 'zona_inspeccion' in filtered.columns else 'zona'
```

### 2. Parquet Actualizado
- **Archivo**: `/backend/data/resultado_consolidado.parquet`
- **Tamaño**: ~14 MB
- **Registros**: 127,796
- **Columnas**: 61

## Estrategia de Metas y Alertas ⚠️ IMPORTANTE

### Gestión Diferenciada por Tipo de Métrica

Como los técnicos pueden trabajar en diferentes zonas, implementamos una **estrategia mixta**:

#### 1. **Alertas de Técnicos** → Por `zona_tecnico`
**Servicios**: `/app/services/alertas_operativas.py`

Las alertas de gestión de personas se asignan a la **zona de origen del técnico**:
- ✅ Técnicos inactivos
- ✅ Metas no cumplidas (CNR < 2, Efectivas < 8)
- ✅ Problemas de jornada
- ✅ Alta visita fallida (> 30%)

**Razón**: El supervisor de la zona del técnico es responsable de su gestión, independientemente de dónde trabaje.

**Ejemplo**:
```
Técnico: Luis Cornejo
- zona_tecnico: COLCHAGUA - CARDENAL CARO
- zona_inspeccion: QUINTA MELIPILLA (apoyando)

→ Alerta aparece en: COLCHAGUA (supervisor del técnico)
```

#### 2. **Producción y Resultados** → Por `zona_inspeccion`
**Servicios**:
- `/app/services/produccion.py`
- `/app/services/zonas.py`

Las métricas de producción y resultados se calculan por **zona donde se realizó el trabajo**:
- ✅ Producción ($)
- ✅ % de cumplimiento de meta
- ✅ CNR por zona
- ✅ Efectividad por zona

**Razón**: La producción debe reflejarse en la zona que recibió el beneficio del trabajo.

**Ejemplo**:
```
Técnico de COLCHAGUA trabaja en MELIPILLA:
- zona_tecnico: COLCHAGUA
- zona_inspeccion: MELIPILLA
- Valor Unitario: $50,000

→ Producción se suma a: MELIPILLA
→ Alertas del técnico van a: COLCHAGUA
```

### Filtros Existentes
Los filtros por `zona` y `Regional` funcionan correctamente:
- Filtran por `zona_inspeccion` cuando disponible
- Fallback a `zona_tecnico` si no hay `zona_inspeccion`

## Datos Estadísticos

### Última Actualización (2026-04-16)
**Parquet consolidado**: 175,617 registros

#### Cobertura de Datos
- ✅ **100% de cobertura** en todas las columnas de zona
- ✅ **0 valores vacíos** gracias al auto-poblado inteligente

#### Distribución de Trabajo
- **170,463 inspecciones (97.1%)**: Técnicos trabajando en su zona de origen
- **5,154 inspecciones (2.9%)**: Técnicos prestando apoyo en otras zonas

Esto confirma que aunque la mayoría de técnicos trabaja en su zona, existe un porcentaje significativo de apoyo entre zonas que ahora es detectable y medible.

### Ejemplos Reales
```
Técnico: Hernán Felipe Lopez Rios
- zona_tecnico: 08. COLCHAGUA - CARDENAL CARO
- zona_inspeccion: 05. QUINTA MELIPILLA
→ Técnico de COLCHAGUA trabajando en QUINTA MELIPILLA

Técnico: RODRIGO ALEXIS AGUILERA BARAHONA
- zona_tecnico: 07. RANCAGUA
- zona_inspeccion: 05. QUINTA MELIPILLA
→ Técnico de RANCAGUA trabajando en QUINTA MELIPILLA
```

## Casos de Uso

### 1. Ver Alertas de un Técnico
```python
# Las alertas aparecen en la zona del técnico
df_alertas = df[df['zona_tecnico'] == '07. RANCAGUA']
# Incluye todo el trabajo del técnico, incluso si apoyó en otras zonas
```

### 2. Ver Producción de una Zona
```python
# La producción refleja el trabajo hecho en esa zona
df_prod = df[df['zona_inspeccion'] == '05. QUINTA MELIPILLA']
# Incluye trabajo de técnicos propios Y técnicos de apoyo de otras zonas
```

### 3. Detectar Apoyo entre Zonas
```python
# Técnicos trabajando fuera de su zona
df_apoyo = df[df['zona_tecnico'] != df['zona_inspeccion']]
```

### 4. Analizar Rendimiento de Técnicos por Supervisor
```python
# Agrupar por zona_tecnico para ver equipo del supervisor
df.groupby('zona_tecnico')['Nombre asignado'].nunique()
```

### 5. Comparar Zonas por Resultados
```python
# Agrupar por zona_inspeccion para ver qué zonas producen más
df.groupby('zona_inspeccion')['Valor Unitario'].sum()
```

## Próximos Pasos

### Opcional - Filtros Adicionales
Si se necesita filtrar específicamente por zona del técnico:

1. Agregar parámetros en `/app/models/filters.py`:
```python
zona_tecnico: Optional[str] = Query(None)
zona_inspeccion: Optional[str] = Query(None)
```

2. Actualizar `/app/dependencies.py`:
```python
if params.zona_tecnico:
    mask &= df['zona_tecnico'].isin(_parse_list_param(params.zona_tecnico))
if params.zona_inspeccion:
    mask &= df['zona_inspeccion'].isin(_parse_list_param(params.zona_inspeccion))
```

## Testing

Para verificar que todo funcione:
```bash
cd /home/Diego_Bravo/Proyectos/dashboard-control-perdidas/backend
source venv/bin/activate
python -c "from app.dependencies import get_dataframe; df = get_dataframe(); print(df[['zona_tecnico', 'zona_inspeccion', 'zona']].head())"
```

## Actualización de Datos

Para actualizar el parquet con nuevos datos:
```bash
cd /home/Diego_Bravo/Proyectos/prueba_bi_control_perdidas
python3 run_consolidation.py --metabase

# Copiar al backend
cp data/parquet/resultado_consolidado.parquet ../dashboard-control-perdidas/backend/data/
```
