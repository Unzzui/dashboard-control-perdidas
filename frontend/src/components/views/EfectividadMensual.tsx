'use client';

import { MensualStats, KPIData } from '@/types';
import DataTable from '@/components/ui/DataTable';
import GaugeChart from '@/components/charts/GaugeChart';
import LineChart from '@/components/charts/LineChart';

interface EfectividadMensualProps {
  mensual: MensualStats[];
  kpis: KPIData;
}

export default function EfectividadMensual({ mensual, kpis }: EfectividadMensualProps) {
  const columns = [
    { key: 'mes', header: 'Mes', width: '100px' },
    {
      key: 'normal',
      header: 'NORMAL',
      align: 'right' as const,
      render: (row: MensualStats) => row.normal.toLocaleString('es-CL'),
    },
    {
      key: 'cnr_falla',
      header: 'CNR FALLA',
      align: 'right' as const,
      render: (row: MensualStats) => row.cnr_falla.toLocaleString('es-CL'),
    },
    {
      key: 'pct_cnr_falla',
      header: '% CNR Falla',
      align: 'right' as const,
      render: (row: MensualStats) => `${row.pct_cnr_falla.toFixed(2)}%`,
    },
    {
      key: 'cnr_hurto',
      header: 'CNR HURTO',
      align: 'right' as const,
      render: (row: MensualStats) => row.cnr_hurto.toLocaleString('es-CL'),
    },
    {
      key: 'pct_cnr_hurto',
      header: '% CNR Hurto',
      align: 'right' as const,
      render: (row: MensualStats) => `${row.pct_cnr_hurto.toFixed(2)}%`,
    },
    {
      key: 'cnr',
      header: 'CNR',
      align: 'right' as const,
      render: (row: MensualStats) => row.cnr.toLocaleString('es-CL'),
    },
    {
      key: 'pct_cnr',
      header: '% CNR',
      align: 'right' as const,
      render: (row: MensualStats) => (
        <span className="font-medium text-oca-blue">{row.pct_cnr.toFixed(2)}%</span>
      ),
    },
    {
      key: 'efectivas',
      header: 'EFECTIVAS',
      align: 'right' as const,
      render: (row: MensualStats) => row.efectivas.toLocaleString('es-CL'),
    },
    {
      key: 'pct_efectivas',
      header: '% EFECTIVAS',
      align: 'right' as const,
      render: (row: MensualStats) => (
        <span className="text-green-600 font-medium">{row.pct_efectivas.toFixed(2)}%</span>
      ),
    },
    {
      key: 'visita_fallida',
      header: 'VISITA FALLIDA',
      align: 'right' as const,
      render: (row: MensualStats) => row.visita_fallida.toLocaleString('es-CL'),
    },
    {
      key: 'pct_visita_fallida',
      header: '% V.FALLIDA',
      align: 'right' as const,
      render: (row: MensualStats) => (
        <span className="text-orange-500">{row.pct_visita_fallida.toFixed(2)}%</span>
      ),
    },
  ];

  // Prepare line chart data
  const lineData = {
    labels: mensual.map((m) => m.mes),
    series: [
      {
        name: '% EFECTIVAS',
        data: mensual.map((m) => m.pct_efectivas),
        color: '#4A7BA7',
      },
      {
        name: '% CNR',
        data: mensual.map((m) => m.pct_cnr),
        color: '#294D6D',
      },
      {
        name: '% V.FALLIDA',
        data: mensual.map((m) => m.pct_visita_fallida),
        color: '#F97316',
      },
      {
        name: '% CNR Hurto',
        data: mensual.map((m) => m.pct_cnr_hurto),
        color: '#DE473C',
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Table */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Efectividad por Mes</h3>
        <DataTable columns={columns} data={mensual} />
      </div>

      {/* Gauges and Line Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gauges Column */}
        <div className="space-y-4">
          <div className="card">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">% EFECTIVAS</h4>
            <GaugeChart
              value={kpis.pct_efectivas}
              title="% EFECTIVAS"
              target={70}
              color="green"
            />
          </div>

          <div className="card">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">% CNR</h4>
            <GaugeChart
              value={kpis.pct_cnr}
              title="% CNR"
              max={30}
              target={25}
              color="blue"
            />
          </div>

          <div className="card">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">% CNR HURTO</h4>
            <GaugeChart
              value={kpis.pct_cnr_hurto}
              title="% CNR HURTO"
              max={50}
              target={30}
              color="orange"
            />
          </div>
        </div>

        {/* More Gauges */}
        <div className="space-y-4">
          <div className="card">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">% CNR FALLA</h4>
            <GaugeChart
              value={kpis.pct_cnr_falla}
              title="% CNR FALLA"
              max={80}
              target={70}
              color="green"
            />
          </div>

          <div className="card">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">% VISITA FALLIDA</h4>
            <GaugeChart
              value={kpis.pct_visita_fallida}
              title="% VISITA FALLIDA"
              max={50}
              target={30}
              color="red"
            />
          </div>
        </div>

        {/* Line Chart */}
        <div className="card lg:col-span-1">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">EFECTIVIDAD</h3>
          <LineChart data={lineData} yAxisFormat="percent" />
        </div>
      </div>
    </div>
  );
}
