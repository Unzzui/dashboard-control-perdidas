'use client';

import { useMemo, useCallback } from 'react';
import { ZonaStats, DailyStats, KPIData, Filters } from '@/types';
import StackedBarChart, { ChartClickEvent } from '@/components/charts/StackedBarChart';

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

  // Ordenar zonas por efectivas (las que menos producen primero)
  const zonasOrdenadas = useMemo(() => {
    return [...zonas].sort((a, b) => a.pct_efectivas - b.pct_efectivas);
  }, [zonas]);

  const tableData = useMemo(() => [...zonasOrdenadas, totals], [zonasOrdenadas, totals]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Indicadores Generales</h2>
        <p className="text-sm text-slate-500">Resumen del período seleccionado</p>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Producción Total</p>
          <p className="text-3xl font-bold text-slate-800">{kpis.total_registros.toLocaleString('es-CL')}</p>
          <p className="text-xs text-slate-500 mt-1">{kpis.total_cnr + kpis.total_normal} efectivas</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% CNR</p>
          <p className={`text-3xl font-bold ${kpis.pct_cnr >= 25 ? 'text-green-600' : 'text-red-600'}`}>
            {kpis.pct_cnr.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">{kpis.total_cnr.toLocaleString('es-CL')} CNR</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% Efectivas</p>
          <p className={`text-3xl font-bold ${kpis.pct_efectivas >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
            {kpis.pct_efectivas.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">Meta: 70%</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% Visita Fallida</p>
          <p className={`text-3xl font-bold ${kpis.pct_visita_fallida <= 25 ? 'text-green-600' : 'text-red-600'}`}>
            {kpis.pct_visita_fallida.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">{kpis.total_visita_fallida.toLocaleString('es-CL')} fallidas</p>
        </div>
      </div>

      {/* Tabla por Zona + Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tabla */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200/60 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Zona</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">CNR</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Normal</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">V.Fallida</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">% CNR</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">% Efect.</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">% VF</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((zona, idx) => {
                  const isTotal = zona.zona === 'Total';
                  const isSelected = currentFilters?.zona.includes(zona.zona);
                  return (
                    <tr
                      key={idx}
                      onClick={() => !isTotal && onFilterByZona && onFilterByZona(zona.zona)}
                      className={`border-b border-slate-50 transition-colors ${
                        isTotal
                          ? 'bg-slate-100 font-semibold'
                          : `hover:bg-slate-50/80 ${onFilterByZona ? 'cursor-pointer' : ''} ${isSelected ? 'bg-blue-50' : ''}`
                      }`}
                    >
                      <td className={`px-4 py-3 text-sm ${isTotal ? 'text-slate-800' : 'text-slate-700'} ${isSelected ? 'text-oca-blue font-medium' : ''}`}>
                        {zona.zona}
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-right text-slate-800">
                        {zona.cnr.toLocaleString('es-CL')}
                      </td>
                      <td className="px-3 py-3 text-sm text-right text-slate-600">
                        {zona.normal.toLocaleString('es-CL')}
                      </td>
                      <td className="px-3 py-3 text-sm text-right text-slate-500">
                        {zona.visita_fallida.toLocaleString('es-CL')}
                      </td>
                      <td className={`px-3 py-3 text-sm font-semibold text-right ${zona.pct_cnr >= 25 ? 'text-green-600' : 'text-slate-600'}`}>
                        {zona.pct_cnr.toFixed(1)}%
                      </td>
                      <td className={`px-3 py-3 text-sm font-semibold text-right ${zona.pct_efectivas >= 70 ? 'text-green-600' : zona.pct_efectivas >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {zona.pct_efectivas.toFixed(1)}%
                      </td>
                      <td className={`px-3 py-3 text-sm text-right ${zona.pct_visita_fallida > 30 ? 'text-red-600' : 'text-slate-500'}`}>
                        {zona.pct_visita_fallida.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>

        {/* Resumen rápido CNR */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Composición CNR</h3>

          <div className="space-y-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-green-700">CNR Falla</span>
                <span className="text-lg font-bold text-green-700">{kpis.pct_cnr_falla.toFixed(1)}%</span>
              </div>
              <p className="text-xl font-bold text-green-800">{kpis.cnr_falla.toLocaleString('es-CL')}</p>
            </div>

            <div className="p-3 bg-red-50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-red-700">CNR Hurto</span>
                <span className="text-lg font-bold text-red-700">{kpis.pct_cnr_hurto.toFixed(1)}%</span>
              </div>
              <p className="text-xl font-bold text-red-800">{kpis.cnr_hurto.toLocaleString('es-CL')}</p>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total CNR</span>
                <span className="font-bold text-slate-800">{kpis.total_cnr.toLocaleString('es-CL')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico Diario */}
      {daily.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Actividad Diaria</h3>
              {onFilterByDay && (
                <p className="text-xs text-slate-400">Click en barra para filtrar por día</p>
              )}
            </div>
            {currentFilters?.dia && currentFilters.dia.length > 0 && (
              <span className="text-xs bg-oca-blue/10 text-oca-blue px-2 py-1 rounded">
                Día{currentFilters.dia.length > 1 ? 's' : ''}: {currentFilters.dia.join(', ')}
              </span>
            )}
          </div>
          <StackedBarChart
            data={daily}
            height="280px"
            onElementClick={onFilterByDay ? handleChartClick : undefined}
          />
        </div>
      )}
    </div>
  );
}
