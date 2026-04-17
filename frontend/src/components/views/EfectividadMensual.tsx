'use client';

import { useMemo, useCallback } from 'react';
import { MensualStats, KPIData, Filters } from '@/types';
import DataTable from '@/components/ui/DataTable';
import LineChart, { LineChartClickEvent } from '@/components/charts/LineChart';

interface EfectividadMensualProps {
  mensual: MensualStats[];
  kpis: KPIData;
  onFilterByMes?: (mes: string) => void;
  currentFilters?: Filters;
}

export default function EfectividadMensual({
  mensual,
  kpis,
  onFilterByMes,
  currentFilters
}: EfectividadMensualProps) {

  const handleChartClick = useCallback((event: LineChartClickEvent) => {
    if (onFilterByMes) {
      onFilterByMes(event.label);
    }
  }, [onFilterByMes]);

  const handleMesClick = useCallback((mes: string) => {
    if (onFilterByMes) {
      onFilterByMes(mes);
    }
  }, [onFilterByMes]);

  const columns = useMemo(() => [
    {
      key: 'mes',
      header: 'Mes',
      width: '100px',
      render: (row: MensualStats) => (
        <span
          onClick={() => handleMesClick(row.mes)}
          className={`
            ${onFilterByMes ? 'cursor-pointer hover:text-oca-blue hover:underline' : ''}
            ${currentFilters?.mes.includes(row.mes.toLowerCase()) ? 'text-oca-blue font-semibold' : ''}
          `}
        >
          {row.mes}
        </span>
      ),
    },
    {
      key: 'normal',
      header: 'Normal',
      align: 'right' as const,
      render: (row: MensualStats) => (
        <span className="text-slate-600">{row.normal.toLocaleString('es-CL')}</span>
      ),
    },
    {
      key: 'cnr_falla',
      header: 'CNR Falla',
      align: 'right' as const,
      render: (row: MensualStats) => (
        <span className="text-green-600">{row.cnr_falla.toLocaleString('es-CL')}</span>
      ),
    },
    {
      key: 'pct_cnr_falla',
      header: '% Falla',
      align: 'right' as const,
      render: (row: MensualStats) => (
        <span className="text-slate-500">{row.pct_cnr_falla.toFixed(1)}%</span>
      ),
    },
    {
      key: 'cnr_hurto',
      header: 'CNR Hurto',
      align: 'right' as const,
      render: (row: MensualStats) => (
        <span className="text-red-600">{row.cnr_hurto.toLocaleString('es-CL')}</span>
      ),
    },
    {
      key: 'pct_cnr_hurto',
      header: '% Hurto',
      align: 'right' as const,
      render: (row: MensualStats) => (
        <span className="text-slate-500">{row.pct_cnr_hurto.toFixed(1)}%</span>
      ),
    },
    {
      key: 'cnr',
      header: 'CNR',
      align: 'right' as const,
      render: (row: MensualStats) => (
        <span className="font-medium text-slate-800">{row.cnr.toLocaleString('es-CL')}</span>
      ),
    },
    {
      key: 'pct_cnr',
      header: '% CNR',
      align: 'right' as const,
      render: (row: MensualStats) => (
        <span className={row.pct_cnr >= 50 ? 'font-medium text-green-600' : 'text-slate-500'}>
          {row.pct_cnr.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'efectivas',
      header: 'Efectivas',
      align: 'right' as const,
      render: (row: MensualStats) => (
        <span className="font-medium text-slate-800">{row.efectivas.toLocaleString('es-CL')}</span>
      ),
    },
    {
      key: 'pct_efectivas',
      header: '% Efect.',
      align: 'right' as const,
      render: (row: MensualStats) => (
        <span className={row.pct_efectivas >= 70 ? 'text-green-600 font-medium' : row.pct_efectivas >= 50 ? 'text-amber-600' : 'text-red-600'}>
          {row.pct_efectivas.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'visita_fallida',
      header: 'V. Fallida',
      align: 'right' as const,
      render: (row: MensualStats) => (
        <span className="text-slate-600">{row.visita_fallida.toLocaleString('es-CL')}</span>
      ),
    },
    {
      key: 'pct_visita_fallida',
      header: '% V.F.',
      align: 'right' as const,
      render: (row: MensualStats) => (
        <span className={row.pct_visita_fallida > 30 ? 'text-red-600' : 'text-amber-600'}>
          {row.pct_visita_fallida.toFixed(1)}%
        </span>
      ),
    },
  ], [handleMesClick, onFilterByMes, currentFilters?.mes]);

  const lineData = useMemo(() => ({
    labels: mensual.map((m) => m.mes),
    series: [
      {
        name: '% Efectivas',
        data: mensual.map((m) => m.pct_efectivas),
        color: '#475569',
      },
      {
        name: '% CNR',
        data: mensual.map((m) => m.pct_cnr),
        color: '#64748b',
      },
      {
        name: '% V.Fallida',
        data: mensual.map((m) => m.pct_visita_fallida),
        color: '#f59e0b',
      },
      {
        name: '% CNR Hurto',
        data: mensual.map((m) => m.pct_cnr_hurto),
        color: '#dc2626',
      },
    ],
  }), [mensual]);

  // Totales calculados
  const totals = useMemo(() => {
    const totalEfectivas = mensual.reduce((acc, m) => acc + m.efectivas, 0);
    const totalVF = mensual.reduce((acc, m) => acc + m.visita_fallida, 0);
    const totalCNR = mensual.reduce((acc, m) => acc + m.cnr, 0);
    const totalCNRFalla = mensual.reduce((acc, m) => acc + m.cnr_falla, 0);
    const totalCNRHurto = mensual.reduce((acc, m) => acc + m.cnr_hurto, 0);
    const total = totalEfectivas + totalVF;
    return { totalEfectivas, totalVF, totalCNR, totalCNRFalla, totalCNRHurto, total };
  }, [mensual]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% Efectivas</p>
          <p className={`text-3xl font-bold ${kpis.pct_efectivas >= 70 ? 'text-green-600' : 'text-slate-800'}`}>
            {kpis.pct_efectivas.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-400 mt-1">Meta: 70%</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% CNR</p>
          <p className={`text-3xl font-bold ${kpis.pct_cnr >= 25 ? 'text-green-600' : 'text-slate-800'}`}>
            {kpis.pct_cnr.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-400 mt-1">Meta: 25%</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% CNR Falla</p>
          <p className="text-3xl font-bold text-green-600">{kpis.pct_cnr_falla.toFixed(1)}%</p>
          <p className="text-xs text-slate-400 mt-1">{totals.totalCNRFalla.toLocaleString('es-CL')} casos</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% CNR Hurto</p>
          <p className="text-3xl font-bold text-red-600">{kpis.pct_cnr_hurto.toFixed(1)}%</p>
          <p className="text-xs text-slate-400 mt-1">{totals.totalCNRHurto.toLocaleString('es-CL')} casos</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% V. Fallida</p>
          <p className={`text-3xl font-bold ${kpis.pct_visita_fallida <= 30 ? 'text-green-600' : 'text-red-600'}`}>
            {kpis.pct_visita_fallida.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-400 mt-1">Meta: {'<'}30%</p>
        </div>
      </div>

      {/* Table and Chart side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Efectividad por Mes
            </h3>
            {onFilterByMes && (
              <span className="text-xs text-slate-400">Click en mes para filtrar</span>
            )}
          </div>
          <DataTable columns={columns} data={mensual} />
        </div>

        {/* Line Chart */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Tendencia de Efectividad
            </h3>
            {onFilterByMes && (
              <span className="text-xs text-slate-400">Click en punto para filtrar</span>
            )}
          </div>
          <LineChart
            data={lineData}
            yAxisFormat="percent"
            onElementClick={onFilterByMes ? handleChartClick : undefined}
          />
        </div>
      </div>
    </div>
  );
}
