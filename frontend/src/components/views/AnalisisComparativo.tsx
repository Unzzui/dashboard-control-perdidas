'use client';

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { MensualStats, ZonaStats, TecnicoRanking } from '@/types';

interface AnalisisComparativoProps {
  mensual: MensualStats[];
  zonas: ZonaStats[];
  tecnicos: TecnicoRanking[];
  mesesSeleccionados: string[];
}

export default function AnalisisComparativo({
  mensual,
  zonas,
  tecnicos,
  mesesSeleccionados
}: AnalisisComparativoProps) {

  // Determinar períodos a comparar
  const { periodoActual, periodoAnterior, datosActual, datosAnterior } = useMemo(() => {
    if (mensual.length === 0) {
      return { periodoActual: null, periodoAnterior: null, datosActual: null, datosAnterior: null };
    }

    // Si hay 2+ meses seleccionados, comparar el último vs el primero
    if (mesesSeleccionados.length >= 2) {
      const mesesOrdenados = [...mesesSeleccionados].sort();
      const primerMes = mesesOrdenados[0];
      const ultimoMes = mesesOrdenados[mesesOrdenados.length - 1];

      const datosAnterior = mensual.find(m => m.mes === primerMes);
      const datosActual = mensual.find(m => m.mes === ultimoMes);

      return {
        periodoActual: ultimoMes,
        periodoAnterior: primerMes,
        datosActual,
        datosAnterior,
      };
    }

    // Si hay 1 mes o ninguno, comparar últimos 2 meses disponibles
    const mesesOrdenados = [...mensual].sort((a, b) => {
      const [mesA, añoA] = a.mes.split('/');
      const [mesB, añoB] = b.mes.split('/');
      return (parseInt(añoB) * 12 + parseInt(mesB)) - (parseInt(añoA) * 12 + parseInt(mesA));
    });

    if (mesesOrdenados.length >= 2) {
      return {
        periodoActual: mesesOrdenados[0].mes,
        periodoAnterior: mesesOrdenados[1].mes,
        datosActual: mesesOrdenados[0],
        datosAnterior: mesesOrdenados[1],
      };
    }

    return {
      periodoActual: mesesOrdenados[0]?.mes || null,
      periodoAnterior: null,
      datosActual: mesesOrdenados[0] || null,
      datosAnterior: null,
    };
  }, [mensual, mesesSeleccionados]);

  // Calcular variaciones
  const variaciones = useMemo(() => {
    if (!datosActual || !datosAnterior) {
      return null;
    }

    return {
      cnr: datosActual.cnr - datosAnterior.cnr,
      pct_cnr: datosActual.pct_cnr - datosAnterior.pct_cnr,
      efectivas: datosActual.efectivas - datosAnterior.efectivas,
      pct_efectivas: datosActual.pct_efectivas - datosAnterior.pct_efectivas,
      visita_fallida: datosActual.visita_fallida - datosAnterior.visita_fallida,
      pct_visita_fallida: datosActual.pct_visita_fallida - datosAnterior.pct_visita_fallida,
      cnr_falla: datosActual.cnr_falla - datosAnterior.cnr_falla,
      cnr_hurto: datosActual.cnr_hurto - datosAnterior.cnr_hurto,
    };
  }, [datosActual, datosAnterior]);

  // Gráfico de tendencia mensual
  const tendenciaMensualOption = useMemo(() => {
    const mesesOrdenados = [...mensual].sort((a, b) => {
      const [mesA, añoA] = a.mes.split('/');
      const [mesB, añoB] = b.mes.split('/');
      return (parseInt(añoA) * 12 + parseInt(mesA)) - (parseInt(añoB) * 12 + parseInt(mesB));
    });

    return {
      tooltip: {
        trigger: 'axis',
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
        bottom: '15%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: mesesOrdenados.map(m => m.mes),
        axisLabel: { fontSize: 10, color: '#64748b' },
        boundaryGap: false,
      },
      yAxis: [
        {
          type: 'value',
          name: 'Cantidad',
          axisLabel: { fontSize: 10, color: '#64748b' },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
        },
        {
          type: 'value',
          name: '%',
          axisLabel: { fontSize: 10, color: '#64748b', formatter: '{value}%' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'CNR',
          type: 'bar',
          data: mesesOrdenados.map(m => m.cnr),
          itemStyle: { color: '#475569' },
        },
        {
          name: 'V. Fallida',
          type: 'bar',
          data: mesesOrdenados.map(m => m.visita_fallida),
          itemStyle: { color: '#f59e0b' },
        },
        {
          name: '% Efectivas',
          type: 'line',
          yAxisIndex: 1,
          data: mesesOrdenados.map(m => m.pct_efectivas),
          smooth: true,
          lineStyle: { color: '#16a34a', width: 2 },
          itemStyle: { color: '#16a34a' },
        },
      ],
    };
  }, [mensual]);

  // Ranking de zonas por CNR
  const zonasRanking = useMemo(() => {
    return [...zonas]
      .sort((a, b) => b.cnr - a.cnr)
      .map((z, idx) => ({ ...z, rank: idx + 1 }));
  }, [zonas]);

  // Gráfico de zonas
  const zonasChartOption = useMemo(() => {
    const top10 = zonasRanking.slice(0, 10);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#334155', fontSize: 11 },
      },
      grid: {
        left: '3%',
        right: '12%',
        bottom: '5%',
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
        data: top10.map(z => z.zona).reverse(),
        axisLabel: { fontSize: 10, color: '#475569', width: 120, overflow: 'truncate' },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: top10.map(z => ({
            value: z.cnr,
            itemStyle: { color: '#475569', borderRadius: [0, 4, 4, 0] },
          })).reverse(),
          barWidth: '60%',
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            color: '#475569',
            formatter: (params: { value: number }) => params.value.toLocaleString('es-CL'),
          },
        },
      ],
    };
  }, [zonasRanking]);

  // Top técnicos por CNR
  const topTecnicos = useMemo(() => {
    return [...tecnicos]
      .sort((a, b) => b.cnr - a.cnr)
      .slice(0, 10);
  }, [tecnicos]);

  // Técnicos con mejor efectividad
  const topEfectividad = useMemo(() => {
    return [...tecnicos]
      .filter(t => t.visitas_totales >= 10) // Mínimo 10 visitas
      .sort((a, b) => b.pct_efectivas - a.pct_efectivas)
      .slice(0, 10);
  }, [tecnicos]);

  // Formatear variación con color
  const formatVariacion = (valor: number, invertir: boolean = false) => {
    const esPositivo = invertir ? valor < 0 : valor > 0;
    const colorClass = esPositivo ? 'text-green-600' : valor === 0 ? 'text-slate-500' : 'text-red-600';
    const signo = valor > 0 ? '+' : '';
    return <span className={`font-bold ${colorClass}`}>{signo}{valor.toFixed(1)}</span>;
  };

  if (mensual.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-slate-400 mb-2">No hay datos mensuales disponibles</p>
          <p className="text-[10px] text-slate-300">Selecciona un período con datos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Análisis Comparativo</h2>
        </div>
      </div>

      {/* KPIs de Variación (si hay comparación) */}
      {variaciones && datosActual && datosAnterior && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">CNR {periodoActual}</p>
            <p className="text-2xl font-bold text-slate-800">{datosActual.cnr.toLocaleString('es-CL')}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-slate-400">vs {datosAnterior.cnr.toLocaleString('es-CL')}</span>
              <span className="text-[10px]">{formatVariacion(variaciones.cnr)}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% CNR</p>
            <p className="text-2xl font-bold text-slate-800">{datosActual.pct_cnr.toFixed(1)}%</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-slate-400">vs {datosAnterior.pct_cnr.toFixed(1)}%</span>
              <span className="text-[10px]">{formatVariacion(variaciones.pct_cnr)}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Efectivas {periodoActual}</p>
            <p className="text-2xl font-bold text-slate-800">{datosActual.efectivas.toLocaleString('es-CL')}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-slate-400">vs {datosAnterior.efectivas.toLocaleString('es-CL')}</span>
              <span className="text-[10px]">{formatVariacion(variaciones.efectivas)}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% Efectivas</p>
            <p className={`text-2xl font-bold ${datosActual.pct_efectivas >= 70 ? 'text-green-600' : 'text-slate-800'}`}>
              {datosActual.pct_efectivas.toFixed(1)}%
            </p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-slate-400">vs {datosAnterior.pct_efectivas.toFixed(1)}%</span>
              <span className="text-[10px]">{formatVariacion(variaciones.pct_efectivas)}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">V. Fallida</p>
            <p className="text-2xl font-bold text-amber-600">{datosActual.visita_fallida.toLocaleString('es-CL')}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-slate-400">vs {datosAnterior.visita_fallida.toLocaleString('es-CL')}</span>
              <span className="text-[10px]">{formatVariacion(variaciones.visita_fallida, true)}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% V. Fallida</p>
            <p className={`text-2xl font-bold ${datosActual.pct_visita_fallida <= 30 ? 'text-green-600' : 'text-red-600'}`}>
              {datosActual.pct_visita_fallida.toFixed(1)}%
            </p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-slate-400">vs {datosAnterior.pct_visita_fallida.toFixed(1)}%</span>
              <span className="text-[10px]">{formatVariacion(variaciones.pct_visita_fallida, true)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tendencia Mensual */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Tendencia Mensual
          </h3>
          <ReactECharts
            option={tendenciaMensualOption}
            style={{ height: '300px', width: '100%' }}
            notMerge={true}
          />
        </div>

        {/* Top Zonas por CNR */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Top 10 Zonas por CNR
          </h3>
          <ReactECharts
            option={zonasChartOption}
            style={{ height: '300px', width: '100%' }}
            notMerge={true}
          />
        </div>
      </div>

      {/* Tabla de meses */}
      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
          Comparativo por Mes
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2 text-left text-[9px] font-semibold uppercase text-slate-500">Mes</th>
                <th className="px-2 py-2 text-right text-[9px] font-semibold uppercase text-slate-500">CNR</th>
                <th className="px-2 py-2 text-right text-[9px] font-semibold uppercase text-slate-500">% CNR</th>
                <th className="px-2 py-2 text-right text-[9px] font-semibold uppercase text-slate-500">Efectivas</th>
                <th className="px-2 py-2 text-right text-[9px] font-semibold uppercase text-slate-500">% Efect.</th>
                <th className="px-2 py-2 text-right text-[9px] font-semibold uppercase text-slate-500">V. Fallida</th>
                <th className="px-2 py-2 text-right text-[9px] font-semibold uppercase text-slate-500">% V.F.</th>
                <th className="px-2 py-2 text-right text-[9px] font-semibold uppercase text-slate-500">CNR Falla</th>
                <th className="px-2 py-2 text-right text-[9px] font-semibold uppercase text-slate-500">CNR Hurto</th>
              </tr>
            </thead>
            <tbody>
              {mensual.map((m, idx) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">{m.mes}</td>
                  <td className="px-2 py-2 text-right font-medium text-slate-800">{m.cnr.toLocaleString('es-CL')}</td>
                  <td className="px-2 py-2 text-right text-slate-600">{m.pct_cnr.toFixed(1)}%</td>
                  <td className="px-2 py-2 text-right font-medium text-slate-800">{m.efectivas.toLocaleString('es-CL')}</td>
                  <td className={`px-2 py-2 text-right ${m.pct_efectivas >= 70 ? 'text-green-600 font-medium' : 'text-slate-600'}`}>
                    {m.pct_efectivas.toFixed(1)}%
                  </td>
                  <td className="px-2 py-2 text-right text-amber-600">{m.visita_fallida.toLocaleString('es-CL')}</td>
                  <td className={`px-2 py-2 text-right ${m.pct_visita_fallida > 30 ? 'text-red-600' : 'text-slate-600'}`}>
                    {m.pct_visita_fallida.toFixed(1)}%
                  </td>
                  <td className="px-2 py-2 text-right text-green-600">{m.cnr_falla.toLocaleString('es-CL')}</td>
                  <td className="px-2 py-2 text-right text-red-600">{m.cnr_hurto.toLocaleString('es-CL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rankings de Técnicos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top CNR */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Top 10 Técnicos por CNR
          </h3>
          <div className="space-y-2">
            {topTecnicos.map((t, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                <span className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold ${
                  idx < 3 ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-700 truncate">{t.nombre}</p>
                  <p className="text-[9px] text-slate-400">{t.zona}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-slate-800">{t.cnr} CNR</p>
                  <p className="text-[9px] text-slate-400">{t.pct_efectivas.toFixed(0)}% efect.</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Efectividad */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-4">
            Top 10 por Efectividad
          </h3>
          <div className="space-y-2">
            {topEfectividad.map((t, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 bg-green-50 rounded border border-green-100">
                <span className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold ${
                  idx < 3 ? 'bg-green-600 text-white' : 'bg-green-200 text-green-700'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-700 truncate">{t.nombre}</p>
                  <p className="text-[9px] text-slate-400">{t.zona}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-green-600">{t.pct_efectivas.toFixed(1)}%</p>
                  <p className="text-[9px] text-slate-400">{t.visitas_efectivas}/{t.visitas_totales}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-slate-400 mt-3">*Mínimo 10 visitas</p>
        </div>
      </div>
    </div>
  );
}
