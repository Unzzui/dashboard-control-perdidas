// frontend/src/lib/api/produccion.ts
import { Filters, PagoTecnico } from '@/types';

const API_BASE = '';

function buildQS(filters: Partial<Filters>, extra: Record<string, string | number | undefined> = {}): string {
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
  Object.entries(extra).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
  });
  return params.toString();
}

async function request<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export function getPagoTecnicos(
  filters: Partial<Filters>,
  diaMax?: number,
): Promise<PagoTecnico[]> {
  const qs = buildQS(filters, { dia_max: diaMax });
  return request(`/api/v1/produccion/pago-tecnicos${qs ? `?${qs}` : ''}`);
}

export interface RawProduccionResponse {
  total: number;
  dia_max: number | null;
  columnas: string[];
  rows: Array<Record<string, string | number | null>>;
}

export function getProduccionRaw(
  filters: Partial<Filters>,
  diaMax?: number,
): Promise<RawProduccionResponse> {
  const qs = buildQS(filters, { dia_max: diaMax });
  return request(`/api/v1/produccion/raw${qs ? `?${qs}` : ''}`);
}
