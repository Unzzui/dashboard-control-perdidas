'use client';

import { ZonaStats, DailyStats, KPIData } from '@/types';
import KPICard from '@/components/ui/KPICard';
import DataTable from '@/components/ui/DataTable';
import StackedBarChart from '@/components/charts/StackedBarChart';

interface IndicadoresGeneralesProps {
  kpis: KPIData;
  zonas: ZonaStats[];
  daily: DailyStats[];
}

export default function IndicadoresGenerales({ kpis, zonas, daily }: IndicadoresGeneralesProps) {
  const columns = [
    { key: 'zona', header: 'Zona', width: '200px' },
    {
      key: 'normal',
      header: 'NORMAL',
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
      render: (row: ZonaStats) => (
        <span className="font-medium text-oca-blue">{row.pct_cnr.toFixed(2)}%</span>
      ),
    },
    {
      key: 'visita_fallida',
      header: 'VISITA FALLIDA',
      align: 'right' as const,
      render: (row: ZonaStats) => row.visita_fallida.toLocaleString('es-CL'),
    },
    {
      key: 'pct_visita_fallida',
      header: '% V.FALLIDA',
      align: 'right' as const,
      render: (row: ZonaStats) => (
        <span className="text-orange-500">{row.pct_visita_fallida.toFixed(2)}%</span>
      ),
    },
  ];

  // Calculate totals
  const totals: ZonaStats = {
    zona: 'Total',
    normal: zonas.reduce((acc, z) => acc + z.normal, 0),
    cnr: zonas.reduce((acc, z) => acc + z.cnr, 0),
    pct_cnr: 0,
    visita_fallida: zonas.reduce((acc, z) => acc + z.visita_fallida, 0),
    pct_visita_fallida: 0,
    efectivas: 0,
    pct_efectivas: 0,
  };
  const totalEfectivas = totals.normal + totals.cnr;
  totals.pct_cnr = totalEfectivas > 0 ? (totals.cnr / totalEfectivas) * 100 : 0;
  const totalAll = totalEfectivas + totals.visita_fallida;
  totals.pct_visita_fallida = totalAll > 0 ? (totals.visita_fallida / totalAll) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KPICard
          title="Total Registros"
          value={kpis.total_registros}
          color="gray"
        />
        <KPICard
          title="Normal"
          value={kpis.total_normal}
          subtitle={`${kpis.pct_efectivas.toFixed(2)}% efectivas`}
          color="blue"
        />
        <KPICard
          title="CNR"
          value={kpis.total_cnr}
          subtitle={`${kpis.pct_cnr.toFixed(2)}%`}
          color="blue"
        />
        <KPICard
          title="CNR Falla"
          value={kpis.cnr_falla}
          subtitle={`${kpis.pct_cnr_falla.toFixed(2)}%`}
          color="green"
        />
        <KPICard
          title="CNR Hurto"
          value={kpis.cnr_hurto}
          subtitle={`${kpis.pct_cnr_hurto.toFixed(2)}%`}
          color="red"
        />
        <KPICard
          title="Visita Fallida"
          value={kpis.total_visita_fallida}
          subtitle={`${kpis.pct_visita_fallida.toFixed(2)}%`}
          color="orange"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Zona Table */}
        <div className="card">
          <h3 className="section-title mb-3">Resultados por Zona</h3>
          <DataTable columns={columns} data={[...zonas, totals]} />
        </div>

        {/* Daily Chart */}
        <div className="card">
          <h3 className="section-title mb-3">Indicadores Generales</h3>
          <StackedBarChart data={daily} />
        </div>
      </div>

      {/* Daily breakdown by zone */}
      <div className="card">
        <h3 className="section-title mb-3">Actividades Diarias</h3>
        <StackedBarChart data={daily} title="" />
      </div>
    </div>
  );
}
