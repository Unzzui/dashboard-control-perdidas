// frontend/src/lib/api/justificaciones.ts
import {
  Justificacion,
  AuditEntry,
  ResumenMesPersona,
  CatalogosJustificacion,
  Filters,
} from '@/types';

const API_BASE = '';

export class APIError extends Error {
  constructor(public status: number, public payload: unknown, message: string) {
    super(message);
  }
}

async function request<T>(
  endpoint: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let payload: unknown = null;
    try { payload = await res.json(); } catch { /* ignore */ }
    throw new APIError(res.status, payload, `API error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface JustificacionCreatePayload {
  fecha: string;
  tecnico_nombre: string;
  zona_origen: string | null;
  motivo: string;
  comentario: string | null;
  produccion_real: number;
  meta_diaria: number;
  es_futuro: boolean;
  usuario_registro: string;
}

export interface JustificacionUpdatePayload {
  motivo?: string;
  comentario?: string | null;
  usuario_registro: string;
}

export function getCatalogos(): Promise<CatalogosJustificacion> {
  return request('/api/v1/justificaciones/catalogos');
}

export function createJustificacion(
  payload: JustificacionCreatePayload
): Promise<Justificacion> {
  return request('/api/v1/justificaciones', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateJustificacion(
  id: number,
  payload: JustificacionUpdatePayload
): Promise<Justificacion> {
  return request(`/api/v1/justificaciones/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteJustificacion(
  id: number,
  usuarioRegistro: string
): Promise<void> {
  return request(
    `/api/v1/justificaciones/${id}?usuario_registro=${encodeURIComponent(usuarioRegistro)}`,
    { method: 'DELETE' }
  );
}

export function getJustificacionesPersona(
  tecnicoNombre: string,
  mes: string
): Promise<{ tecnico_nombre: string; mes: string; justificaciones: Justificacion[] }> {
  const enc = encodeURIComponent(tecnicoNombre);
  return request(`/api/v1/justificaciones/persona/${enc}?mes=${mes}`);
}

function buildFilterQS(filters: Partial<Filters>): string {
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

export function getResumenPersona(
  tecnicoNombre: string,
  mes: string,
  filters: Partial<Filters>
): Promise<ResumenMesPersona> {
  const enc = encodeURIComponent(tecnicoNombre);
  const filterQs = buildFilterQS(filters);
  const sep = filterQs ? '&' : '';
  return request(
    `/api/v1/justificaciones/persona/${enc}/resumen?mes=${mes}${sep}${filterQs}`
  );
}

export function getAudit(
  id: number
): Promise<{ justificacion_id: number; audit: AuditEntry[] }> {
  return request(`/api/v1/justificaciones/${id}/audit`);
}
