'use client';

import { useState } from 'react';
import { Filters, DailyStats } from '@/types';
import AnalisisJornadaMensual from './AnalisisJornadaMensual';
import AnalisisJornadaDiario from './AnalisisJornadaDiario';

interface Props {
  filters: Filters;
  daily: DailyStats[];
}

type Tab = 'mensual' | 'diario';

export default function AnalisisJornada({ filters, daily }: Props) {
  const [tab, setTab] = useState<Tab>('mensual');

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Análisis de Jornada</h2>
          <p className="text-sm text-slate-500">
            {tab === 'mensual'
              ? 'Promedios y desempeño del periodo filtrado, agrupado por zona.'
              : 'Detalle de una jornada específica (último día con datos).'}
          </p>
        </div>
        <div className="inline-flex bg-slate-100 rounded-lg p-1">
          <TabButton active={tab === 'mensual'} onClick={() => setTab('mensual')}>
            Mensual
          </TabButton>
          <TabButton active={tab === 'diario'} onClick={() => setTab('diario')}>
            Diario
          </TabButton>
        </div>
      </div>

      {tab === 'mensual' ? (
        <AnalisisJornadaMensual filters={filters} />
      ) : (
        <AnalisisJornadaDiario filters={filters} daily={daily} />
      )}
    </div>
  );
}

function TabButton({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] font-medium px-3 py-1.5 rounded transition-colors ${
        active
          ? 'bg-white text-slate-800 shadow-sm'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}
