'use client';

import { useMemo } from 'react';
import { NormalizacionStats, DailyStats } from '@/types';
import DataTable from '@/components/ui/DataTable';
import DonutChart from '@/components/charts/DonutChart';
import StackedBarChart from '@/components/charts/StackedBarChart';

interface NormalizacionesProps {
  normalizaciones: NormalizacionStats[];
  cnrFalla: number;
  cnrHurto: number;
  dailyTratamiento: DailyStats[];
}

export default function Normalizaciones({
  normalizaciones,
  cnrFalla,
  cnrHurto,
  dailyTratamiento,
}: NormalizacionesProps) {
  const columns = useMemo(() => [
    { key: 'zona', header: 'Zona', width: '200px' },
    {
      key: 'no_normalizado',
      header: 'No normalizado Visita',
      align: 'right' as const,
      render: (row: NormalizacionStats) => row.no_normalizado.toLocaleString('es-CL'),
    },
    {
      key: 'pct_no_normalizado',
      header: '% Visita',
      align: 'right' as const,
      render: (row: NormalizacionStats) => (
        <span className="text-orange-500">{row.pct_no_normalizado.toFixed(2)}%</span>
      ),
    },
    {
      key: 'normalizado',
      header: 'Normalizado Visita',
      align: 'right' as const,
      render: (row: NormalizacionStats) => row.normalizado.toLocaleString('es-CL'),
    },
    {
      key: 'pct_normalizado',
      header: '% Visita',
      align: 'right' as const,
      render: (row: NormalizacionStats) => (
        <span className="text-green-600">{row.pct_normalizado.toFixed(2)}%</span>
      ),
    },
    {
      key: 'total',
      header: 'Total Visita',
      align: 'right' as const,
      render: (row: NormalizacionStats) => (
        <span className="font-semibold">{row.total.toLocaleString('es-CL')}</span>
      ),
    },
  ], []);

  const donutData = useMemo(() => [
    { name: 'CNR FALLA', value: cnrFalla },
    { name: 'CNR HURTO', value: cnrHurto },
  ], [cnrFalla, cnrHurto]);

  // Convert daily to tratamiento format
  const tratamientoDaily = useMemo(() => dailyTratamiento.map((d) => ({
    ...d,
    cnr: d.cnr,
    normal: d.normal,
    visita_fallida: 0,
  })), [dailyTratamiento]);

  return (
    <div className="space-y-6">
      {/* Table and Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Normalizations Table */}
        <div className="card lg:col-span-2">
          <h3 className="section-title mb-3">Normalizaciones x Delegación</h3>
          <DataTable columns={columns} data={normalizaciones} />
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

      {/* Treatment Chart */}
      <div className="card">
        <h3 className="section-title mb-3">Resultado Tratamiento</h3>
        <div className="mb-4 flex gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            No normalizado
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            Normalizado
          </span>
        </div>
        <StackedBarChart data={tratamientoDaily} />
      </div>
    </div>
  );
}
