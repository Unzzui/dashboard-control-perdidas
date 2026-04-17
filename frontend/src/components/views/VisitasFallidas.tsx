'use client';

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { VisitaFallidaResponsabilidad, ResultadoFallido } from '@/types';
import DataTable from '@/components/ui/DataTable';
import DonutChart from '@/components/charts/DonutChart';

interface VisitasFallidasProps {
  responsabilidad: VisitaFallidaResponsabilidad[];
  totalCGE: number;
  totalContratista: number;
  resultadosFallidos: ResultadoFallido[];
}

export default function VisitasFallidas({
  responsabilidad,
  totalCGE,
  totalContratista,
  resultadosFallidos,
}: VisitasFallidasProps) {
  const columns = useMemo(() => [
    { key: 'descripcion', header: 'Descripción', width: '250px' },
    {
      key: 'responsabilidad_cge',
      header: 'CGE',
      align: 'right' as const,
      render: (row: VisitaFallidaResponsabilidad) =>
        row.responsabilidad_cge > 0 ? (
          <span className="text-slate-600">{row.responsabilidad_cge.toLocaleString('es-CL')}</span>
        ) : <span className="text-slate-300">-</span>,
    },
    {
      key: 'pct_cge',
      header: '%',
      align: 'right' as const,
      render: (row: VisitaFallidaResponsabilidad) =>
        row.pct_cge > 0 ? (
          <span className="text-slate-500">{row.pct_cge.toFixed(1)}%</span>
        ) : <span className="text-slate-300">-</span>,
    },
    {
      key: 'responsabilidad_contratista',
      header: 'Contratista',
      align: 'right' as const,
      render: (row: VisitaFallidaResponsabilidad) =>
        row.responsabilidad_contratista > 0 ? (
          <span className="text-slate-600">{row.responsabilidad_contratista.toLocaleString('es-CL')}</span>
        ) : <span className="text-slate-300">-</span>,
    },
    {
      key: 'pct_contratista',
      header: '%',
      align: 'right' as const,
      render: (row: VisitaFallidaResponsabilidad) =>
        row.pct_contratista > 0 ? (
          <span className="text-slate-500">{row.pct_contratista.toFixed(1)}%</span>
        ) : <span className="text-slate-300">-</span>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right' as const,
      render: (row: VisitaFallidaResponsabilidad) => (
        <span className="font-medium text-slate-800">{row.total.toLocaleString('es-CL')}</span>
      ),
    },
  ], []);

  const donutData = useMemo(() => [
    { name: 'Contratista', value: totalContratista },
    { name: 'CGE', value: totalCGE },
  ], [totalContratista, totalCGE]);

  const total = totalCGE + totalContratista;
  const pctCGE = total > 0 ? (totalCGE / total * 100).toFixed(1) : '0';
  const pctContratista = total > 0 ? (totalContratista / total * 100).toFixed(1) : '0';

  // Datos para el gráfico de tipos de resultados
  const { topResultados, otrosResultados, totalResultados } = useMemo(() => {
    const sorted = [...resultadosFallidos].sort((a, b) => b.cantidad - a.cantidad);
    const top10 = sorted.slice(0, 10);
    const otros = sorted.slice(10);
    const totalRes = sorted.reduce((acc, r) => acc + r.cantidad, 0);
    return { topResultados: top10, otrosResultados: otros, totalResultados: totalRes };
  }, [resultadosFallidos]);

  // Configuración del gráfico de barras horizontal
  const barChartOption = useMemo(() => {
    const data = topResultados.map(r => ({
      name: r.resultado.length > 35 ? r.resultado.substring(0, 35) + '...' : r.resultado,
      fullName: r.resultado,
      value: r.cantidad,
      pct: totalResultados > 0 ? (r.cantidad / totalResultados * 100).toFixed(1) : '0',
    }));

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#334155', fontSize: 11 },
        formatter: (params: { data: { fullName: string; value: number; pct: string } }[]) => {
          const d = params[0].data;
          return `<div style="font-weight:600;margin-bottom:4px">${d.fullName}</div>
                  <div>Cantidad: <b>${d.value.toLocaleString('es-CL')}</b></div>
                  <div>Porcentaje: <b>${d.pct}%</b></div>`;
        },
      },
      grid: {
        left: '3%',
        right: '12%',
        top: '3%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      yAxis: {
        type: 'category',
        data: data.map(d => d.name).reverse(),
        axisLabel: {
          fontSize: 10,
          color: '#475569',
          width: 180,
          overflow: 'truncate',
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: data.map(d => ({
            value: d.value,
            fullName: d.fullName,
            pct: d.pct,
            itemStyle: {
              color: '#475569',
              borderRadius: [0, 3, 3, 0],
            },
          })).reverse(),
          barWidth: '60%',
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            color: '#475569',
            formatter: (params: { data: { value: number; pct: string } }) =>
              `${params.data.value.toLocaleString('es-CL')} (${params.data.pct}%)`,
          },
        },
      ],
    };
  }, [topResultados, totalResultados]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total V. Fallidas</p>
          <p className="text-3xl font-bold text-slate-800">{total.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Resp. CGE</p>
          <p className="text-3xl font-bold text-slate-800">{totalCGE.toLocaleString('es-CL')}</p>
          <p className="text-xs text-slate-400 mt-1">{pctCGE}%</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Resp. Contratista</p>
          <p className="text-3xl font-bold text-amber-600">{totalContratista.toLocaleString('es-CL')}</p>
          <p className="text-xs text-slate-400 mt-1">{pctContratista}%</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Tipos Resultado</p>
          <p className="text-3xl font-bold text-slate-800">{resultadosFallidos.length}</p>
        </div>
      </div>

      {/* Tabla y Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Visitas Fallidas por Delegación
          </h3>
          <div className="max-h-[400px] overflow-y-auto">
            <DataTable columns={columns} data={responsabilidad.slice(0, 20)} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Distribución Responsabilidad
          </h3>
          <DonutChart
            data={donutData}
            colors={['#475569', '#f59e0b']}
          />
        </div>
      </div>

      {/* Tipos de Resultados - Mejorado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico principal */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Top 10 Tipos de Resultados
            </h3>
            <span className="text-xs text-slate-400">
              {topResultados.length} de {resultadosFallidos.length} tipos
            </span>
          </div>
          <ReactECharts
            option={barChartOption}
            style={{ height: '350px', width: '100%' }}
            notMerge={true}
          />
        </div>

        {/* Panel lateral con resumen */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Resumen de Resultados
          </h3>

          {/* Total */}
          <div className="bg-slate-50 rounded-lg p-3 mb-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total Registros</p>
            <p className="text-3xl font-bold text-slate-800">{totalResultados.toLocaleString('es-CL')}</p>
          </div>

          {/* Top 5 compacto */}
          <div className="space-y-2 mb-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Top 5 Resultados</p>
            {topResultados.slice(0, 5).map((r, idx) => {
              const pct = totalResultados > 0 ? (r.cantidad / totalResultados * 100) : 0;
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
                    idx === 0 ? 'bg-slate-800 text-white' :
                    idx === 1 ? 'bg-slate-600 text-white' :
                    idx === 2 ? 'bg-slate-400 text-white' :
                    'bg-slate-200 text-slate-600'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-700 truncate" title={r.resultado}>
                      {r.resultado}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-slate-600"
                          style={{ width: `${Math.min(pct * 2, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 w-10 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Otros resultados */}
          {otrosResultados.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Otros ({otrosResultados.length} tipos)</span>
                <span className="font-medium text-slate-700">
                  {otrosResultados.reduce((acc, r) => acc + r.cantidad, 0).toLocaleString('es-CL')}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {totalResultados > 0
                  ? (otrosResultados.reduce((acc, r) => acc + r.cantidad, 0) / totalResultados * 100).toFixed(1)
                  : 0}% del total
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
