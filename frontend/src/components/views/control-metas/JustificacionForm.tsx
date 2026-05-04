'use client';

import { useState, useMemo } from 'react';
import { Analista, CatalogoMotivo, TipoEventoJustificacion, Justificacion } from '@/types';

interface Props {
  fecha: string;
  tipoEvento: TipoEventoJustificacion;
  produccionReal: number;
  metaDiaria: number;
  zonaOrigen: string;
  esFuturo: boolean;
  motivosCatalogo: CatalogoMotivo[];
  analistas: Analista[];
  initial?: Justificacion;        // si está, modo "editar"
  onSubmit: (data: {
    motivo: string;
    comentario: string | null;
    usuarioRegistro: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export default function JustificacionForm({
  fecha, tipoEvento, produccionReal, metaDiaria, zonaOrigen, esFuturo,
  motivosCatalogo, analistas, initial, onSubmit, onCancel,
}: Props) {
  const [motivo, setMotivo] = useState(initial?.motivo ?? '');
  const [comentario, setComentario] = useState(initial?.comentario ?? '');
  const [usuario, setUsuario] = useState(initial?.usuario_registro ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comentarioObligatorio = motivo === 'otro';
  const comentarioValido = !comentarioObligatorio
    || (comentario.trim().length >= 10);

  const valido = useMemo(
    () => motivo !== '' && usuario !== '' && comentarioValido,
    [motivo, usuario, comentarioValido]
  );

  const handleSubmit = async () => {
    if (!valido || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await onSubmit({
        motivo,
        comentario: comentario.trim() || null,
        usuarioRegistro: usuario,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Tipo de evento
        </p>
        <div className="text-sm text-slate-800">
          {tipoEvento === 'dia_no_trabajado' ? 'Día no trabajado' : 'Baja producción'}{' '}
          <span className="text-slate-400">(auto)</span>
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Motivo *
        </label>
        <select
          className="w-full text-sm border border-slate-200 rounded px-2 py-1.5"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        >
          <option value="">Selecciona motivo</option>
          {motivosCatalogo.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Comentario {comentarioObligatorio && '*'}
        </label>
        <textarea
          className={`w-full text-sm border rounded px-2 py-1.5 ${
            comentarioObligatorio && !comentarioValido
              ? 'border-red-300' : 'border-slate-200'
          }`}
          rows={3}
          maxLength={500}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder={comentarioObligatorio ? 'Mínimo 10 caracteres' : 'Opcional'}
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Registrado por *
        </label>
        <select
          className="w-full text-sm border border-slate-200 rounded px-2 py-1.5"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        >
          <option value="">Selecciona analista</option>
          {analistas.map(a => {
            const fullname = a.apellido ? `${a.nombre} ${a.apellido}` : a.nombre;
            const label = a.cargo ? `${fullname} — ${a.cargo}` : fullname;
            return (
              <option key={a.id} value={a.nombre}>{label}</option>
            );
          })}
        </select>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!valido || enviando}
          className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enviando ? 'Guardando…' : esFuturo ? 'Guardar (planificado)' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
