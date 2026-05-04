'use client';

import { useState, useEffect } from 'react';
import { Justificacion, AuditEntry } from '@/types';
import { getAudit } from '@/lib/api/justificaciones';

interface Props {
  justificacion: Justificacion;
  motivosLabel: Record<string, string>;
  onEditar: () => void;
  onEliminar: (usuarioRegistro: string) => Promise<void>;
  analistasParaEliminar: string[];
}

export default function JustificacionFicha({
  justificacion, motivosLabel, onEditar, onEliminar, analistasParaEliminar,
}: Props) {
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [usuarioElim, setUsuarioElim] = useState(analistasParaEliminar[0] ?? '');
  const [eliminando, setEliminando] = useState(false);

  const handleEliminar = async () => {
    if (!usuarioElim) return;
    setEliminando(true);
    try {
      await onEliminar(usuarioElim);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Item label="Motivo" value={motivosLabel[justificacion.motivo] ?? justificacion.motivo} />
        <Item
          label="Tipo"
          value={justificacion.tipo_evento === 'dia_no_trabajado' ? 'Día no trabajado' : 'Baja producción'}
        />
        <Item label="Registrado por" value={justificacion.usuario_registro} />
        <Item label="Fecha registro" value={formatFecha(justificacion.created_at)} />
      </div>

      {justificacion.comentario && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Comentario</p>
          <p className="text-xs text-slate-700 bg-slate-50 rounded p-2 italic">
            &ldquo;{justificacion.comentario}&rdquo;
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onEditar}
          className="flex-1 px-3 py-1.5 text-sm border border-slate-300 text-slate-700 rounded hover:bg-slate-50"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => setMostrarConfirm(true)}
          className="flex-1 px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50"
        >
          Eliminar
        </button>
      </div>

      {mostrarConfirm && (
        <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2">
          <p className="text-xs text-red-800">¿Eliminar justificación?</p>
          <select
            className="w-full text-xs border border-red-200 rounded px-2 py-1"
            value={usuarioElim}
            onChange={(e) => setUsuarioElim(e.target.value)}
          >
            {analistasParaEliminar.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleEliminar}
              disabled={eliminando || !usuarioElim}
              className="flex-1 px-2 py-1 text-xs bg-red-600 text-white rounded disabled:opacity-50"
            >
              {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button
              type="button"
              onClick={() => setMostrarConfirm(false)}
              className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <Historial justificacionId={justificacion.id} />
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-slate-800">{value}</p>
    </div>
  );
}

function formatFecha(iso: string): string {
  // 2026-05-03T10:30:00 → 03-05-2026 10:30
  const [date, timeFull] = iso.split('T');
  const [y, m, d] = date.split('-');
  const time = (timeFull ?? '00:00').slice(0, 5);
  return `${d}-${m}-${y} ${time}`;
}

function Historial({ justificacionId }: { justificacionId: number }) {
  const [abierto, setAbierto] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!abierto || entries !== null) return;
    setCargando(true);
    getAudit(justificacionId)
      .then(r => setEntries(r.audit))
      .catch(() => setEntries([]))
      .finally(() => setCargando(false));
  }, [abierto, entries, justificacionId]);

  return (
    <div className="border-t border-slate-200 pt-3">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1"
      >
        Historial {entries && `(${entries.length})`}
        <span>{abierto ? '▾' : '▸'}</span>
      </button>
      {abierto && (
        <div className="mt-2 space-y-1.5 text-[11px] text-slate-600">
          {cargando && <p className="text-slate-400">Cargando…</p>}
          {!cargando && entries && entries.length === 0 && (
            <p className="text-slate-400">Sin historial</p>
          )}
          {entries?.map((e, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <div>
                <span className="text-slate-400">{formatFecha(e.created_at)}</span>{' '}
                <span className="font-medium">{e.usuario}</span>{' '}
                <span className="uppercase text-[9px] bg-slate-200 px-1 rounded">
                  {e.accion}
                </span>
              </div>
              {e.diff_json && (
                <ul className="ml-4 text-[10px] text-slate-500 list-disc">
                  {Object.entries(e.diff_json).map(([campo, val]) => (
                    <li key={campo}>
                      {campo}: {String(val.antes)} → {String(val.despues)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
