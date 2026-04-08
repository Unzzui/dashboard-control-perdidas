import { Filters, DashboardData, FilterOptions } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export async function getFilterOptions(): Promise<FilterOptions> {
  return fetchAPI<FilterOptions>('/api/v1/filters');
}

export async function getDashboardData(filters: Partial<Filters>): Promise<DashboardData> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.append(key, String(value));
    }
  });

  const queryString = params.toString();
  const endpoint = queryString ? `/api/v1/dashboard?${queryString}` : '/api/v1/dashboard';

  return fetchAPI<DashboardData>(endpoint);
}

export async function getZonasStats(filters: Partial<Filters>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.append(key, String(value));
    }
  });
  return fetchAPI(`/api/v1/zonas?${params.toString()}`);
}

export async function getTecnicosRanking(filters: Partial<Filters>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.append(key, String(value));
    }
  });
  return fetchAPI(`/api/v1/tecnicos?${params.toString()}`);
}

export async function getGeoData(filters: Partial<Filters>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.append(key, String(value));
    }
  });
  return fetchAPI(`/api/v1/geo?${params.toString()}`);
}
