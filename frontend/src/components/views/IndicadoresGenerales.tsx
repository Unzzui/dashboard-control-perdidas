'use client';

import { useMemo } from 'react';
import { ZonaStats, DailyStats, KPIData } from '@/types';
import KPICard from '@/components/ui/KPICard';
import DataTable from '@/components/ui/DataTable';
import StackedBarChart from '@/components/charts/StackedBarChart';
import DonutChart from '@/components/charts/DonutChart';

interface IndicadoresGeneralesProps {
  kpis: KPIData;
  zonas: ZonaStats[];
  daily: DailyStats[];
}

export default function IndicadoresGenerales({ kpis, zonas, daily }: IndicadoresGeneralesProps) {
  const columns = useMemo(() => [
    { key: 'zona', header: 'Zona', width: '200px' },
    {
      key: 'normal',
      header: 'NORMAL',
      align: 'right' as const,
      render: (row: ZonaStats) => row.normal.toLocaleString('es-CL'),
    },
    {
      key: 'cnr',
      header: 'CNR',
      align: 'right' as const,
      render: (row: ZonaStats) => row.cnr.toLocaleString('es-CL'),
    },
    {
      key: 'pct_cnr',
      header: '% CNR',
      align: 'right' as const,
      render: (row: ZonaStats) => (
        <span className="font-medium text-oca-blue">{row.pct_cnr.toFixed(2)}%</span>
      ),
    },
    {
      key: 'efectivas',
      header: 'EFECTIVAS',
      align: 'right' as const,
      render: (row: ZonaStats) => row.efectivas.toLocaleString('es-CL'),
    },
    {
      key: 'pct_efectivas',
      header: '% EFECT.',
      align: 'right' as const,
      render: (row: ZonaStats) => (
        <span className="text-green-600 font-medium">{row.pct_efectivas.toFixed(2)}%</span>
      ),
    },
    {
      key: 'visita_fallida',
      header: 'V. FALLIDA',
      align: 'right' as const,
      render: (row: ZonaStats) => row.visita_fallida.toLocaleString('es-CL'),
    },
    {
      key: 'pct_visita_fallida',
      header: '% V.F.',
      align: 'right' as const,
      render: (row: ZonaStats) => (
        <span className="text-orange-500">{row.pct_visita_fallida.toFixed(2)}%</span>
      ),
    },
  ], []);

  // Memoizar cálculo de totales
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

  // Memoizar datos del donut chart
  const donutData = useMemo(() => [
    { name: 'CNR', value: kpis.total_cnr },
    { name: 'Normal', value: kpis.total_normal },
    { name: 'Visita Fallida', value: kpis.total_visita_fallida },
  ], [kpis.total_cnr, kpis.total_normal, kpis.total_visita_fallida]);

  // Memoizar cálculos de promedio diario y mejor/peor día
  const { promedioDiario, mejorDia, diasTrabajados } = useMemo(() => {
    const prom = daily.length > 0 ? {
      cnr: Math.round(daily.reduce((acc, d) => acc + d.cnr, 0) / daily.length),
      normal: Math.round(daily.reduce((acc, d) => acc + d.normal, 0) / daily.length),
      visita_fallida: Math.round(daily.reduce((acc, d) => acc + d.visita_fallida, 0) / daily.length),
      total: Math.round(daily.reduce((acc, d) => acc + d.cnr + d.normal + d.visita_fallida, 0) / daily.length),
    } : { cnr: 0, normal: 0, visita_fallida: 0, total: 0 };

    const diasConTotal = daily.map(d => ({
      ...d,
      total: d.cnr + d.normal + d.visita_fallida,
      efectivas: d.cnr + d.normal,
    }));
    const mejor = diasConTotal.length > 0
      ? diasConTotal.reduce((best, d) => d.efectivas > best.efectivas ? d : best, diasConTotal[0])
      : null;
    const trabajados = daily.filter(d => (d.cnr + d.normal + d.visita_fallida) > 0).length;

    return { promedioDiario: prom, mejorDia: mejor, diasTrabajados: trabajados };
  }, [daily]);

  // Memoizar datos de la tabla
  const tableData = useMemo(() => [...zonas, totals], [zonas, totals]);

  return (
    <div className="space-y-6">
      {/* KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KPICard
          title="Total Registros"
          value={kpis.total_registros}
          color="gray"
        />
        <KPICard
          title="Normal"
          value={kpis.total_normal}
          subtitle={`${kpis.pct_efectivas.toFixed(2)}% efectivas`}
          color="blue"
        />
        <KPICard
          title="CNR"
          value={kpis.total_cnr}
          subtitle={`${kpis.pct_cnr.toFixed(2)}%`}
          color="blue"
        />
        <KPICard
          title="CNR Falla"
          value={kpis.cnr_falla}
          subtitle={`${kpis.pct_cnr_falla.toFixed(2)}%`}
          color="green"
        />
        <KPICard
          title="CNR Hurto"
          value={kpis.cnr_hurto}
          subtitle={`${kpis.pct_cnr_hurto.toFixed(2)}%`}
          color="red"
        />
        <KPICard
          title="Visita Fallida"
          value={kpis.total_visita_fallida}
          subtitle={`${kpis.pct_visita_fallida.toFixed(2)}%`}
          color="orange"
        />
      </div>

      {/* Resumen Operativo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-slate-50 to-slate-100">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Promedio Diario</p>
          <p className="text-2xl font-bold text-slate-700">{promedioDiario.total.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-500 mt-1">registros/día</p>
        </div>
        <div className="card bg-gradient-to-br from-green-50 to-green-100">
          <p className="text-[10px] uppercase tracking-wider text-green-600 mb-1">Efectivas Promedio</p>
          <p className="text-2xl font-bold text-green-700">{(promedioDiario.cnr + promedioDiario.normal).toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-green-600 mt-1">CNR + Normal/día</p>
        </div>
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
          <p className="text-[10px] uppercase tracking-wider text-blue-600 mb-1">Mejor Día</p>
          <p className="text-2xl font-bold text-blue-700">{mejorDia ? mejorDia.efectivas.toLocaleString('es-CL') : '-'}</p>
          <p className="text-[10px] text-blue-600 mt-1">{mejorDia ? `Día ${mejorDia.dia}` : ''} efectivas</p>
        </div>
        <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
          <p className="text-[10px] uppercase tracking-wider text-orange-600 mb-1">Días Trabajados</p>
          <p className="text-2xl font-bold text-orange-700">{diasTrabajados}</p>
          <p className="text-[10px] text-orange-600 mt-1">días con actividad</p>
        </div>
      </div>

      {/* Main Content - Tabla y Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Zona Table */}
        <div className="card lg:col-span-2">
          <h3 className="section-title mb-3">Resultados por Zona</h3>
          <DataTable columns={columns} data={tableData} />
        </div>

        {/* Donut Chart */}
        <div className="card">
          <h3 className="section-title mb-3">Distribución de Resultados</h3>
          <DonutChart
            data={donutData}
            colors={['#294D6D', '#4A7BA7', '#F97316']}
          />
        </div>
      </div>

      {/* Daily Chart - Gráfico principal más grande */}
      <div className="card">
        <h3 className="section-title mb-3">Actividad Diaria del Mes</h3>
        <StackedBarChart data={daily} height="350px" />
      </div>
    </div>
  );
}
