'use client';

import { ZonaStats, CampanaStats, DailyStats } from '@/types';
import DataTable from '@/components/ui/DataTable';
import StackedBarChart from '@/components/charts/StackedBarChart';
import DonutChart from '@/components/charts/DonutChart';

interface ResultadosDelegacionProps {
  zonas: ZonaStats[];
  campanas: CampanaStats[];
  daily: DailyStats[];
  cnrFalla: number;
  cnrHurto: number;
}

export default function ResultadosDelegacion({
  zonas,
  campanas,
  daily,
  cnrFalla,
  cnrHurto,
}: ResultadosDelegacionProps) {
  const zonaColumns = [
    { key: 'zona', header: 'Zona', width: '180px' },
    {
      key: 'normal',
      header: 'Normal',
      align: 'right' as const,
      render: (row: ZonaStats) => row.normal.toLocaleString('es-CL'),
    },
    {
      key: 'cnr',
      header: 'CNR',
      align: 'right' as const,
      render: (row: ZonaStats) => row.cnr.toLocaleString('es-CL'),
    },
    {
      key: 'pct_cnr',
      header: '% CNR',
      align: 'right' as const,
      render: (row: ZonaStats) => `${row.pct_cnr.toFixed(2)}%`,
    },
    {
      key: 'efectivas',
      header: 'EFECTIVAS',
      align: 'right' as const,
      render: (row: ZonaStats) => row.efectivas.toLocaleString('es-CL'),
    },
    {
      key: 'pct_efectivas',
      header: '% EFECTIVAS',
      align: 'right' as const,
      render: (row: ZonaStats) => (
        <span className="text-green-600 font-medium">{row.pct_efectivas.toFixed(2)}%</span>
      ),
    },
    {
      key: 'visita_fallida',
      header: 'Visita fallida',
      align: 'right' as const,
      render: (row: ZonaStats) => row.visita_fallida.toLocaleString('es-CL'),
    },
    {
      key: 'pct_visita_fallida',
      header: '% VF',
      align: 'right' as const,
      render: (row: ZonaStats) => (
        <span className="text-orange-500">{row.pct_visita_fallida.toFixed(2)}%</span>
      ),
    },
  ];

  const campanaColumns = [
    { key: 'descripcion', header: 'Descripción del aviso', width: '250px' },
    {
      key: 'normal',
      header: 'NORMAL',
      align: 'right' as const,
      render: (row: CampanaStats) => row.normal > 0 ? row.normal.toLocaleString('es-CL') : '',
    },
    {
      key: 'cnr',
      header: 'CNR',
      align: 'right' as const,
      render: (row: CampanaStats) => row.cnr > 0 ? row.cnr.toLocaleString('es-CL') : '',
    },
    {
      key: 'pct_cnr',
      header: '% CNR',
      align: 'right' as const,
      render: (row: CampanaStats) => row.pct_cnr > 0 ? `${row.pct_cnr.toFixed(2)}%` : '',
    },
    {
      key: 'efectivas',
      header: 'EFECTIVAS',
      align: 'right' as const,
      render: (row: CampanaStats) => row.efectivas > 0 ? row.efectivas.toLocaleString('es-CL') : '',
    },
    {
      key: 'pct_efectivas',
      header: '% EFECTIVAS',
      align: 'right' as const,
      render: (row: CampanaStats) => row.pct_efectivas > 0 ? `${row.pct_efectivas.toFixed(2)}%` : '',
    },
    {
      key: 'visita_fallida',
      header: 'VISITA FALLIDA',
      align: 'right' as const,
      render: (row: CampanaStats) => row.visita_fallida > 0 ? row.visita_fallida.toLocaleString('es-CL') : '',
    },
    {
      key: 'cnr_falla',
      header: 'CNR FALLA',
      align: 'right' as const,
      render: (row: CampanaStats) => row.cnr_falla > 0 ? row.cnr_falla.toLocaleString('es-CL') : '',
    },
    {
      key: 'cnr_hurto',
      header: 'CNR HURTO',
      align: 'right' as const,
      render: (row: CampanaStats) => row.cnr_hurto > 0 ? row.cnr_hurto.toLocaleString('es-CL') : '',
    },
  ];

  const donutData = [
    { name: 'CNR FALLA', value: cnrFalla },
    { name: 'CNR HURTO', value: cnrHurto },
  ];

  return (
    <div className="space-y-6">
      {/* Results by Delegation */}
      <div className="card">
        <h3 className="section-title mb-3">Resultados por Delegación</h3>
        <DataTable columns={zonaColumns} data={zonas} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Activity */}
        <div className="card lg:col-span-2">
          <h3 className="section-title mb-3">Actividades Diarias</h3>
          <StackedBarChart data={daily} />
        </div>

        {/* CNR Types Donut */}
        <div className="card">
          <h3 className="section-title mb-3">Tipos de CNR</h3>
          <DonutChart
            data={donutData}
            colors={['#294D6D', '#4A7BA7']}
          />
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="card">
        <h3 className="section-title mb-3">Campañas</h3>
        <div className="max-h-[400px] overflow-y-auto">
          <DataTable columns={campanaColumns} data={campanas.slice(0, 30)} />
        </div>
      </div>
    </div>
  );
}
