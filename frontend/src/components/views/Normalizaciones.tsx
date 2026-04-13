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
    { key: 'zona', header: 'Zona', width: '180px' },
    {
      key: 'no_normalizado',
      header: 'No Normalizado',
      align: 'right' as const,
      render: (row: NormalizacionStats) => (
        <span className="text-slate-600">{row.no_normalizado.toLocaleString('es-CL')}</span>
      ),
    },
    {
      key: 'pct_no_normalizado',
      header: '%',
      align: 'right' as const,
      render: (row: NormalizacionStats) => (
        <span className={row.pct_no_normalizado > 50 ? 'text-amber-600' : 'text-slate-500'}>
          {row.pct_no_normalizado.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'normalizado',
      header: 'Normalizado',
      align: 'right' as const,
      render: (row: NormalizacionStats) => (
        <span className="text-slate-600">{row.normalizado.toLocaleString('es-CL')}</span>
      ),
    },
    {
      key: 'pct_normalizado',
      header: '%',
      align: 'right' as const,
      render: (row: NormalizacionStats) => (
        <span className={row.pct_normalizado >= 50 ? 'text-green-600' : 'text-slate-500'}>
          {row.pct_normalizado.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right' as const,
      render: (row: NormalizacionStats) => (
        <span className="font-medium text-slate-800">{row.total.toLocaleString('es-CL')}</span>
      ),
    },
  ], []);

  const donutData = useMemo(() => [
    { name: 'CNR Falla', value: cnrFalla },
    { name: 'CNR Hurto', value: cnrHurto },
  ], [cnrFalla, cnrHurto]);

  const tratamientoDaily = useMemo(() => dailyTratamiento.map((d) => ({
    ...d,
    cnr: d.cnr,
    normal: d.normal,
    visita_fallida: 0,
  })), [dailyTratamiento]);

  const totals = useMemo(() => {
    const totalNorm = normalizaciones.reduce((acc, n) => acc + n.normalizado, 0);
    const totalNoNorm = normalizaciones.reduce((acc, n) => acc + n.no_normalizado, 0);
    const total = totalNorm + totalNoNorm;
    return {
      normalizado: totalNorm,
      noNormalizado: totalNoNorm,
      total,
      pctNorm: total > 0 ? (totalNorm / total * 100).toFixed(1) : '0',
    };
  }, [normalizaciones]);

  const totalCNR = cnrFalla + cnrHurto;
  const pctFalla = totalCNR > 0 ? (cnrFalla / totalCNR * 100).toFixed(1) : '0';
  const pctHurto = totalCNR > 0 ? (cnrHurto / totalCNR * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total CNR</p>
          <p className="text-2xl font-bold text-slate-800">{totalCNR.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">CNR Falla</p>
          <p className="text-2xl font-bold text-green-600">{cnrFalla.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">{pctFalla}%</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">CNR Hurto</p>
          <p className="text-2xl font-bold text-red-600">{cnrHurto.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">{pctHurto}%</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% Normalizado</p>
          <p className="text-2xl font-bold text-slate-800">{totals.pctNorm}%</p>
          <p className="text-[10px] text-slate-400 mt-1">{totals.normalizado.toLocaleString('es-CL')} de {totals.total.toLocaleString('es-CL')}</p>
        </div>
      </div>

      {/* Tabla y Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4 lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Normalizaciones por Zona
          </h3>
          <DataTable columns={columns} data={normalizaciones} />
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Tipos de CNR
          </h3>
          <DonutChart
            data={donutData}
            colors={['#16a34a', '#dc2626']}
          />
        </div>
      </div>

      {/* Gráfico de Tratamiento */}
      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
          Resultado Tratamiento
        </h3>
        <StackedBarChart data={tratamientoDaily} height="300px" />
      </div>
    </div>
  );
}
