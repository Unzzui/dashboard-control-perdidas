'use client';

import { useEffect, useState } from 'react';
import { Analista } from '@/types';
import { listAnalistas, createAnalista, setAnalistaActivo } from '@/lib/api/analistas';

export default function AnalistasView() {
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    setAnalistas(await listAnalistas(false));
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const handleAgregar = async () => {
    if (!nuevoNombre.trim()) return;
    setError(null);
    try {
      await createAnalista(nuevoNombre.trim());
      setNuevoNombre('');
      await cargar();
    } catch {
      setError('No se pudo agregar (¿nombre duplicado?)');
    }
  };

  const handleToggle = async (a: Analista) => {
    await setAnalistaActivo(a.id, a.activo === 0);
    await cargar();
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Analistas</h2>
        <p className="text-sm text-slate-500">
          Lista de analistas que pueden registrar justificaciones.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="nombre.apellido"
            className="flex-1 text-sm border border-slate-200 rounded px-3 py-1.5"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAgregar(); }}
          />
          <button
            type="button"
            onClick={handleAgregar}
            disabled={!nuevoNombre.trim()}
            className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50"
          >
            Agregar analista
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 mb-2">{error}</p>
        )}

        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Nombre</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Estado</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Creado</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Accion</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Cargando...</td></tr>
            )}
            {!cargando && analistas.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Sin analistas. Agrega el primero.</td></tr>
            )}
            {analistas.map(a => (
              <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                <td className="px-3 py-2 text-slate-800 font-medium">{a.nombre}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    a.activo === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {a.activo === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {a.created_at.split('T')[0]}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleToggle(a)}
                    className="text-xs text-slate-600 hover:text-slate-800 underline"
                  >
                    {a.activo === 1 ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
