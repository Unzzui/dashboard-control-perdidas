# Dashboard Control de Pérdidas

Panel de control para la gestión y análisis de Control de Pérdidas - OCA Global / TUSAN.

## Características

- Dashboard interactivo con múltiples vistas de análisis
- 10 filtros dinámicos (Año, Mes, Día, Zona, Regional, Supervisor, Estado, Tratamiento, Campaña, Técnico)
- Indicadores clave de rendimiento (KPIs)
- Gráficos interactivos (barras apiladas, gauges, donuts, líneas)
- Rankings de técnicos por CNR y Efectivas
- Análisis de efectividad mensual
- Control de normalizaciones
- Seguimiento de visitas fallidas
- Producción mensual por zona

## Tecnologías

### Frontend
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- ECharts (gráficos)
- Tremor UI (componentes)

### Backend
- FastAPI
- Python 3.11+
- Pandas
- PyArrow (lectura de Parquet)

## Requisitos

- Node.js 18+
- Python 3.11+
- npm o yarn

## Instalación

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# o: venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```

## Ejecución

### Opción 1: Script de inicio
```bash
chmod +x start.sh
./start.sh
```

### Opción 2: Manual

Backend:
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

Frontend:
```bash
cd frontend
npm run dev
```

## Acceso

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **Documentación API:** http://localhost:8000/docs

## Estructura del Proyecto

```
dashboard-control-perdidas/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   │   ├── charts/
│   │   │   ├── layout/
│   │   │   ├── ui/
│   │   │   └── views/
│   │   ├── lib/
│   │   └── types/
│   └── package.json
├── backend/
│   ├── main.py
│   └── requirements.txt
├── start.sh
└── README.md
```

## Vistas del Dashboard

1. **Indicadores Generales** - KPIs principales y tabla por zona
2. **Resultados por Delegación** - Análisis detallado por zona y campañas
3. **Ranking CNR/Efectivas** - Rankings de técnicos con metas
4. **Efectividad Mensual** - Tendencias y gauges de cumplimiento
5. **Visitas Fallidas** - Análisis de responsabilidad
6. **Normalizaciones** - Estado de tratamientos
7. **Producción Mensual** - Cumplimiento de metas por zona
8. **Control kWh** - Energía recuperada
9. **Mapa de Operaciones** - Geolocalización

## Métricas Principales

- **CNR:** Consumo No Registrado (detección de anomalías)
- **Efectivas:** Visitas realizadas con resultado (Normal + CNR)
- **Visita Fallida:** Visitas sin resultado por causas diversas
- **kWh Recuperado:** Energía recuperada por detección de fraudes
