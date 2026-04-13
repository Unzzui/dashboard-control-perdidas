'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Filters, AtrasoZona, ResponsableRetiro, RetiroDiario } from '@/types';
import { getRetiroMedidores } from '@/lib/api';

interface RetiroMedidoresProps {
  filters: Filters;
}

export default function RetiroMedidores({ filters }: RetiroMedidoresProps) {
  const [atrasoZona, setAtrasoZona] = useState<AtrasoZona[]>([]);
  const [responsables, setResponsables] = useState<ResponsableRetiro[]>([]);
  const [retiroDiario, setRetiroDiario] = useState<RetiroDiario[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getRetiroMedidores(filters);
      setAtrasoZona(result.atraso_por_zona);
      setResponsables(result.responsables);
      setRetiroDiario(result.retiro_diario);
    } catch (error) {
      console.error('Error fetching retiro medidores:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calcular totales para KPIs
  const totals = useMemo(() => {
    const totalRetiros = retiroDiario.reduce((acc, r) => acc + r.cantidad, 0);
    const totalDentroPlazo = atrasoZona.reduce((acc, z) => acc + z.dentro_plazo, 0);
    const totalEntre37 = atrasoZona.reduce((acc, z) => acc + z.entre_3_7, 0);
    const totalMas7 = atrasoZona.reduce((acc, z) => acc + z.mas_7, 0);
    const total = totalDentroPlazo + totalEntre37 + totalMas7;
    const pctDentroPlazo = total > 0 ? (totalDentroPlazo / total * 100) : 0;
    const pctAtrasados = total > 0 ? ((totalEntre37 + totalMas7) / total * 100) : 0;
    const promedioDiario = retiroDiario.length > 0 ? Math.round(totalRetiros / retiroDiario.length) : 0;
    return { totalRetiros, totalDentroPlazo, totalEntre37, totalMas7, total, pctDentroPlazo, pctAtrasados, promedioDiario };
  }, [retiroDiario, atrasoZona]);

  // Alertas críticas (más de 7 días de atraso)
  const alertasCriticas = useMemo(() => {
    return responsables
      .filter(r => r.dias_atraso > 7)
      .sort((a, b) => b.dias_atraso - a.dias_atraso)
      .slice(0, 10);
  }, [responsables]);

  // Estadísticas por técnico
  const statsPorTecnico = useMemo(() => {
    const tecnicoMap: Record<string, { total: number; atrasados: number; diasPromedio: number; dias: number[] }> = {};

    responsables.forEach(r => {
      if (!tecnicoMap[r.tecnico]) {
        tecnicoMap[r.tecnico] = { total: 0, atrasados: 0, diasPromedio: 0, dias: [] };
      }
      tecnicoMap[r.tecnico].total++;
      tecnicoMap[r.tecnico].dias.push(r.dias_atraso);
      if (r.dias_atraso > 3) {
        tecnicoMap[r.tecnico].atrasados++;
      }
    });

    return Object.entries(tecnicoMap)
      .map(([nombre, stats]) => ({
        nombre,
        total: stats.total,
        atrasados: stats.atrasados,
        diasPromedio: stats.dias.length > 0 ? stats.dias.reduce((a, b) => a + b, 0) / stats.dias.length : 0,
        pctAtrasados: stats.total > 0 ? (stats.atrasados / stats.total * 100) : 0,
      }))
      .sort((a, b) => b.atrasados - a.atrasados)
      .slice(0, 10);
  }, [responsables]);

  // Agrupar responsables por zona
  const responsablesPorZona = useMemo(() => {
    const grupos: Record<string, ResponsableRetiro[]> = {};
    responsables.forEach(r => {
      if (!grupos[r.zona]) grupos[r.zona] = [];
      grupos[r.zona].push(r);
    });
    // Ordenar cada grupo por días de atraso
    Object.keys(grupos).forEach(zona => {
      grupos[zona].sort((a, b) => b.dias_atraso - a.dias_atraso);
    });
    return grupos;
  }, [responsables]);

  // Formatear fecha para mostrar día/mes
  const formatFecha = useCallback((fecha: string) => {
    const date = new Date(fecha);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return `${day}/${month.toString().padStart(2, '0')}`;
  }, []);

  // Calcular promedio real de retiros
  const promedioRetiros = useMemo(() => {
    if (retiroDiario.length === 0) return 0;
    const suma = retiroDiario.reduce((acc, r) => acc + r.cantidad, 0);
    return Math.round(suma / retiroDiario.length);
  }, [retiroDiario]);

  // Gráfico de línea diario
  const chartOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', crossStyle: { color: '#999' } },
      backgroundColor: '#fff',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: '#334155', fontSize: 11 },
      formatter: (params: { name: string; value: number; seriesName: string; color: string }[]) => {
        const idx = retiroDiario.findIndex(r => formatFecha(r.fecha) === params[0].name);
        const fecha = idx >= 0 ? retiroDiario[idx].fecha : params[0].name;
        let html = `<div style="font-weight:600;margin-bottom:4px">${fecha}</div>`;
        params.forEach(p => {
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            ${p.seriesName}: <b>${p.value.toLocaleString('es-CL')}</b>
          </div>`;
        });
        return html;
      },
    },
    legend: {
      bottom: 0,
      itemWidth: 16,
      itemHeight: 2,
      textStyle: { fontSize: 10, color: '#64748b' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: retiroDiario.map((r) => formatFecha(r.fecha)),
      axisLabel: { fontSize: 10, color: '#64748b', rotate: retiroDiario.length > 15 ? 45 : 0 },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, color: '#64748b' },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    series: [
      {
        name: 'Retiros',
        type: 'line',
        data: retiroDiario.map((r) => r.cantidad),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#475569', width: 2 },
        itemStyle: { color: '#475569' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(71, 85, 105, 0.3)' },
              { offset: 1, color: 'rgba(71, 85, 105, 0.05)' },
            ],
          },
        },
      },
      {
        name: `Promedio (${promedioRetiros})`,
        type: 'line',
        data: retiroDiario.map(() => promedioRetiros),
        lineStyle: { color: '#f59e0b', width: 2, type: 'dashed' },
        itemStyle: { color: '#f59e0b' },
        symbol: 'none',
        smooth: false,
      },
    ],
  }), [retiroDiario, formatFecha, promedioRetiros]);

  // Gráfico de distribución de atrasos (donut)
  const donutOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      backgroundColor: '#fff',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: '#334155', fontSize: 11 },
      formatter: (params: { name: string; value: number; percent: number }) =>
        `${params.name}: ${params.value.toLocaleString('es-CL')} (${params.percent.toFixed(1)}%)`,
    },
    legend: {
      orient: 'horizontal',
      bottom: 0,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { fontSize: 11, color: '#64748b' },
    },
    series: [
      {
        type: 'pie',
        radius: ['50%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: {
          show: true,
          position: 'outside',
          fontSize: 10,
          formatter: (params: { value: number; percent: number }) => {
            const formatted = params.value >= 1000
              ? `${(params.value / 1000).toFixed(1)} mil`
              : params.value.toLocaleString('es-CL');
            return `${formatted} (${params.percent.toFixed(1)}%)`;
          },
        },
        labelLine: {
          show: true,
          length: 10,
          length2: 15,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 12,
            fontWeight: 'bold',
          },
        },
        data: [
          { value: totals.totalDentroPlazo, name: 'En plazo', itemStyle: { color: '#16a34a' } },
          { value: totals.totalEntre37, name: '3-7 días', itemStyle: { color: '#f59e0b' } },
          { value: totals.totalMas7, name: '+7 días', itemStyle: { color: '#dc2626' } },
        ],
      },
    ],
    graphic: {
      type: 'text',
      left: 'center',
      top: '40%',
      style: {
        text: totals.total >= 1000 ? `${(totals.total / 1000).toFixed(1)} mil` : totals.total.toLocaleString('es-CL'),
        fontSize: 18,
        fontWeight: 'bold',
        fill: '#374151',
        textAlign: 'center',
      },
    },
  }), [totals]);

  // Gráfico de barras apiladas por zona
  const stackedBarOption = useMemo(() => {
    const zonas = atrasoZona.map(z => z.zona);
    return {
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
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { fontSize: 10, color: '#64748b' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      yAxis: {
        type: 'category',
        data: zonas,
        axisLabel: { fontSize: 10, color: '#475569', width: 120, overflow: 'truncate' },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: 'En plazo',
          type: 'bar',
          stack: 'total',
          data: atrasoZona.map(z => z.dentro_plazo),
          itemStyle: { color: '#16a34a' },
          barWidth: '60%',
        },
        {
          name: '3-7 días',
          type: 'bar',
          stack: 'total',
          data: atrasoZona.map(z => z.entre_3_7),
          itemStyle: { color: '#f59e0b' },
        },
        {
          name: '+7 días',
          type: 'bar',
          stack: 'total',
          data: atrasoZona.map(z => z.mas_7),
          itemStyle: { color: '#dc2626' },
        },
      ],
    };
  }, [atrasoZona]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total Retiros</p>
          <p className="text-2xl font-bold text-slate-800">{totals.totalRetiros.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Prom. Diario</p>
          <p className="text-2xl font-bold text-slate-800">{totals.promedioDiario}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Pendientes</p>
          <p className="text-2xl font-bold text-slate-800">{totals.total.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">En Plazo</p>
          <p className="text-2xl font-bold text-green-600">{totals.totalDentroPlazo.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">{totals.pctDentroPlazo.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">3-7 días</p>
          <p className="text-2xl font-bold text-amber-600">{totals.totalEntre37.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">+7 días</p>
          <p className="text-2xl font-bold text-red-600">{totals.totalMas7.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% Atrasados</p>
          <p className={`text-2xl font-bold ${totals.pctAtrasados > 30 ? 'text-red-600' : 'text-slate-800'}`}>
            {totals.pctAtrasados.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Alertas Críticas</p>
          <p className={`text-2xl font-bold ${alertasCriticas.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {alertasCriticas.length}
          </p>
        </div>
      </div>

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de tendencia diaria */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4 lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Tendencia de Retiros Diarios
          </h3>
          {retiroDiario.length > 0 ? (
            <ReactECharts
              option={chartOption}
              style={{ height: '280px', width: '100%' }}
              notMerge={true}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              Sin datos de retiros diarios
            </div>
          )}
        </div>

        {/* Distribución de estados */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Distribución de Estados
          </h3>
          {totals.total > 0 ? (
            <ReactECharts
              option={donutOption}
              style={{ height: '280px', width: '100%' }}
              notMerge={true}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              Sin datos
            </div>
          )}
        </div>
      </div>

      {/* Atraso por Zona y Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de barras apiladas por zona */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4 lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Atraso por Zona
          </h3>
          {atrasoZona.length > 0 ? (
            <ReactECharts
              option={stackedBarOption}
              style={{ height: '300px', width: '100%' }}
              notMerge={true}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              Sin datos de atraso por zona
            </div>
          )}
        </div>

        {/* Panel de alertas críticas */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-4">
            Alertas Críticas (+7 días)
          </h3>
          {alertasCriticas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <span className="text-green-600 text-xl font-bold">✓</span>
              </div>
              <p className="text-green-700 font-medium">Sin alertas críticas</p>
              <p className="text-[10px] text-slate-400 mt-1">Todos los retiros están dentro del plazo aceptable</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {alertasCriticas.map((r, idx) => (
                <div key={idx} className="p-2 bg-red-50 rounded border border-red-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-red-700 truncate" title={r.tecnico}>
                      {r.tecnico}
                    </span>
                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                      {r.dias_atraso.toFixed(0)} días
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-red-600">
                    <span>Aviso: {r.aviso}</span>
                    <span>{r.zona}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Técnicos con más atrasos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Técnicos con Más Atrasos
          </h3>
          {statsPorTecnico.length > 0 ? (
            <div className="space-y-2">
              {statsPorTecnico.slice(0, 8).map((t, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold ${
                    idx < 3 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-700 truncate" title={t.nombre}>
                        {t.nombre}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-2">
                        {t.atrasados}/{t.total} atrasados
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${t.pctAtrasados > 50 ? 'bg-red-500' : t.pctAtrasados > 30 ? 'bg-amber-500' : 'bg-slate-500'}`}
                          style={{ width: `${Math.min(t.pctAtrasados, 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 w-12 text-right">
                        {t.pctAtrasados.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400">
              Sin datos de técnicos
            </div>
          )}
        </div>

        {/* Resumen por zona */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Resumen por Zona
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {atrasoZona.map((zona, idx) => {
              const pctEnPlazo = zona.total > 0 ? (zona.dentro_plazo / zona.total * 100) : 0;
              const pctCritico = zona.total > 0 ? (zona.mas_7 / zona.total * 100) : 0;
              return (
                <div key={idx} className="p-2 bg-slate-50 rounded border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-slate-700 truncate" title={zona.zona}>
                      {zona.zona}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600">
                      {zona.total} pendientes
                    </span>
                  </div>
                  <div className="flex items-center gap-1 h-2 rounded-full overflow-hidden bg-slate-200">
                    <div className="h-full bg-green-500" style={{ width: `${pctEnPlazo}%` }} />
                    <div className="h-full bg-amber-500" style={{ width: `${zona.total > 0 ? (zona.entre_3_7 / zona.total * 100) : 0}%` }} />
                    <div className="h-full bg-red-500" style={{ width: `${pctCritico}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5 text-[9px]">
                    <span className="text-green-600">{zona.dentro_plazo} en plazo</span>
                    <span className="text-amber-600">{zona.entre_3_7} (3-7d)</span>
                    <span className="text-red-600">{zona.mas_7} (+7d)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detalle por zona */}
      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
          Detalle de Responsables por Zona
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
          {Object.entries(responsablesPorZona).map(([zona, items]) => {
            const criticos = items.filter(r => r.dias_atraso > 7).length;
            return (
              <div key={zona} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-800 text-white px-3 py-2 flex justify-between items-center">
                  <span className="text-xs font-semibold truncate">{zona}</span>
                  <div className="flex items-center gap-2">
                    {criticos > 0 && (
                      <span className="text-[9px] bg-red-500 px-1.5 py-0.5 rounded">{criticos} críticos</span>
                    )}
                    <span className="text-[10px] text-slate-300">{items.length}</span>
                  </div>
                </div>
                <div className="max-h-[280px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-2 py-1 text-[9px] font-semibold text-slate-500 text-left">Técnico</th>
                        <th className="px-2 py-1 text-[9px] font-semibold text-slate-500 text-right">Aviso</th>
                        <th className="px-2 py-1 text-[9px] font-semibold text-slate-500 text-right">Días</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r, idx) => (
                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-2 py-1.5 text-[10px] text-slate-700 truncate max-w-[120px]" title={r.tecnico}>
                            {r.tecnico}
                          </td>
                          <td className="px-2 py-1.5 text-[10px] text-slate-500 text-right">{r.aviso}</td>
                          <td className="px-2 py-1.5 text-right">
                            <span className={`inline-block px-1 rounded text-[9px] font-bold ${
                              r.dias_atraso > 7 ? 'bg-red-100 text-red-700' :
                              r.dias_atraso > 3 ? 'bg-amber-100 text-amber-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {r.dias_atraso.toFixed(0)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
