'use client';

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { TecnicoRanking, ZonaStats, DailyStats } from '@/types';

interface ControlKWHProps {
  tecnicos: TecnicoRanking[];
  zonas: ZonaStats[];
  daily: DailyStats[];
  totalKWH: number;
}

export default function ControlKWH({ tecnicos, zonas, daily, totalKWH }: ControlKWHProps) {
  // Formatear números
  const formatKWH = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toLocaleString('es-CL');
  };

  // Agrupar técnicos por zona
  const tecnicosPorZona = useMemo(() => {
    const grupos: Record<string, { tecnicos: TecnicoRanking[]; totalKWH: number; totalEfectivas: number; totalCNR: number }> = {};

    tecnicos.forEach((t) => {
      if (!grupos[t.zona]) {
        grupos[t.zona] = { tecnicos: [], totalKWH: 0, totalEfectivas: 0, totalCNR: 0 };
      }
      grupos[t.zona].tecnicos.push(t);
      grupos[t.zona].totalKWH += t.kwh_estimado || 0;
      grupos[t.zona].totalEfectivas += t.efectivas || 0;
      grupos[t.zona].totalCNR += t.cnr || 0;
    });

    return Object.entries(grupos)
      .map(([zona, data]) => ({
        zona,
        ...data,
        tecnicos: data.tecnicos.sort((a, b) => (b.kwh_estimado || 0) - (a.kwh_estimado || 0)),
      }))
      .sort((a, b) => b.totalKWH - a.totalKWH);
  }, [tecnicos]);

  // Totales generales
  const totales = useMemo(() => {
    const totalEfectivas = tecnicos.reduce((acc, t) => acc + (t.efectivas || 0), 0);
    const totalCNR = tecnicos.reduce((acc, t) => acc + (t.cnr || 0), 0);
    const promedioKWH = tecnicos.length > 0 ? totalKWH / tecnicos.length : 0;
    const promedioEfectivas = tecnicos.length > 0 ? totalEfectivas / tecnicos.length : 0;
    return { totalEfectivas, totalCNR, promedioKWH, promedioEfectivas };
  }, [tecnicos, totalKWH]);

  // Top técnicos
  const topTecnicos = useMemo(() => {
    return [...tecnicos]
      .sort((a, b) => (b.kwh_estimado || 0) - (a.kwh_estimado || 0))
      .slice(0, 10);
  }, [tecnicos]);

  const maxKWH = useMemo(() => Math.max(...tecnicos.map((t) => t.kwh_estimado || 0), 1), [tecnicos]);

  // Tendencia diaria - mostrar todos los datos filtrados
  const tendenciaDiaria = useMemo(() => daily, [daily]);

  // Formatear fecha para mostrar día y mes
  const formatFechaCorta = (fecha: string, dia: number) => {
    const mesesCortos: Record<string, string> = {
      'enero': 'Ene', 'febrero': 'Feb', 'marzo': 'Mar', 'abril': 'Abr',
      'mayo': 'May', 'junio': 'Jun', 'julio': 'Jul', 'agosto': 'Ago',
      'septiembre': 'Sep', 'octubre': 'Oct', 'noviembre': 'Nov', 'diciembre': 'Dic'
    };

    // Intentar extraer mes de la fecha (formato esperado: "2024-03-15" o similar)
    if (fecha) {
      const parts = fecha.split('-');
      if (parts.length >= 2) {
        const mesNum = parseInt(parts[1], 10);
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        if (mesNum >= 1 && mesNum <= 12) {
          return `${dia} ${meses[mesNum - 1]}`;
        }
      }
    }
    return dia.toString();
  };

  // Obtener rango de fechas para el subtítulo
  const rangoFechas = useMemo(() => {
    if (tendenciaDiaria.length === 0) return '';
    const primera = tendenciaDiaria[0];
    const ultima = tendenciaDiaria[tendenciaDiaria.length - 1];
    const primeraLabel = formatFechaCorta(primera.fecha, primera.dia);
    const ultimaLabel = formatFechaCorta(ultima.fecha, ultima.dia);
    return `${primeraLabel} - ${ultimaLabel}`;
  }, [tendenciaDiaria]);

  // Configuración del gráfico de línea
  const lineChartOption = useMemo(() => {
    const dataCount = tendenciaDiaria.length;
    // Calcular intervalo dinámico para mostrar etiquetas legibles
    const labelInterval = dataCount > 20 ? Math.floor(dataCount / 10) : dataCount > 10 ? 1 : 0;

    return {
      grid: {
        top: 20,
        right: 15,
        bottom: dataCount > 15 ? 50 : 35,
        left: 40,
      },
      xAxis: {
        type: 'category',
        data: tendenciaDiaria.map((d) => formatFechaCorta(d.fecha, d.dia)),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 9,
          color: '#64748b',
          rotate: dataCount > 15 ? 45 : 0,
          interval: labelInterval,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          lineStyle: {
            color: '#f1f5f9',
            type: 'dashed',
          },
        },
        axisLabel: {
          fontSize: 10,
          color: '#64748b',
        },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        textStyle: {
          color: '#374151',
          fontSize: 11,
        },
        formatter: (params: { name: string; value: number }[]) => {
          if (!params.length) return '';
          return `<div style="font-weight:600">${params[0].name}</div>
                  <div>CNR: <b>${params[0].value}</b></div>`;
        },
      },
      dataZoom: dataCount > 30 ? [
        {
          type: 'inside',
          start: Math.max(0, 100 - (30 / dataCount) * 100),
          end: 100,
        },
        {
          type: 'slider',
          show: true,
          height: 20,
          bottom: 5,
          start: Math.max(0, 100 - (30 / dataCount) * 100),
          end: 100,
          handleSize: '100%',
          handleStyle: {
            color: '#475569',
          },
          textStyle: {
            fontSize: 9,
            color: '#64748b',
          },
          borderColor: '#e5e7eb',
          fillerColor: 'rgba(71, 85, 105, 0.1)',
        },
      ] : undefined,
      series: [
        {
          type: 'line',
          data: tendenciaDiaria.map((d) => d.cnr),
          smooth: true,
          symbol: 'circle',
          symbolSize: dataCount > 20 ? 4 : 6,
          lineStyle: {
            color: '#475569',
            width: 2,
          },
          itemStyle: {
            color: '#475569',
            borderColor: '#fff',
            borderWidth: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(71, 85, 105, 0.15)' },
                { offset: 1, color: 'rgba(71, 85, 105, 0)' },
              ],
            },
          },
        },
      ],
    };
  }, [tendenciaDiaria]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">KWH Recuperado</p>
          <p className="text-2xl font-bold text-slate-800">{formatKWH(totalKWH)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Total del período</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total CNR</p>
          <p className="text-2xl font-bold text-slate-800">{totales.totalCNR.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">Consumos no registrados</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total Efectivas</p>
          <p className="text-2xl font-bold text-slate-800">{totales.totalEfectivas.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">CNR + Normal</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Promedio/Técnico</p>
          <p className="text-2xl font-bold text-slate-800">{formatKWH(totales.promedioKWH)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{tecnicos.length} técnicos activos</p>
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ranking de técnicos */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Top 10 Técnicos por KWH
            </h3>
            <span className="text-[10px] text-slate-400">Ordenado por KWH estimado</span>
          </div>

          <div className="space-y-3">
            {topTecnicos.map((t, idx) => {
              const pct = ((t.kwh_estimado || 0) / maxKWH) * 100;
              return (
                <div key={`${t.zona}-${t.nombre}`} className="flex items-center gap-3">
                  <span className="w-5 text-[11px] text-slate-400 text-right">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-slate-700 truncate">{t.nombre}</span>
                      <span className="text-[11px] font-semibold text-slate-800 ml-2">
                        {formatKWH(t.kwh_estimado || 0)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 w-20 text-right truncate">{t.zona}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resumen por Zona */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            KWH por Zona
          </h3>
          <div className="space-y-3">
            {tecnicosPorZona.map(({ zona, totalKWH: zonaKWH, totalCNR, tecnicos: zonaTecnicos }) => {
              const maxZonaKWH = Math.max(...tecnicosPorZona.map((z) => z.totalKWH), 1);
              const pct = (zonaKWH / maxZonaKWH) * 100;
              return (
                <div key={zona}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-slate-700">{zona}</span>
                    <span className="text-[11px] font-semibold text-slate-800">{formatKWH(zonaKWH)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-slate-600 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{zonaTecnicos.length} técnicos</span>
                    <span>{totalCNR} CNR</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tendencia y detalle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tendencia Diaria - Line Chart */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tendencia Diaria CNR
              </h3>
              {rangoFechas && (
                <p className="text-[10px] text-slate-400 mt-0.5">{rangoFechas} · {tendenciaDiaria.length} días</p>
              )}
            </div>
          </div>

          {tendenciaDiaria.length > 0 ? (
            <ReactECharts
              option={lineChartOption}
              style={{ height: tendenciaDiaria.length > 30 ? '280px' : '220px', width: '100%' }}
              notMerge={true}
            />
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-[11px] text-slate-400">Sin datos disponibles</p>
            </div>
          )}
        </div>

        {/* Detalle por Zona - Todos los técnicos */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Detalle por Zona
          </h3>
          <div className="max-h-[280px] overflow-y-auto space-y-3">
            {tecnicosPorZona.map(({ zona, tecnicos: zonaTecnicos, totalKWH: zonaKWH }) => (
              <div key={zona} className="border border-slate-100 rounded overflow-hidden">
                <div className="bg-slate-800 text-white px-3 py-2 flex justify-between items-center">
                  <span className="text-[11px] font-medium">{zona}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-300">{zonaTecnicos.length} téc.</span>
                    <span className="text-[11px] font-semibold">{formatKWH(zonaKWH)}</span>
                  </div>
                </div>
                <div className="divide-y divide-slate-50 max-h-[150px] overflow-y-auto">
                  {zonaTecnicos.map((t) => (
                    <div key={t.nombre} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50/80">
                      <span className="text-[10px] text-slate-600 truncate flex-1">{t.nombre}</span>
                      <div className="flex items-center gap-3 ml-2">
                        <span className="text-[9px] text-slate-400">{t.cnr} CNR</span>
                        <span className="text-[10px] font-medium text-slate-700 w-12 text-right">
                          {formatKWH(t.kwh_estimado || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla completa */}
      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Todos los Técnicos
          </h3>
          <span className="text-[10px] text-slate-400">{tecnicos.length} registros</span>
        </div>

        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Zona</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Técnico</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Días</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">CNR</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Efectivas</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">% Efect.</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">KWH</th>
              </tr>
            </thead>
            <tbody className="text-[11px]">
              {tecnicos.map((t, idx) => (
                <tr key={`${t.zona}-${t.nombre}-${idx}`} className="border-b border-slate-50 hover:bg-slate-50/80">
                  <td className="px-3 py-2 text-slate-500">{t.zona}</td>
                  <td className="px-3 py-2 text-slate-700">{t.nombre}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{t.dias_trabajados}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-medium ${t.cnr >= 10 ? 'text-green-600' : 'text-slate-600'}`}>
                      {t.cnr}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{t.efectivas}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={
                      t.pct_efectivas >= 70 ? 'text-green-600' :
                      t.pct_efectivas >= 50 ? 'text-amber-600' :
                      'text-red-600'
                    }>
                      {t.pct_efectivas.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-800">
                    {formatKWH(t.kwh_estimado || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
