'use client';

import { useMemo, useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Filters, CierreActividades, DailyStats } from '@/types';
import { getControlDiario } from '@/lib/api';

interface AnalisisJornadaProps {
  filters: Filters;
  daily: DailyStats[];
}

export default function AnalisisJornadaDiario({
  filters,
  daily
}: AnalisisJornadaProps) {
  const [cierreActividades, setCierreActividades] = useState<CierreActividades[]>([]);
  const [fechaReporte, setFechaReporte] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch cierre_actividades desde control-diario
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getControlDiario(filters);
        setCierreActividades(data.cierre_actividades || []);
        setFechaReporte(data.fecha_reporte || '');
      } catch (err) {
        console.error('Error fetching cierre actividades:', err);
        setError('No se pudo cargar los datos de jornada');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [filters]);

  // Parsear hora de string "HH:MM" a minutos desde medianoche
  const parseHora = (hora: string): number => {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  // Calcular duración en minutos desde strings de hora
  const calcularDuracion = (inicio: string, fin: string): number => {
    const inicioMin = parseHora(inicio);
    const finMin = parseHora(fin);
    return finMin >= inicioMin ? finMin - inicioMin : (24 * 60 - inicioMin) + finMin;
  };

  // Formatear minutos a "Xh Ym"
  const formatDuracion = (minutos: number): string => {
    const horas = Math.floor(minutos / 60);
    const mins = Math.round(minutos % 60);
    return `${horas}h ${mins}m`;
  };

  // Procesar jornadas
  const jornadas = useMemo(() => {
    return cierreActividades.map(c => {
      const duracion = calcularDuracion(c.primera_actividad, c.ultima_actividad);
      const productividad = duracion > 0 ? (c.total_actividades / (duracion / 60)) : 0;

      return {
        ...c,
        duracion_minutos: duracion,
        productividad_hora: productividad,
      };
    });
  }, [cierreActividades]);

  // Estadísticas generales
  const stats = useMemo(() => {
    if (jornadas.length === 0) {
      return {
        duracion_promedio: 0,
        productividad_promedio: 0,
        tecnicos_jornada_corta: 0,
        hora_inicio_promedio: '00:00',
        hora_fin_promedio: '00:00',
      };
    }

    const duracionTotal = jornadas.reduce((acc, j) => acc + j.duracion_minutos, 0);
    const productividadTotal = jornadas.reduce((acc, j) => acc + j.productividad_hora, 0);
    const jornadasCortas = jornadas.filter(j => j.duracion_minutos < 360).length;

    // Hora inicio promedio
    const iniciosMin = jornadas.map(j => parseHora(j.primera_actividad));
    const inicioPromedio = iniciosMin.reduce((a, b) => a + b, 0) / iniciosMin.length;
    const horaInicioProm = `${Math.floor(inicioPromedio / 60).toString().padStart(2, '0')}:${Math.round(inicioPromedio % 60).toString().padStart(2, '0')}`;

    // Hora fin promedio
    const finesMin = jornadas.map(j => parseHora(j.ultima_actividad));
    const finPromedio = finesMin.reduce((a, b) => a + b, 0) / finesMin.length;
    const horaFinProm = `${Math.floor(finPromedio / 60).toString().padStart(2, '0')}:${Math.round(finPromedio % 60).toString().padStart(2, '0')}`;

    return {
      duracion_promedio: duracionTotal / jornadas.length,
      productividad_promedio: productividadTotal / jornadas.length,
      tecnicos_jornada_corta: jornadasCortas,
      hora_inicio_promedio: horaInicioProm,
      hora_fin_promedio: horaFinProm,
    };
  }, [jornadas]);

  // Jornadas cortas (< 6 horas)
  const jornadasCortas = useMemo(() => {
    return jornadas
      .filter(j => j.duracion_minutos < 360)
      .sort((a, b) => a.duracion_minutos - b.duracion_minutos);
  }, [jornadas]);

  // Jornadas por zona con estadísticas
  const porZona = useMemo(() => {
    const grupos: Record<string, typeof jornadas> = {};
    jornadas.forEach(j => {
      if (!grupos[j.zona]) grupos[j.zona] = [];
      grupos[j.zona].push(j);
    });

    return Object.entries(grupos).map(([zona, items]) => {
      const duracionProm = items.reduce((a, j) => a + j.duracion_minutos, 0) / items.length;
      const productividadProm = items.reduce((a, j) => a + j.productividad_hora, 0) / items.length;
      const actividadesTotal = items.reduce((a, j) => a + j.total_actividades, 0);

      return {
        zona,
        tecnicos: items.length,
        duracion_promedio: duracionProm,
        productividad_promedio: productividadProm,
        actividades_total: actividadesTotal,
      };
    }).sort((a, b) => b.productividad_promedio - a.productividad_promedio);
  }, [jornadas]);

  // Distribución de inicio de jornada por hora
  const distribucionInicio = useMemo(() => {
    const horas: Record<number, number> = {};
    for (let i = 6; i <= 20; i++) horas[i] = 0;

    jornadas.forEach(j => {
      const hora = Math.floor(parseHora(j.primera_actividad) / 60);
      if (horas[hora] !== undefined) horas[hora]++;
    });

    return Object.entries(horas).map(([hora, cantidad]) => ({
      hora: parseInt(hora),
      cantidad,
    }));
  }, [jornadas]);

  // Distribución de fin de jornada por hora
  const distribucionFin = useMemo(() => {
    const horas: Record<number, number> = {};
    for (let i = 10; i <= 22; i++) horas[i] = 0;

    jornadas.forEach(j => {
      const hora = Math.floor(parseHora(j.ultima_actividad) / 60);
      if (horas[hora] !== undefined) horas[hora]++;
    });

    return Object.entries(horas).map(([hora, cantidad]) => ({
      hora: parseInt(hora),
      cantidad,
    }));
  }, [jornadas]);

  // Gráfico de distribución de inicio
  const distribucionInicioOption = useMemo(() => ({
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
      right: '4%',
      bottom: '5%',
      top: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: distribucionInicio.map(d => `${d.hora}:00`),
      axisLabel: { fontSize: 10, color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, color: '#64748b' },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    series: [{
      type: 'bar',
      data: distribucionInicio.map(d => ({
        value: d.cantidad,
        itemStyle: {
          color: d.hora < 8 ? '#16a34a' : d.hora > 10 ? '#f59e0b' : '#475569',
          borderRadius: [4, 4, 0, 0],
        },
      })),
      barWidth: '60%',
    }],
  }), [distribucionInicio]);

  // Gráfico de distribución de fin
  const distribucionFinOption = useMemo(() => ({
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
      right: '4%',
      bottom: '5%',
      top: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: distribucionFin.map(d => `${d.hora}:00`),
      axisLabel: { fontSize: 10, color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, color: '#64748b' },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    series: [{
      type: 'bar',
      data: distribucionFin.map(d => ({
        value: d.cantidad,
        itemStyle: {
          color: d.hora >= 18 ? '#16a34a' : d.hora < 16 ? '#f59e0b' : '#475569',
          borderRadius: [4, 4, 0, 0],
        },
      })),
      barWidth: '60%',
    }],
  }), [distribucionFin]);

  // Gráfico de productividad por zona
  const productividadZonaOption = useMemo(() => {
    const top10 = porZona.slice(0, 10);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#334155', fontSize: 11 },
        formatter: (params: { name: string; value: number }[]) => {
          const zona = top10.find(z => z.zona === params[0].name);
          return `<div style="font-weight:600">${params[0].name}</div>
                  <div>Productividad: <b>${params[0].value.toFixed(1)}</b> act/hora</div>
                  <div>Técnicos: ${zona?.tecnicos || 0}</div>
                  <div>Duración prom: ${formatDuracion(zona?.duracion_promedio || 0)}</div>`;
        },
      },
      grid: {
        left: '3%',
        right: '15%',
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
      series: [{
        type: 'bar',
        data: top10.map(z => ({
          value: z.productividad_promedio,
          itemStyle: { color: '#475569', borderRadius: [0, 4, 4, 0] },
        })).reverse(),
        barWidth: '60%',
        label: {
          show: true,
          position: 'right',
          fontSize: 10,
          formatter: (params: { value: number }) => `${params.value.toFixed(1)}/h`,
        },
      }],
    };
  }, [porZona]);

  // Actividad diaria
  const actividadDiariaOption = useMemo(() => {
    const dailyOrdenado = [...daily].sort((a, b) => {
      return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
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
        data: dailyOrdenado.map(d => `${d.dia}`),
        axisLabel: { fontSize: 10, color: '#64748b' },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [
        {
          name: 'CNR',
          type: 'line',
          data: dailyOrdenado.map(d => d.cnr),
          smooth: true,
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
          name: 'V. Fallida',
          type: 'line',
          data: dailyOrdenado.map(d => d.visita_fallida),
          smooth: true,
          lineStyle: { color: '#f59e0b', width: 2 },
          itemStyle: { color: '#f59e0b' },
        },
      ],
    };
  }, [daily]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oca-blue"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <p className="text-[10px] text-slate-300">Intenta seleccionar otro período</p>
        </div>
      </div>
    );
  }

  if (cierreActividades.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-slate-400 mb-2">No hay datos de jornada disponibles</p>
          <p className="text-[10px] text-slate-300">Esta vista requiere datos de Control Diario</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Subhead específico del día */}
      <p className="text-xs text-slate-500">
        {fechaReporte && <span className="font-medium text-slate-700">{fechaReporte}</span>}
        {fechaReporte && ' · '}
        {jornadas.length} técnicos analizados
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Duración Promedio</p>
          <p className="text-2xl font-bold text-slate-800">{formatDuracion(stats.duracion_promedio)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Jornada laboral</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Hora Inicio Prom.</p>
          <p className="text-2xl font-bold text-slate-800">{stats.hora_inicio_promedio}</p>
          <p className="text-[10px] text-slate-400 mt-1">Primera actividad</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Hora Fin Prom.</p>
          <p className="text-2xl font-bold text-slate-800">{stats.hora_fin_promedio}</p>
          <p className="text-[10px] text-slate-400 mt-1">Última actividad</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Jornadas Cortas</p>
          <p className={`text-2xl font-bold ${stats.tecnicos_jornada_corta > 5 ? 'text-red-600' : 'text-slate-800'}`}>
            {stats.tecnicos_jornada_corta}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">{'<'} 6 horas</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Productividad/Hora</p>
          <p className="text-2xl font-bold text-slate-800">{stats.productividad_promedio.toFixed(1)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Actividades promedio</p>
        </div>
      </div>

      {/* Distribución Horaria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribución hora inicio */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Distribución Hora de Inicio
          </h3>
          <p className="text-[10px] text-slate-400 mb-2">
            <span className="inline-block w-2 h-2 bg-green-500 rounded mr-1"></span> Antes 8:00
            <span className="inline-block w-2 h-2 bg-slate-500 rounded ml-3 mr-1"></span> 8:00-10:00
            <span className="inline-block w-2 h-2 bg-amber-500 rounded ml-3 mr-1"></span> Después 10:00
          </p>
          <ReactECharts
            option={distribucionInicioOption}
            style={{ height: '240px', width: '100%' }}
            notMerge={true}
          />
        </div>

        {/* Distribución hora fin */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Distribución Hora de Fin
          </h3>
          <p className="text-[10px] text-slate-400 mb-2">
            <span className="inline-block w-2 h-2 bg-amber-500 rounded mr-1"></span> Antes 16:00
            <span className="inline-block w-2 h-2 bg-slate-500 rounded ml-3 mr-1"></span> 16:00-18:00
            <span className="inline-block w-2 h-2 bg-green-500 rounded ml-3 mr-1"></span> Después 18:00
          </p>
          <ReactECharts
            option={distribucionFinOption}
            style={{ height: '240px', width: '100%' }}
            notMerge={true}
          />
        </div>
      </div>

      {/* Productividad por Zona */}
      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
          Productividad por Zona
        </h3>
        <ReactECharts
          option={productividadZonaOption}
          style={{ height: '300px', width: '100%' }}
          notMerge={true}
        />
      </div>

      {/* Actividad diaria y Jornadas cortas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Actividad diaria */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4 lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Tendencia Diaria
          </h3>
          <ReactECharts
            option={actividadDiariaOption}
            style={{ height: '280px', width: '100%' }}
            notMerge={true}
          />
        </div>

        {/* Jornadas Cortas */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-red-600">
              Jornadas Cortas ({'<'} 6h)
            </h3>
            {fechaReporte && (
              <span className="text-[9px] text-slate-400">{fechaReporte}</span>
            )}
          </div>
          {jornadasCortas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <span className="text-green-600 text-xl font-bold">✓</span>
              </div>
              <p className="text-green-700 font-medium">Sin alertas</p>
              <p className="text-[10px] text-slate-400 mt-1">Todas las jornadas superan 6 horas</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {jornadasCortas.slice(0, 15).map((j, idx) => (
                <div key={idx} className="p-2 bg-red-50 rounded border border-red-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-red-700 truncate">{j.tecnico}</span>
                    <span className="text-[10px] font-bold text-red-600">{formatDuracion(j.duracion_minutos)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-red-600">
                    <span>{j.zona}</span>
                    <span>{j.primera_actividad} - {j.ultima_actividad}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla detallada de jornadas */}
      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Detalle de Jornadas
            </h3>
            {fechaReporte && (
              <p className="text-[10px] text-slate-400 mt-0.5">{fechaReporte}</p>
            )}
          </div>
          <span className="text-[10px] text-slate-400">{jornadas.length} técnicos</span>
        </div>
        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2 text-left text-[9px] font-semibold uppercase text-slate-500">Técnico</th>
                <th className="px-2 py-2 text-left text-[9px] font-semibold uppercase text-slate-500">Zona</th>
                <th className="px-2 py-2 text-center text-[9px] font-semibold uppercase text-slate-500">Inicio</th>
                <th className="px-2 py-2 text-center text-[9px] font-semibold uppercase text-slate-500">Fin</th>
                <th className="px-2 py-2 text-right text-[9px] font-semibold uppercase text-slate-500">Duración</th>
                <th className="px-2 py-2 text-right text-[9px] font-semibold uppercase text-slate-500">Actividades</th>
                <th className="px-2 py-2 text-right text-[9px] font-semibold uppercase text-slate-500">Prod/Hora</th>
              </tr>
            </thead>
            <tbody>
              {jornadas.map((j, idx) => {
                const esJornadaCorta = j.duracion_minutos < 360;
                const esBajaProductividad = j.productividad_hora < 5;
                return (
                  <tr
                    key={idx}
                    className={`border-b border-slate-50 hover:bg-slate-50 ${esJornadaCorta ? 'bg-red-50/50' : ''}`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-700 truncate max-w-[150px]" title={j.tecnico}>
                      {j.tecnico}
                    </td>
                    <td className="px-2 py-2 text-slate-600">{j.zona}</td>
                    <td className="px-2 py-2 text-center">
                      <span className="inline-block bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded">
                        {j.primera_actividad}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="inline-block bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded">
                        {j.ultima_actividad}
                      </span>
                    </td>
                    <td className={`px-2 py-2 text-right font-medium ${esJornadaCorta ? 'text-red-600' : 'text-slate-700'}`}>
                      {formatDuracion(j.duracion_minutos)}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-700">{j.total_actividades}</td>
                    <td className={`px-2 py-2 text-right font-medium ${esBajaProductividad ? 'text-red-600' : 'text-slate-700'}`}>
                      {j.productividad_hora.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
