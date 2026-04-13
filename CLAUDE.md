# Directrices para Claude - Dashboard Control de Pérdidas

## Filosofía de Diseño: Minimalismo Ejecutivo

Este proyecto sigue una filosofía de **"Minimalismo Ejecutivo de Alto Impacto"**. Cada elemento visual debe aportar claridad estratégica o ser eliminado.

### Principios Fundamentales

1. **Claridad sobre Ornamentación**
   - NO emojis
   - NO iconos decorativos
   - NO elementos sin función analítica
   - El diseño transmite seriedad y autoridad técnica

2. **Minimalismo con Intención**
   - Espacios amplios y respiración visual
   - Jerarquía tipográfica clara
   - Uso limitado del color
   - Sin bordes gruesos, sombras dramáticas o efectos

3. **Datos como Protagonistas**
   - El diseño nunca compite con los datos
   - Sin gráficos sobrecargados ni efectos 3D
   - Escalas consistentes y claridad numérica

4. **Elegancia Silenciosa**
   - Un diseño premium no grita
   - Impacta por orden, limpieza y seguridad visual

---

## Paleta de Colores

### Colores Principales
| Uso | Color | Hex | Tailwind |
|-----|-------|-----|----------|
| Primario (OCA Blue) | Azul corporativo | `#294D6D` | `text-oca-blue`, `bg-oca-blue` |
| Secundario | Azul claro | `#4A7BA7` | `text-blue-500` |
| Fondo | Slate 50 | `#f8fafc` | `bg-slate-50` |
| Texto principal | Slate 800 | `#1e293b` | `text-slate-800` |
| Texto secundario | Slate 500 | `#64748b` | `text-slate-500` |

### Colores de Estado (solo para indicar estado, NO decoración)
| Estado | Hex | Tailwind |
|--------|-----|----------|
| Éxito | `#10B981` | `text-green-500`, `bg-green-50` |
| Alerta | `#F59E0B` | `text-amber-500`, `bg-amber-50` |
| Error | `#DE473C` | `text-red-500`, `bg-red-50` |

---

## Tipografía

- **Familia:** Inter (sans-serif)
- **KPI Values:** `text-2xl font-bold` (36px, 700)
- **Títulos sección:** `text-sm font-semibold uppercase tracking-wide text-slate-500`
- **Labels:** `text-[10px] uppercase tracking-wider text-slate-400`
- **Tablas headers:** `text-[10px] font-semibold uppercase text-slate-500`
- **Tablas celdas:** `text-[11px] text-slate-600`

---

## Componentes UI

### Cards
```
bg-white rounded-lg border border-slate-200/60 shadow-sm
padding: px-4 py-3 o p-4
```

### Tablas
```
Headers: bg-slate-50 text-[10px] uppercase text-slate-500 font-semibold
Celdas: text-[11px] text-slate-600
Hover: hover:bg-slate-50/80
Bordes: border-b border-slate-100
```

### KPI Cards
```
Label: text-[10px] uppercase tracking-wider text-slate-400
Value: text-2xl font-bold text-slate-800
Subtitle: text-[10px] text-slate-400
```

### Barras de Progreso
```
Container: h-1.5 bg-slate-100 rounded-full
Fill: bg-oca-blue rounded-full (o color semántico)
```

### Headers de Zona (en tablas agrupadas)
```
bg-slate-800 text-white text-xs font-semibold px-3 py-2
(Usar slate-800 en lugar de oca-blue para mayor sobriedad)
```

---

## Gráficos (ECharts)

- Grid lines: `#f1f5f9` punteadas
- Axis labels: `fontSize: 10`, `color: '#64748b'`
- Tooltips: `bg-white`, `border: #e5e7eb`, `shadow-lg`
- Sin efectos 3D ni gradientes llamativos
- Barras: `barMaxWidth: 24`

---

## Reglas Operativas

1. **Eliminar** cualquier elemento decorativo sin valor analítico
2. **Reducir** colores al mínimo necesario
3. **Priorizar** tipografía clara y profesional
4. **Evitar** iconografía innecesaria y emojis
5. **Garantizar** alineación perfecta (grid estructurado)
6. **Maximizar** legibilidad sobre creatividad
7. **Si hay duda entre añadir o eliminar, ELIMINAR**

---

## Estructura de Vistas

Cada vista debe seguir esta jerarquía:
1. **KPIs principales** - Grid de 4-6 cards con métricas clave
2. **Visualizaciones** - Tablas y gráficos lado a lado
3. **Detalle** - Tablas expandidas o desglose por zona

---

## Ejemplos de Código

### KPI Card correcto
```tsx
<div className="bg-white rounded-lg border border-slate-200/60 p-4">
  <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
    Total KWH
  </p>
  <p className="text-2xl font-bold text-slate-800">
    {formatValue(value)}
  </p>
  <p className="text-[10px] text-slate-400 mt-1">
    Estimado del período
  </p>
</div>
```

### Tabla correcta
```tsx
<table className="w-full text-[11px]">
  <thead>
    <tr className="border-b border-slate-200">
      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">
        Zona
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-slate-50 hover:bg-slate-50/80">
      <td className="px-3 py-2 text-slate-600">{value}</td>
    </tr>
  </tbody>
</table>
```

### Header de grupo/zona
```tsx
<tr className="bg-slate-800 text-white">
  <td className="px-3 py-2 text-xs font-semibold" colSpan={4}>
    {zonaName}
  </td>
  <td className="px-3 py-2 text-xs font-bold text-right">
    {total}
  </td>
</tr>
```

---

## Referencias

- Ver `/docs/DESIGN_PHILOSOPHY.md` para filosofía completa
- Ver `/docs/STYLE_GUIDE.md` para especificaciones detalladas
- Ver `/docs/TECH_STACK.md` para arquitectura técnica
