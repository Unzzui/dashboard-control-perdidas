// frontend/src/lib/api/analistas.ts
import { Analista } from '@/types';

const API_BASE = '';

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface AnalistaCreatePayload {
  nombre: string;
  apellido?: string | null;
  cargo?: string | null;
  correo?: string | null;
}

export interface AnalistaUpdatePayload {
  apellido?: string | null;
  cargo?: string | null;
  correo?: string | null;
  activo?: 0 | 1;
}

export function listAnalistas(soloActivos = false): Promise<Analista[]> {
  return request(`/api/v1/analistas${soloActivos ? '?activos=true' : ''}`);
}

export function createAnalista(payload: AnalistaCreatePayload): Promise<Analista> {
  return request('/api/v1/analistas', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAnalista(id: number, payload: AnalistaUpdatePayload): Promise<Analista> {
  return request(`/api/v1/analistas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function setAnalistaActivo(id: number, activo: boolean): Promise<Analista> {
  return updateAnalista(id, { activo: activo ? 1 : 0 });
}
