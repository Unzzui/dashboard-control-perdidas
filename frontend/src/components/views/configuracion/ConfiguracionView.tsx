'use client';

import { useState } from 'react';
import { Users, Tag, Target, ClipboardList, LucideIcon } from 'lucide-react';
import AnalistasView from './AnalistasView';

interface Modulo {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  disabled?: boolean;
  Component?: React.ComponentType;
}

const MODULOS: Modulo[] = [
  {
    id: 'analistas',
    label: 'Analistas',
    description: 'Personas que registran justificaciones',
    icon: Users,
    Component: AnalistasView,
  },
  {
    id: 'motivos',
    label: 'Motivos',
    description: 'Catálogo de motivos de justificación',
    icon: Tag,
    disabled: true,
  },
  {
    id: 'metas',
    label: 'Metas',
    description: 'Umbral diario y meta mensual por brigada',
    icon: Target,
    disabled: true,
  },
  {
    id: 'auditoria',
    label: 'Auditoría',
    description: 'Historial completo de cambios',
    icon: ClipboardList,
    disabled: true,
  },
];

export default function ConfiguracionView() {
  const [moduloActivo, setModuloActivo] = useState<string>('analistas');
  const modulo = MODULOS.find(m => m.id === moduloActivo) ?? MODULOS[0];
  const ActiveComponent = modulo.Component;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Configuración</h2>
          <p className="text-sm text-slate-500">
            Ajustes del sistema y catálogos operativos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-3">
        {/* Tabs laterales */}
        <nav className="bg-white rounded-lg border border-slate-200/60 p-2 h-fit">
          <ul className="space-y-0.5">
            {MODULOS.map(m => {
              const Icon = m.icon;
              const activo = m.id === moduloActivo;
              const onClick = m.disabled
                ? undefined
                : () => setModuloActivo(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={onClick}
                    disabled={m.disabled}
                    className={`w-full text-left px-2.5 py-2 rounded-md flex items-start gap-2.5 transition-colors ${
                      activo
                        ? 'bg-slate-100 text-slate-800'
                        : m.disabled
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium truncate">{m.label}</span>
                        {m.disabled && (
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 bg-slate-100 px-1 py-0.5 rounded">
                            Pronto
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {m.description}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Panel de contenido */}
        <section>
          {ActiveComponent ? (
            <ActiveComponent />
          ) : (
            <Placeholder modulo={modulo} />
          )}
        </section>
      </div>
    </div>
  );
}

function Placeholder({ modulo }: { modulo: Modulo }) {
  const Icon = modulo.icon;
  return (
    <div className="bg-white rounded-lg border border-slate-200/60 p-12 flex flex-col items-center justify-center text-center">
      <Icon className="w-8 h-8 text-slate-300 mb-3" />
      <h3 className="text-sm font-semibold text-slate-700">{modulo.label}</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-xs">{modulo.description}</p>
      <span className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded mt-3">
        Próximamente
      </span>
    </div>
  );
}
