'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { Filters, AnalisisComparativoData } from '@/types';
import { getAnalisisComparativo } from '@/lib/api';

interface AnalisisComparativoProps {
  filters: Filters;
}

function getFilterKey(filters: Filters): string {
  return `${filters.año}-${filters.mes.join(',')}-${filters.zona.join(',')}`;
}

export default function AnalisisComparativo({ filters }: AnalisisComparativoProps) {
  const [data, setData] = useState<AnalisisComparativoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastFilterKey = useRef<string>('');

  const fetchData = useCallback(async () => {
    const currentKey = getFilterKey(filters);
    if (currentKey === lastFilterKey.current && data !== null) return;
    if (!filters.año) return;

    lastFilterKey.current = currentKey;
    setIsLoading(true);

    try {
      const result = await getAnalisisComparativo(filters);
      setData(result);
    } catch (error) {
      console.error('Error fetching análisis comparativo:', error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [filters, data]);

  useEffect(() => {
    fetchData();
  }, [filters.año, filters.mes.join(','), filters.zona.join(',')]);

  // Formatear variación con color
  const formatVariacion = (valor: number, invertir: boolean = false) => {
    const esPositivo = invertir ? valor < 0 : valor > 0;
    const colorClass = esPositivo ? 'text-green-600' : valor === 0 ? 'text-slate-500' : 'text-red-600';
    const signo = valor > 0 ? '+' : '';
    return <span className={`font-bold ${colorClass}`}>{signo}{valor.toLocaleString('es-CL')}</span>;
  };

  const formatVariacionPct = (valor: number, invertir: boolean = false) => {
    const esPositivo = invertir ? valor < 0 : valor > 0;
    const colorClass = esPositivo ? 'text-green-600' : valor === 0 ? 'text-slate-500' : 'text-red-600';
    const signo = valor > 0 ? '+' : '';
    return <span className={`font-bold ${colorClass}`}>{signo}{valor.toFixed(1)}%</span>;
  };

  // Gráfico de comparación de zonas
  const zonasChartOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#fff',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: '#334155', fontSize: 11 },
    },
    legend: {
      bottom: 0,
      textStyle: { fontSize: 10 },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '5%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data?.zonas.map(z => z.zona) || [],
      axisLabel: { fontSize: 9, color: '#64748b', rotate: 45 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, color: '#64748b' },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
    },
    series: [
      {
        name: data?.periodo_anterior || 'Período Anterior',
        type: 'bar',
        data: data?.zonas.map(z => z.anterior.cnr) || [],
        itemStyle: { color: '#94a3b8', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 24,
      },
      {
        name: data?.periodo_actual || 'Período Actual',
        type: 'bar',
        data: data?.zonas.map(z => z.actual.cnr) || [],
        itemStyle: { color: '#294D6D', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 24,
      },
    ],
  };

  // Gráfico de efectividad por zona
  const efectividadChartOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: '#334155', fontSize: 11 },
      formatter: (params: any) => {
        return params.map((p: any) =>
          `${p.marker} ${p.seriesName}: ${p.value.toFixed(1)}%`
        ).join('<br/>');
      }
    },
    legend: {
      bottom: 0,
      textStyle: { fontSize: 10 },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '5%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data?.zonas.map(z => z.zona) || [],
      axisLabel: { fontSize: 9, color: '#64748b', rotate: 45 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, color: '#64748b', formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
    },
    series: [
      {
        name: data?.periodo_anterior || 'Período Anterior',
        type: 'line',
        data: data?.zonas.map(z => z.anterior.pct_cnr) || [],
        smooth: true,
        lineStyle: { color: '#94a3b8', width: 2 },
        itemStyle: { color: '#94a3b8' },
      },
      {
        name: data?.periodo_actual || 'Período Actual',
        type: 'line',
        data: data?.zonas.map(z => z.actual.pct_cnr) || [],
        smooth: true,
        lineStyle: { color: '#10b981', width: 2 },
        itemStyle: { color: '#10b981' },
      },
    ],
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  if (!data || !data.periodo_actual || !data.periodo_anterior) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-slate-400 mb-2">No hay datos suficientes para comparar</p>
          <p className="text-[10px] text-slate-300">Selecciona un período con al menos 2 meses de datos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Análisis Comparativo</h2>
          <p className="text-sm text-slate-500">
            {data.periodo_actual} vs {data.periodo_anterior}
          </p>
        </div>
      </div>

      {/* KPIs de Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">CNR</p>
          <p className="text-3xl font-bold text-slate-800">
            {data.resumen.total_cnr_actual.toLocaleString('es-CL')}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-slate-400">
              vs {data.resumen.total_cnr_anterior.toLocaleString('es-CL')}
            </span>
            <span className="text-[10px]">
              {formatVariacion(data.resumen.variacion_cnr)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Efectivas</p>
          <p className="text-3xl font-bold text-slate-800">
            {data.resumen.total_efectivas_actual.toLocaleString('es-CL')}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-slate-400">
              vs {data.resumen.total_efectivas_anterior.toLocaleString('es-CL')}
            </span>
            <span className="text-[10px]">
              {formatVariacion(data.resumen.variacion_efectivas)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">V. Fallida</p>
          <p className="text-3xl font-bold text-amber-600">
            {data.resumen.total_vf_actual.toLocaleString('es-CL')}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-slate-400">
              vs {data.resumen.total_vf_anterior.toLocaleString('es-CL')}
            </span>
            <span className="text-[10px]">
              {formatVariacion(data.resumen.variacion_vf, true)}
            </span>
          </div>
        </div>
      </div>

      {/* Gráficos Comparativos */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            CNR por Zona - Comparativo
          </h3>
          <ReactECharts
            option={zonasChartOption}
            style={{ height: '300px', width: '100%' }}
            notMerge={true}
          />
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            % CNR por Zona - Tendencia
          </h3>
          <ReactECharts
            option={efectividadChartOption}
            style={{ height: '300px', width: '100%' }}
            notMerge={true}
          />
        </div>
      </div>

      {/* Tabla Comparativa de Zonas */}
      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
          Comparativo Detallado por Zona
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Zona</th>
                <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase text-slate-500" colSpan={2}>CNR</th>
                <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase text-slate-500" colSpan={2}>% CNR</th>
                <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase text-slate-500" colSpan={2}>Efectivas</th>
                <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase text-slate-500" colSpan={2}>V. Fallida</th>
              </tr>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2"></th>
                <th className="px-2 py-1 text-center text-[9px] text-slate-400">Actual</th>
                <th className="px-2 py-1 text-center text-[9px] text-slate-400">Var.</th>
                <th className="px-2 py-1 text-center text-[9px] text-slate-400">Actual</th>
                <th className="px-2 py-1 text-center text-[9px] text-slate-400">Var.</th>
                <th className="px-2 py-1 text-center text-[9px] text-slate-400">Actual</th>
                <th className="px-2 py-1 text-center text-[9px] text-slate-400">Var.</th>
                <th className="px-2 py-1 text-center text-[9px] text-slate-400">Actual</th>
                <th className="px-2 py-1 text-center text-[9px] text-slate-400">Var.</th>
              </tr>
            </thead>
            <tbody>
              {data.zonas.map((z, idx) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/80">
                  <td className="px-3 py-2 font-medium text-slate-700">{z.zona}</td>
                  <td className="px-2 py-2 text-center text-slate-800 font-medium">
                    {z.actual.cnr.toLocaleString('es-CL')}
                  </td>
                  <td className="px-2 py-2 text-center text-[10px]">
                    {formatVariacion(z.variacion.cnr)}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-800">
                    {z.actual.pct_cnr.toFixed(1)}%
                  </td>
                  <td className="px-2 py-2 text-center text-[10px]">
                    {formatVariacionPct(z.variacion.pct_cnr)}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-800 font-medium">
                    {z.actual.efectivas.toLocaleString('es-CL')}
                  </td>
                  <td className="px-2 py-2 text-center text-[10px]">
                    {formatVariacion(z.variacion.efectivas)}
                  </td>
                  <td className="px-2 py-2 text-center text-amber-600">
                    {z.actual.visita_fallida.toLocaleString('es-CL')}
                  </td>
                  <td className="px-2 py-2 text-center text-[10px]">
                    {formatVariacion(z.variacion.visita_fallida, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rankings de Técnicos */}
      <div className="grid grid-cols-2 gap-4">
        {/* Técnicos Mejorando */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-4">
            Técnicos Mejorando ({data.tecnicos_mejorando.length})
          </h3>
          {data.tecnicos_mejorando.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-8">
              No hay técnicos con tendencia de mejora
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {data.tecnicos_mejorando.map((t, idx) => (
                <div key={idx} className="p-2 bg-green-50 rounded border border-green-100">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-slate-700 truncate">{t.nombre}</p>
                      <p className="text-[9px] text-slate-400">{t.zona}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-green-600">
                        {t.actual_cnr} CNR {formatVariacion(t.variacion_cnr)}
                      </p>
                      <p className="text-[9px] text-slate-500">
                        {t.actual_pct_efectivas.toFixed(1)}% efect.
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Técnicos Cayendo */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-4">
            Técnicos en Declive ({data.tecnicos_cayendo.length})
          </h3>
          {data.tecnicos_cayendo.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-8">
              No hay técnicos con tendencia de declive
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {data.tecnicos_cayendo.map((t, idx) => (
                <div key={idx} className="p-2 bg-red-50 rounded border border-red-100">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-slate-700 truncate">{t.nombre}</p>
                      <p className="text-[9px] text-slate-400">{t.zona}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-red-600">
                        {t.actual_cnr} CNR {formatVariacion(t.variacion_cnr)}
                      </p>
                      <p className="text-[9px] text-slate-500">
                        {t.actual_pct_efectivas.toFixed(1)}% efect.
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
