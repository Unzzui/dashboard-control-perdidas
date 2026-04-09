import { Filters, DashboardData, FilterOptions, RetiroMedidoresData, DetalleAvisoData, ControlDiarioData } from '@/types';

// Usar ruta vacía para aprovechar el proxy de Next.js en next.config.js
// Esto permite que ngrok funcione correctamente para usuarios remotos
const API_BASE = '';

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

function buildQueryString(filters: Partial<Filters>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === null || value === undefined) return;

    // Si es un array, agregar como string separado por comas (si tiene elementos)
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.append(key, value.join(','));
      }
    } else if (typeof value === 'string' && value === '') {
      // Ignorar strings vacíos
      return;
    } else {
      params.append(key, String(value));
    }
  });
  return params.toString();
}

export async function getFilterOptions(): Promise<FilterOptions> {
  return fetchAPI<FilterOptions>('/api/v1/filters');
}

export async function getDashboardData(filters: Partial<Filters>): Promise<DashboardData> {
  const qs = buildQueryString(filters);
  return fetchAPI<DashboardData>(qs ? `/api/v1/dashboard?${qs}` : '/api/v1/dashboard');
}

export async function getZonasStats(filters: Partial<Filters>) {
  const qs = buildQueryString(filters);
  return fetchAPI(`/api/v1/zonas?${qs}`);
}

export async function getTecnicosRanking(filters: Partial<Filters>) {
  const qs = buildQueryString(filters);
  return fetchAPI(`/api/v1/tecnicos?${qs}`);
}

export async function getGeoData(filters: Partial<Filters>) {
  const qs = buildQueryString(filters);
  return fetchAPI(`/api/v1/geo?${qs}`);
}

export async function getControlDiario(filters: Partial<Filters>): Promise<ControlDiarioData> {
  const qs = buildQueryString(filters);
  return fetchAPI<ControlDiarioData>(qs ? `/api/v1/control-diario?${qs}` : '/api/v1/control-diario');
}

export async function getRetiroMedidores(filters: Partial<Filters>): Promise<RetiroMedidoresData> {
  const qs = buildQueryString(filters);
  return fetchAPI<RetiroMedidoresData>(qs ? `/api/v1/retiro-medidores?${qs}` : '/api/v1/retiro-medidores');
}

export async function getDetalleAviso(filters: Partial<Filters>, page: number = 1, pageSize: number = 50): Promise<DetalleAvisoData> {
  const qs = buildQueryString(filters);
  const base = qs ? `/api/v1/detalle-aviso?${qs}` : '/api/v1/detalle-aviso';
  return fetchAPI<DetalleAvisoData>(`${base}${qs ? '&' : '?'}page=${page}&page_size=${pageSize}`);
}
