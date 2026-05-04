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

export function listAnalistas(soloActivos = false): Promise<Analista[]> {
  return request(`/api/v1/analistas${soloActivos ? '?activos=true' : ''}`);
}

export function createAnalista(nombre: string): Promise<Analista> {
  return request('/api/v1/analistas', {
    method: 'POST',
    body: JSON.stringify({ nombre }),
  });
}

export function setAnalistaActivo(id: number, activo: boolean): Promise<Analista> {
  return request(`/api/v1/analistas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ activo: activo ? 1 : 0 }),
  });
}
