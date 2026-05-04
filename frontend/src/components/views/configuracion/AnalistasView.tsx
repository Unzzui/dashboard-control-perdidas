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

  const totalActivos = analistas.filter(a => a.activo === 1).length;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Analistas</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Personas autorizadas a registrar justificaciones en Control de Metas.
        </p>
      </div>

      {/* Form: agregar analista */}
      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">
          Agregar nuevo
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="nombre.apellido"
            className="flex-1 text-sm border border-slate-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-oca-blue focus:border-oca-blue"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAgregar(); }}
          />
          <button
            type="button"
            onClick={handleAgregar}
            disabled={!nuevoNombre.trim()}
            className="px-3 py-1.5 text-sm bg-oca-blue text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Agregar
          </button>
        </div>
        {error && (
          <p className="text-[11px] text-red-600 mt-2">{error}</p>
        )}
      </div>

      {/* Tabla: lista de analistas */}
      <div className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
        <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between">
          <span className="font-semibold text-xs uppercase tracking-wide">Lista de analistas</span>
          <span className="text-[10px] text-slate-300">
            {totalActivos} activo{totalActivos === 1 ? '' : 's'} de {analistas.length}
          </span>
        </div>
        <table className="w-full text-[11px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Nombre</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Estado</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Creado</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Acción</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Cargando…</td></tr>
            )}
            {!cargando && analistas.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Sin analistas. Agrega el primero arriba.</td></tr>
            )}
            {analistas.map(a => (
              <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                <td className="px-3 py-2 text-slate-800 font-medium">{a.nombre}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    a.activo === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {a.activo === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {a.created_at.split('T')[0].split('-').reverse().join('-')}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleToggle(a)}
                    className="text-[11px] text-slate-600 hover:text-slate-800 hover:underline"
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
