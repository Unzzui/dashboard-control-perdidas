'use client';

import { useEffect, useState } from 'react';
import { Analista, CARGOS_ANALISTA } from '@/types';
import {
  listAnalistas,
  createAnalista,
  updateAnalista,
  setAnalistaActivo,
} from '@/lib/api/analistas';

const CARGO_PLACEHOLDER = '— Selecciona —';

export default function AnalistasView() {
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Analista | null>(null);

  const cargar = async () => {
    setCargando(true);
    setAnalistas(await listAnalistas(false));
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const totalActivos = analistas.filter(a => a.activo === 1).length;

  const handleToggle = async (a: Analista) => {
    await setAnalistaActivo(a.id, a.activo === 0);
    await cargar();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Analistas</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Personas autorizadas a registrar justificaciones en Control de Metas.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm bg-oca-blue text-white rounded px-3 py-1.5 hover:bg-blue-700"
          >
            Agregar analista
          </button>
        )}
      </div>

      {showForm && (
        <FormularioCrear
          onCancel={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false);
            await cargar();
          }}
        />
      )}

      <div className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
        <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between">
          <span className="font-semibold text-xs uppercase tracking-wide">Lista de analistas</span>
          <span className="text-[10px] text-slate-300">
            {totalActivos} activo{totalActivos === 1 ? '' : 's'} de {analistas.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Nombre</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Cargo</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Correo</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Estado</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Creado</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Cargando…</td></tr>
              )}
              {!cargando && analistas.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Sin analistas. Agrega el primero arriba.</td></tr>
              )}
              {analistas.map(a => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="px-3 py-2">
                    <div className="text-slate-800 font-medium">
                      {a.apellido ? `${a.nombre} ${a.apellido}` : a.nombre}
                    </div>
                    {a.apellido && (
                      <div className="text-[10px] text-slate-400">{a.nombre}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{a.cargo ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{a.correo ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      a.activo === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {a.activo === 1 ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {a.created_at.split('T')[0].split(' ')[0].split('-').reverse().join('-')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEditTarget(a)}
                        className="text-[11px] text-slate-600 hover:text-slate-800 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(a)}
                        className="text-[11px] text-slate-600 hover:text-slate-800 hover:underline"
                      >
                        {a.activo === 1 ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editTarget && (
        <FormularioEditar
          analista={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={async () => {
            setEditTarget(null);
            await cargar();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Form: agregar analista (collapsible card)
// ============================================================================

function FormularioCrear({
  onCancel, onSaved,
}: {
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [cargo, setCargo] = useState('');
  const [correo, setCorreo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valido =
    nombre.trim().length > 0 &&
    cargo !== '' &&
    (correo === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo));

  const handleSubmit = async () => {
    if (!valido || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await createAnalista({
        nombre: nombre.trim(),
        apellido: apellido.trim() || null,
        cargo: cargo || null,
        correo: correo.trim() || null,
      });
      await onSaved();
    } catch {
      setError('No se pudo crear el analista. ¿Nombre duplicado?');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200/60 p-4 space-y-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        Nuevo analista
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre" required>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="diego.bravo"
            className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-oca-blue focus:border-oca-blue"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Identificador único; no se puede cambiar después.
          </p>
        </Field>
        <Field label="Apellido">
          <input
            type="text"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            placeholder="Bravo Belmar"
            className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-oca-blue focus:border-oca-blue"
          />
        </Field>
        <Field label="Cargo" required>
          <select
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-oca-blue focus:border-oca-blue"
          >
            <option value="">{CARGO_PLACEHOLDER}</option>
            {CARGOS_ANALISTA.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Correo">
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="diego.bravo@oca.cl"
            className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-oca-blue focus:border-oca-blue"
          />
        </Field>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
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
          className="px-3 py-1.5 text-sm bg-oca-blue text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Form: editar analista (modal)
// ============================================================================

function FormularioEditar({
  analista, onClose, onSaved,
}: {
  analista: Analista;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [apellido, setApellido] = useState(analista.apellido ?? '');
  const [cargo, setCargo] = useState(analista.cargo ?? '');
  const [correo, setCorreo] = useState(analista.correo ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const correoValido = correo === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  const valido = correoValido;

  const handleSubmit = async () => {
    if (!valido || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await updateAnalista(analista.id, {
        apellido: apellido.trim(),
        cargo: cargo,
        correo: correo.trim(),
      });
      await onSaved();
    } catch {
      setError('No se pudo guardar los cambios.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-sm">Editar analista</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-3">
          <Field label="Nombre (handle)">
            <input
              type="text"
              value={analista.nombre}
              disabled
              className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 bg-slate-50 text-slate-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              No se puede modificar (preserva la trazabilidad del audit log).
            </p>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Apellido">
              <input
                type="text"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-oca-blue focus:border-oca-blue"
              />
            </Field>
            <Field label="Cargo">
              <select
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-oca-blue focus:border-oca-blue"
              >
                <option value="">{CARGO_PLACEHOLDER}</option>
                {CARGOS_ANALISTA.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Correo">
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className={`w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-oca-blue focus:border-oca-blue ${
                correoValido ? 'border-slate-200' : 'border-red-300'
              }`}
            />
            {!correoValido && (
              <p className="text-[10px] text-red-600 mt-1">Correo no válido.</p>
            )}
          </Field>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!valido || enviando}
              className="px-3 py-1.5 text-sm bg-oca-blue text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enviando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function Field({
  label, required, children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
