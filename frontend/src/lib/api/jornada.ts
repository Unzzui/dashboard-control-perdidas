// frontend/src/lib/api/jornada.ts
import { Filters, AnalisisJornadaMensual } from '@/types';

const API_BASE = '';

function buildQS(filters: Partial<Filters>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) {
      if (v.length > 0) params.append(k, v.join(','));
    } else if (typeof v === 'string' && v === '') {
      return;
    } else {
      params.append(k, String(v));
    }
  });
  return params.toString();
}

async function request<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export function getAnalisisJornadaMensual(filters: Partial<Filters>): Promise<AnalisisJornadaMensual> {
  const qs = buildQS(filters);
  return request(`/api/v1/analisis-jornada/mensual${qs ? `?${qs}` : ''}`);
}
