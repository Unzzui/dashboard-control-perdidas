'use client';

import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { VisitaFallidaResponsabilidad, ResultadoFallido, KPIData } from '@/types';
import DataTable from '@/components/ui/DataTable';
import DonutChart, { DonutClickEvent } from '@/components/charts/DonutChart';

type ResponsabilidadFiltro = 'CGE' | 'OCA' | null;

interface VisitasFallidasProps {
  responsabilidad: VisitaFallidaResponsabilidad[];
  totalCGE: number;
  totalContratista: number;
  resultadosFallidos: ResultadoFallido[];
  kpis: KPIData;
}

const COLOR_CGE = '#475569';      // slate-600
const COLOR_OCA = '#f59e0b';      // amber-500
const COLOR_CGE_DIM = '#47556966'; // slate-600 a 40% alpha
const COLOR_OCA_DIM = '#f59e0b66'; // amber-500 a 40% alpha

const cantidadFor = (r: ResultadoFallido, f: ResponsabilidadFiltro): number =>
  f === 'CGE' ? r.cantidad_cge : f === 'OCA' ? r.cantidad_oca : r.cantidad;

export default function VisitasFallidas({
  responsabilidad,
  totalCGE,
  totalContratista,
  resultadosFallidos,
  kpis,
}: VisitasFallidasProps) {
  const [filtro, setFiltro] = useState<ResponsabilidadFiltro>(null);

  // ============================================================
  // BLOQUE 1: KPIs globales (no responden al filtro)
  // ============================================================
  const total = totalCGE + totalContratista;
  const pctCGE = total > 0 ? (totalCGE / total * 100).toFixed(1) : '0';
  const pctOCA = total > 0 ? (totalContratista / total * 100).toFixed(1) : '0';

  const deltaExcluida = (kpis.pct_efectivas_sin_cge_excluida - kpis.pct_efectivas);
  const deltaReclasificada = (kpis.pct_efectivas_sin_cge_reclasificada - kpis.pct_efectivas);

  // ============================================================
  // BLOQUE 2: KPIs de fallidas + tabla + donut + top 10 (filtran)
  // ============================================================

  // Totales del bloque 2 según filtro
  const totalVisible = filtro === 'CGE' ? totalCGE
                     : filtro === 'OCA' ? totalContratista
                     : total;

  const tiposResultadoVisibles = useMemo(() => {
    if (filtro === 'CGE') return resultadosFallidos.filter(r => r.cantidad_cge > 0).length;
    if (filtro === 'OCA') return resultadosFallidos.filter(r => r.cantidad_oca > 0).length;
    return resultadosFallidos.length;
  }, [resultadosFallidos, filtro]);

  // Tabla por delegación: orden y columnas según filtro
  const responsabilidadOrdenada = useMemo(() => {
    const list = [...responsabilidad];
    if (filtro === 'CGE') {
      return list
        .filter(r => r.responsabilidad_cge > 0)
        .sort((a, b) => b.responsabilidad_cge - a.responsabilidad_cge)
        .slice(0, 20);
    }
    if (filtro === 'OCA') {
      return list
        .filter(r => r.responsabilidad_contratista > 0)
        .sort((a, b) => b.responsabilidad_contratista - a.responsabilidad_contratista)
        .slice(0, 20);
    }
    return list.slice(0, 20);
  }, [responsabilidad, filtro]);

  const columns = useMemo(() => {
    const base: Array<{ key: string; header: string; align?: 'right'; width?: string;
                       render?: (row: VisitaFallidaResponsabilidad) => React.ReactNode }> = [
      { key: 'descripcion', header: 'Descripción', width: '250px' },
    ];

    if (filtro !== 'OCA') {
      base.push({
        key: 'responsabilidad_cge',
        header: 'CGE',
        align: 'right',
        render: (row) =>
          row.responsabilidad_cge > 0 ? (
            <span className="text-slate-600">{row.responsabilidad_cge.toLocaleString('es-CL')}</span>
          ) : <span className="text-slate-300">-</span>,
      });
      base.push({
        key: 'pct_cge',
        header: '%',
        align: 'right',
        render: (row) =>
          row.pct_cge > 0 ? (
            <span className="text-slate-500">{row.pct_cge.toFixed(1)}%</span>
          ) : <span className="text-slate-300">-</span>,
      });
    }

    if (filtro !== 'CGE') {
      base.push({
        key: 'responsabilidad_contratista',
        header: 'OCA',
        align: 'right',
        render: (row) =>
          row.responsabilidad_contratista > 0 ? (
            <span className="text-slate-600">{row.responsabilidad_contratista.toLocaleString('es-CL')}</span>
          ) : <span className="text-slate-300">-</span>,
      });
      base.push({
        key: 'pct_contratista',
        header: '%',
        align: 'right',
        render: (row) =>
          row.pct_contratista > 0 ? (
            <span className="text-slate-500">{row.pct_contratista.toFixed(1)}%</span>
          ) : <span className="text-slate-300">-</span>,
      });
    }

    base.push({
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (row) => {
        const value = filtro === 'CGE' ? row.responsabilidad_cge
                    : filtro === 'OCA' ? row.responsabilidad_contratista
                    : row.total;
        return <span className="font-medium text-slate-800">{value.toLocaleString('es-CL')}</span>;
      },
    });

    return base;
  }, [filtro]);

  // Donut: colores y datos
  const donutData = useMemo(() => [
    { name: 'CGE', value: totalCGE },
    { name: 'OCA', value: totalContratista },
  ], [totalCGE, totalContratista]);

  const donutColors = useMemo(() => {
    if (filtro === 'CGE') return [COLOR_CGE, COLOR_OCA_DIM];
    if (filtro === 'OCA') return [COLOR_CGE_DIM, COLOR_OCA];
    return [COLOR_CGE, COLOR_OCA];
  }, [filtro]);

  const handleDonutClick = (event: DonutClickEvent) => {
    const target: ResponsabilidadFiltro = event.name === 'CGE' ? 'CGE'
                                        : event.name === 'OCA' ? 'OCA'
                                        : null;
    if (!target) return;
    setFiltro(prev => prev === target ? null : target);
  };

  // Top 10 (filtra por responsabilidad activa)
  const { topResultados, otrosResultados, totalResultados } = useMemo(() => {
    const sorted = [...resultadosFallidos]
      .filter(r => cantidadFor(r, filtro) > 0)
      .sort((a, b) => cantidadFor(b, filtro) - cantidadFor(a, filtro));

    const top10 = sorted.slice(0, 10);
    const otros = sorted.slice(10);
    const totalRes = sorted.reduce((acc, r) => acc + cantidadFor(r, filtro), 0);
    return { topResultados: top10, otrosResultados: otros, totalResultados: totalRes };
  }, [resultadosFallidos, filtro]);

  const otrosTotal = useMemo(
    () => otrosResultados.reduce((acc, r) => acc + cantidadFor(r, filtro), 0),
    [otrosResultados, filtro]
  );

  const barChartOption = useMemo(() => {
    const labels = topResultados.map(r =>
      r.resultado.length > 35 ? r.resultado.substring(0, 35) + '...' : r.resultado
    ).reverse();

    const cgeValues = topResultados.map(r => r.cantidad_cge).reverse();
    const ocaValues = topResultados.map(r => r.cantidad_oca).reverse();
    const fullNames = topResultados.map(r => r.resultado).reverse();

    const series: Array<Record<string, unknown>> = [];

    if (filtro === null || filtro === 'CGE') {
      series.push({
        name: 'CGE',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: COLOR_CGE },
        emphasis: { focus: 'series' },
        data: cgeValues,
      });
    }
    if (filtro === null || filtro === 'OCA') {
      series.push({
        name: 'OCA',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: COLOR_OCA },
        emphasis: { focus: 'series' },
        data: ocaValues,
      });
    }

    return {
      legend: filtro === null ? {
        data: ['CGE', 'OCA'],
        top: 0,
        right: 0,
        textStyle: { fontSize: 11, color: '#475569' },
        itemWidth: 10,
        itemHeight: 10,
        selectedMode: false,
      } : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#334155', fontSize: 11 },
        formatter: (params: Array<{ axisValue: string; data: number; seriesName: string; dataIndex: number }>) => {
          if (!params.length) return '';
          const idx = params[0].dataIndex;
          const fullName = fullNames[idx];
          const cge = cgeValues[idx];
          const oca = ocaValues[idx];
          const total = (filtro === 'CGE' ? cge : filtro === 'OCA' ? oca : cge + oca);
          const pct = totalResultados > 0 ? (total / totalResultados * 100).toFixed(1) : '0';
          let html = `<div style="font-weight:600;margin-bottom:4px">${fullName}</div>`;
          if (filtro !== 'OCA') html += `<div>CGE: <b>${cge.toLocaleString('es-CL')}</b></div>`;
          if (filtro !== 'CGE') html += `<div>OCA: <b>${oca.toLocaleString('es-CL')}</b></div>`;
          html += `<div>Total: <b>${total.toLocaleString('es-CL')}</b></div>`;
          html += `<div>Porcentaje: <b>${pct}%</b></div>`;
          return html;
        },
      },
      grid: {
        left: '3%',
        right: '12%',
        top: filtro === null ? '12%' : '3%',
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
        data: labels,
        axisLabel: {
          fontSize: 10,
          color: '#475569',
          width: 180,
          overflow: 'truncate',
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series,
    };
  }, [topResultados, totalResultados, filtro]);

  // ============================================================
  // RENDER
  // ============================================================

  // Helpers de estilo para atenuar cards opuestas al filtro
  const dimCge = filtro === 'OCA' ? 'opacity-40' : '';
  const dimOca = filtro === 'CGE' ? 'opacity-40' : '';

  // Valor a mostrar en cards filtradas (placeholder si está atenuada)
  const cgeDisplay = filtro === 'OCA' ? '—' : totalCGE.toLocaleString('es-CL');
  const ocaDisplay = filtro === 'CGE' ? '—' : totalContratista.toLocaleString('es-CL');

  return (
    <div className="space-y-6">
      {/* ============== BLOQUE 1: KPIs globales ============== */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Operación global</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total Visitas</p>
            <p className="text-2xl font-bold text-slate-800">{kpis.total_registros.toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Efectividad</p>
            <p className="text-2xl font-bold text-slate-800">{kpis.pct_efectivas.toFixed(1)}%</p>
            <p className="text-[10px] text-slate-400 mt-1">Real</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Efec. sin CGE (excluida)</p>
            <p className="text-2xl font-bold text-slate-800">{kpis.pct_efectivas_sin_cge_excluida.toFixed(1)}%</p>
            <p className="text-[10px] text-green-600 mt-1">+{deltaExcluida.toFixed(1)} pp vs efectividad</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Efec. sin CGE (reclasif.)</p>
            <p className="text-2xl font-bold text-slate-800">{kpis.pct_efectivas_sin_cge_reclasificada.toFixed(1)}%</p>
            <p className="text-[10px] text-green-600 mt-1">+{deltaReclasificada.toFixed(1)} pp vs efectividad</p>
          </div>
        </div>
      </div>

      {/* ============== BLOQUE 2: KPIs fallidas (filtran) ============== */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Visitas fallidas</p>
          {filtro && (
            <button
              onClick={() => setFiltro(null)}
              className="text-[11px] text-slate-600 hover:text-slate-800 px-2 py-0.5 rounded border border-slate-200 bg-white"
            >
              Filtrado por: {filtro} ×
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total V. Fallidas</p>
            <p className="text-2xl font-bold text-slate-800">{totalVisible.toLocaleString('es-CL')}</p>
          </div>
          <div className={`bg-white rounded-lg border border-slate-200/60 p-4 transition-opacity ${dimCge}`}>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Resp. CGE</p>
            <p className="text-2xl font-bold text-slate-800">{cgeDisplay}</p>
            <p className="text-xs text-slate-400 mt-1">{filtro === 'OCA' ? '' : `${pctCGE}%`}</p>
          </div>
          <div className={`bg-white rounded-lg border border-slate-200/60 p-4 transition-opacity ${dimOca}`}>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Resp. OCA</p>
            <p className="text-2xl font-bold text-amber-600">{ocaDisplay}</p>
            <p className="text-xs text-slate-400 mt-1">{filtro === 'CGE' ? '' : `${pctOCA}%`}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Tipos Resultado</p>
            <p className="text-2xl font-bold text-slate-800">{tiposResultadoVisibles}</p>
          </div>
        </div>
      </div>

      {/* ============== Tabla por delegación + Donut ============== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Visitas Fallidas por Delegación
          </h3>
          <div className="max-h-[400px] overflow-y-auto">
            <DataTable columns={columns} data={responsabilidadOrdenada} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Distribución Responsabilidad
          </h3>
          <DonutChart
            data={donutData}
            colors={donutColors}
            onElementClick={handleDonutClick}
          />
          <p className="text-[10px] text-slate-400 text-center mt-2">
            Click en un segmento para filtrar la sección
          </p>
        </div>
      </div>

      {/* ============== Top 10 + Resumen lateral ============== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Top 10 Tipos de Resultados
            </h3>
            <span className="text-xs text-slate-400">
              {topResultados.length} de {tiposResultadoVisibles} tipos
            </span>
          </div>
          <ReactECharts
            option={barChartOption}
            style={{ height: '350px', width: '100%' }}
            notMerge={true}
          />
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Resumen de Resultados
          </h3>

          <div className="bg-slate-50 rounded-lg p-3 mb-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total Registros</p>
            <p className="text-3xl font-bold text-slate-800">{totalResultados.toLocaleString('es-CL')}</p>
          </div>

          <div className="space-y-2 mb-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Top 5 Resultados</p>
            {topResultados.slice(0, 5).map((r, idx) => {
              const cantidad = cantidadFor(r, filtro);
              const pct = totalResultados > 0 ? (cantidad / totalResultados * 100) : 0;
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

          {otrosResultados.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Otros ({otrosResultados.length} tipos)</span>
                <span className="font-medium text-slate-700">
                  {otrosTotal.toLocaleString('es-CL')}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {totalResultados > 0
                  ? (otrosTotal / totalResultados * 100).toFixed(1)
                  : 0}% del total
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
