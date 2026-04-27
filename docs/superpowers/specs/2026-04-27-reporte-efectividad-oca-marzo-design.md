# Reporte de Efectividad OCA — Marzo 2026

## Objetivo

Generar un archivo Excel ejecutivo y profesional que defienda la efectividad operativa de OCA durante marzo 2026, mostrando resultados consolidados, visitas fallidas y su distribución por responsabilidad (OCA vs CGE), y cuantificando cómo las visitas fallidas atribuibles a CGE afectan la métrica final de efectividad.

## Fuente de datos

- Archivo: `backend/data/resultado_consolidado.parquet`
- Universo: 180,912 registros históricos (jul-2024 a abr-2026), todos del contratista OCA.
- Filtro del reporte: `Fecha ejecución` dentro del rango `[2026-03-01, 2026-04-01)` → 10,376 inspecciones.

## Definiciones operativas

### Resultados de visita (campo `Resultado visita`)
- **Normal**: visita ejecutada, servicio sin anomalías.
- **CNR**: visita ejecutada, se detectó Consumo No Registrado (hallazgo positivo, entregable principal de OCA).
- **Visita fallida**: no se pudo completar la inspección.
- **Cierre por anulación**: orden anulada antes/durante ejecución.
- **Mantenimiento Medidor**: intervención técnica.

### Responsabilidad (campo `Responsabilidad`)
- **Responsabilidad Contratista** = atribuible a OCA.
- **Responsabilidad CGE** = atribuible al cliente / sistema CGE (casa deshabitada, desconectado en BT/MT, sin empalme, sitio eriazo, zona peligrosa, sin acceso por caja tortuga).
- **Sin responsabilidad asignada** (campo vacío) = la mayoría; se reporta tal cual sin reclasificar.

### Métricas de efectividad

Las tres se reportan en paralelo:

1. **Efectividad de Hallazgo** = `(Normal + CNR) / Total visitas`
   - Mide la proporción de visitas con resultado conclusivo.

2. **Efectividad Operativa** = `1 − (Visitas fallidas / Total visitas)`
   - Mide la capacidad de OCA de completar la visita.

3. **Efectividad Ajustada por CGE** = `1 − (Fallidas no CGE / (Total − Fallidas CGE))`
   - Excluye del denominador las visitas fallidas atribuibles a CGE.
   - Es la métrica de defensa: refleja la efectividad de OCA descontando lo que no controla.

## Estructura del Excel

Archivo de salida: `backend/data/reporte_oca_marzo_2026.xlsx`

| # | Hoja | Contenido |
|---|------|-----------|
| 1 | **Resumen Ejecutivo** | 5 KPIs en cards + frase de cierre con efectividad bruta vs ajustada |
| 2 | **Resultados Globales** | Tabla con los 5 resultados de visita: cantidad y % sobre total |
| 3 | **Visitas Fallidas y Responsabilidad** | Matriz `Resultado final × Responsabilidad` para las 4,288 fallidas; totales por columna y fila |
| 4 | **Efectividad por Regional** | Centro / Norte / Sur, cada una con: Total, Normal, CNR, Fallidas (Total/CGE/OCA), 3 efectividades |
| 5 | **Efectividad por Zona** | Mismo formato que (4) para las 9 zonas |
| 6 | **Efectividad por Tipo de Campaña** | Mismo formato para los tipos de campaña presentes en marzo |
| 7 | **Metodología** | Definiciones, fórmulas literales, criterio de filtro de fecha, fuente de datos, fecha de generación |

### KPIs del Resumen Ejecutivo

1. Total inspecciones ejecutadas (marzo 2026)
2. Visitas con resultado conclusivo: cantidad y % (Normal + CNR)
3. CNR detectados: cantidad de casos + kWh CNR recuperados
4. Visitas fallidas totales y % atribuible a CGE
5. Efectividad bruta operativa vs Efectividad ajustada por CGE (mostrar las dos cifras juntas)

## Estilo visual

Sigue `CLAUDE.md` — Minimalismo Ejecutivo:

- **Sin emojis ni iconografía decorativa**.
- Fuente: Calibri 11 (predeterminada Excel).
- Color primario: `#294D6D` (OCA Blue) para headers de tabla y títulos.
- Fondo header de tabla: `#294D6D` con texto blanco bold uppercase.
- Fondo header de zona/grupo: `#1E293B` (slate-800) con texto blanco.
- Fondo de filas alternas: blanco / `#F8FAFC` (slate-50).
- Bordes finos `#E2E8F0` (slate-200).
- Números enteros con separador de miles, porcentajes con 1 decimal.
- Anchos de columna ajustados al contenido; sin texto truncado.
- Hoja "Resumen Ejecutivo" sin gridlines, con bloques de KPI tipo card.

## Implementación técnica

- **Script**: `backend/scripts/generar_reporte_oca_marzo.py`
- **Librerías**: `pandas` (lectura parquet), `openpyxl` (escritura Excel con estilos).
- **Re-ejecutable**: el script lee el parquet y regenera el `.xlsx` desde cero. No depende de un Excel previo.
- **Parametrizable** internamente: año y mes como constantes al inicio del script (no CLI args, mantener simple).
- **Output**: `backend/data/reporte_oca_marzo_2026.xlsx`.

## Criterios de éxito

- El Excel abre correctamente en Excel/LibreOffice sin errores de formato.
- Los totales de cada hoja cuadran con los del Resumen Ejecutivo.
- La hoja Metodología explica cada fórmula de forma que un lector no técnico entienda la diferencia entre efectividad bruta y ajustada.
- El estilo visual respeta `CLAUDE.md` (sin emojis, paleta sobria, tipografía limpia).
- Re-ejecutar el script reproduce el archivo idéntico.

## Fuera de alcance

- Valorización monetaria del kWh CNR (omitida explícitamente — solo se reporta volumen físico).
- Comparativos contra otros meses o contra otros contratistas (universo es solo OCA).
- Desglose por supervisor.
- Gráficos embebidos en el Excel (los datos hablan por sí mismos; tablas claras > gráficos).
