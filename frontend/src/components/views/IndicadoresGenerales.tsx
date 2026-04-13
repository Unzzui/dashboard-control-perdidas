'use client';

import { useMemo, useCallback } from 'react';
import { ZonaStats, DailyStats, KPIData, Filters } from '@/types';
import DataTable from '@/components/ui/DataTable';
import StackedBarChart, { ChartClickEvent } from '@/components/charts/StackedBarChart';
import DonutChart from '@/components/charts/DonutChart';

interface IndicadoresGeneralesProps {
  kpis: KPIData;
  zonas: ZonaStats[];
  daily: DailyStats[];
  onFilterByDay?: (day: number) => void;
  onFilterByZona?: (zona: string) => void;
  currentFilters?: Filters;
}

export default function IndicadoresGenerales({
  kpis,
  zonas,
  daily,
  onFilterByDay,
  onFilterByZona,
  currentFilters
}: IndicadoresGeneralesProps) {

  const handleChartClick = useCallback((event: ChartClickEvent) => {
    if (event.type === 'day' && onFilterByDay) {
      onFilterByDay(event.value as number);
    }
  }, [onFilterByDay]);

  const handleZonaClick = useCallback((zona: string) => {
    if (onFilterByZona && zona !== 'Total') {
      onFilterByZona(zona);
    }
  }, [onFilterByZona]);

  const columns = useMemo(() => [
    {
      key: 'zona',
      header: 'Zona',
      width: '180px',
      render: (row: ZonaStats) => (
        <span
          onClick={() => handleZonaClick(row.zona)}
          className={`
            ${row.zona !== 'Total' && onFilterByZona ? 'cursor-pointer hover:text-oca-blue hover:underline' : ''}
            ${currentFilters?.zona.includes(row.zona) ? 'text-oca-blue font-semibold' : ''}
          `}
        >
          {row.zona}
        </span>
      ),
    },
    {
      key: 'normal',
      header: 'Normal',
      align: 'right' as const,
      render: (row: ZonaStats) => (
        <span className="text-slate-600">{row.normal.toLocaleString('es-CL')}</span>
      ),
    },
    {
      key: 'cnr',
      header: 'CNR',
      align: 'right' as const,
      render: (row: ZonaStats) => (
        <span className="font-medium text-slate-800">{row.cnr.toLocaleString('es-CL')}</span>
      ),
    },
    {
      key: 'pct_cnr',
      header: '% CNR',
      align: 'right' as const,
      render: (row: ZonaStats) => (
        <span className={row.pct_cnr >= 50 ? 'text-green-600' : 'text-slate-600'}>
          {row.pct_cnr.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'efectivas',
      header: 'Efectivas',
      align: 'right' as const,
      render: (row: ZonaStats) => (
        <span className="font-medium text-slate-800">{row.efectivas.toLocaleString('es-CL')}</span>
      ),
    },
    {
      key: 'pct_efectivas',
      header: '% Efect.',
      align: 'right' as const,
      render: (row: ZonaStats) => (
        <span className={row.pct_efectivas >= 70 ? 'text-green-600' : row.pct_efectivas >= 50 ? 'text-amber-600' : 'text-red-600'}>
          {row.pct_efectivas.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'visita_fallida',
      header: 'V. Fallida',
      align: 'right' as const,
      render: (row: ZonaStats) => (
        <span className="text-slate-500">{row.visita_fallida.toLocaleString('es-CL')}</span>
      ),
    },
    {
      key: 'pct_visita_fallida',
      header: '% V.F.',
      align: 'right' as const,
      render: (row: ZonaStats) => (
        <span className={row.pct_visita_fallida > 30 ? 'text-red-600' : 'text-slate-500'}>
          {row.pct_visita_fallida.toFixed(1)}%
        </span>
      ),
    },
  ], [handleZonaClick, onFilterByZona, currentFilters?.zona]);

  // Totales
  const totals = useMemo(() => {
    const result: ZonaStats = {
      zona: 'Total',
      normal: zonas.reduce((acc, z) => acc + z.normal, 0),
      cnr: zonas.reduce((acc, z) => acc + z.cnr, 0),
      pct_cnr: 0,
      visita_fallida: zonas.reduce((acc, z) => acc + z.visita_fallida, 0),
      pct_visita_fallida: 0,
      efectivas: zonas.reduce((acc, z) => acc + z.efectivas, 0),
      pct_efectivas: 0,
    };
    const totalEfectivas = result.normal + result.cnr;
    result.pct_cnr = totalEfectivas > 0 ? (result.cnr / totalEfectivas) * 100 : 0;
    result.pct_efectivas = totalEfectivas > 0 ? (result.efectivas / totalEfectivas) * 100 : 0;
    const totalAll = totalEfectivas + result.visita_fallida;
    result.pct_visita_fallida = totalAll > 0 ? (result.visita_fallida / totalAll) * 100 : 0;
    return result;
  }, [zonas]);

  // Datos del donut
  const donutData = useMemo(() => [
    { name: 'CNR', value: kpis.total_cnr },
    { name: 'Normal', value: kpis.total_normal },
    { name: 'V. Fallida', value: kpis.total_visita_fallida },
  ], [kpis.total_cnr, kpis.total_normal, kpis.total_visita_fallida]);

  // Estadísticas diarias
  const stats = useMemo(() => {
    if (daily.length === 0) return { promedio: 0, efectivasPromedio: 0, mejorDia: null, diasTrabajados: 0 };

    const promedio = Math.round(daily.reduce((acc, d) => acc + d.cnr + d.normal + d.visita_fallida, 0) / daily.length);
    const efectivasPromedio = Math.round(daily.reduce((acc, d) => acc + d.cnr + d.normal, 0) / daily.length);

    const diasConTotal = daily.map(d => ({ ...d, efectivas: d.cnr + d.normal }));
    const mejorDia = diasConTotal.reduce((best, d) => d.efectivas > best.efectivas ? d : best, diasConTotal[0]);
    const diasTrabajados = daily.filter(d => (d.cnr + d.normal + d.visita_fallida) > 0).length;

    return { promedio, efectivasPromedio, mejorDia, diasTrabajados };
  }, [daily]);

  const tableData = useMemo(() => [...zonas, totals], [zonas, totals]);

  // Verificar si hay días filtrados
  const diasFiltrados = currentFilters?.dia || [];

  return (
    <div className="space-y-6">
      {/* KPIs Principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total Registros</p>
          <p className="text-2xl font-bold text-slate-800">{kpis.total_registros.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Normal</p>
          <p className="text-2xl font-bold text-slate-800">{kpis.total_normal.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">{kpis.pct_efectivas.toFixed(1)}% efectivas</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">CNR</p>
          <p className="text-2xl font-bold text-slate-800">{kpis.total_cnr.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">{kpis.pct_cnr.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">CNR Falla</p>
          <p className="text-2xl font-bold text-green-600">{kpis.cnr_falla.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">{kpis.pct_cnr_falla.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">CNR Hurto</p>
          <p className="text-2xl font-bold text-red-600">{kpis.cnr_hurto.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">{kpis.pct_cnr_hurto.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Visita Fallida</p>
          <p className="text-2xl font-bold text-amber-600">{kpis.total_visita_fallida.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">{kpis.pct_visita_fallida.toFixed(1)}%</p>
        </div>
      </div>

      {/* Resumen Operativo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Promedio Diario</p>
          <p className="text-2xl font-bold text-slate-800">{stats.promedio.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">registros/día</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Efectivas Promedio</p>
          <p className="text-2xl font-bold text-slate-800">{stats.efectivasPromedio.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">CNR + Normal/día</p>
        </div>
        <div
          className={`bg-white rounded-lg border border-slate-200/60 p-4 ${stats.mejorDia && onFilterByDay ? 'cursor-pointer hover:border-oca-blue/40 transition-colors' : ''}`}
          onClick={() => stats.mejorDia && onFilterByDay && onFilterByDay(stats.mejorDia.dia)}
        >
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Mejor Día</p>
          <p className="text-2xl font-bold text-slate-800">{stats.mejorDia ? stats.mejorDia.efectivas.toLocaleString('es-CL') : '-'}</p>
          <p className="text-[10px] text-slate-400 mt-1">
            {stats.mejorDia ? `Día ${stats.mejorDia.dia}` : ''}
            {stats.mejorDia && onFilterByDay && <span className="text-oca-blue ml-1">(click para filtrar)</span>}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Días Trabajados</p>
          <p className="text-2xl font-bold text-slate-800">{stats.diasTrabajados}</p>
          <p className="text-[10px] text-slate-400 mt-1">con actividad</p>
        </div>
      </div>

      {/* Tabla y Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Resultados por Zona
            </h3>
            {onFilterByZona && (
              <span className="text-[10px] text-slate-400">Click en zona para filtrar</span>
            )}
          </div>
          <DataTable columns={columns} data={tableData} />
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Distribución
          </h3>
          <DonutChart
            data={donutData}
            colors={['#475569', '#94a3b8', '#f59e0b']}
          />
        </div>
      </div>

      {/* Gráfico Diario */}
      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Actividad Diaria
          </h3>
          <div className="flex items-center gap-2">
            {diasFiltrados.length > 0 && (
              <span className="text-[10px] bg-oca-blue/10 text-oca-blue px-2 py-0.5 rounded">
                Filtrado: día{diasFiltrados.length > 1 ? 's' : ''} {diasFiltrados.join(', ')}
              </span>
            )}
            {onFilterByDay && (
              <span className="text-[10px] text-slate-400">Click en barra para filtrar</span>
            )}
          </div>
        </div>
        <StackedBarChart
          data={daily}
          height="300px"
          onElementClick={onFilterByDay ? handleChartClick : undefined}
        />
      </div>
    </div>
  );
}
