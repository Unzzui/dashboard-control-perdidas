'use client';

import { useMemo } from 'react';
import DataTable from '@/components/ui/DataTable';
import GaugeChart from '@/components/charts/GaugeChart';

interface KWHData {
  nombre: string;
  tipo_cnr: string;
  valores: { [dia: string]: number };
  total: number;
}

interface ControlKWHProps {
  data: KWHData[];
  totalKWH: number;
  pctKWHZona: number;
  efectivasPorTecnico: { nombre: string; valores: { [dia: string]: number }; total: number }[];
}

export default function ControlKWH({ data, totalKWH, pctKWHZona, efectivasPorTecnico }: ControlKWHProps) {
  // Memoizar días únicos
  const days = useMemo(() => {
    const allDays = new Set<string>();
    data.forEach((d) => Object.keys(d.valores).forEach((k) => allDays.add(k)));
    return Array.from(allDays).sort((a, b) => Number(a) - Number(b));
  }, [data]);

  const columns = useMemo(() => [
    { key: 'nombre', header: 'Nombre asignado', width: '220px' },
    ...days.map((day) => ({
      key: `day_${day}`,
      header: day,
      align: 'right' as const,
      render: (row: KWHData) => {
        const value = row.valores[day];
        return value ? value.toLocaleString('es-CL') : '';
      },
    })),
    {
      key: 'total',
      header: 'Total',
      align: 'right' as const,
      render: (row: KWHData) => (
        <span className="font-semibold">{row.total.toLocaleString('es-CL')}</span>
      ),
    },
  ], [days]);

  const efectivasColumns = useMemo(() => [
    { key: 'nombre', header: 'Nombre asignado', width: '220px' },
    ...days.map((day) => ({
      key: `day_${day}`,
      header: day,
      align: 'right' as const,
      render: (row: { nombre: string; valores: { [dia: string]: number }; total: number }) => {
        const value = row.valores[day];
        if (!value) return '';
        const meta = 10;
        const isGood = value >= meta;
        return (
          <span className={`font-medium ${isGood ? 'text-green-600' : value >= meta * 0.7 ? 'text-yellow-600' : 'text-red-600'}`}>
            {value}
          </span>
        );
      },
    })),
    {
      key: 'total',
      header: 'Total',
      align: 'right' as const,
      render: (row: { total: number }) => (
        <span className="font-semibold">{row.total.toLocaleString('es-CL')}</span>
      ),
    },
  ], [days]);

  // Memoizar agrupación por técnico y tipo CNR
  const grouped = useMemo(() => data.reduce((acc, d) => {
    if (!acc[d.nombre]) {
      acc[d.nombre] = { nombre: d.nombre, items: [], total: 0 };
    }
    acc[d.nombre].items.push(d);
    acc[d.nombre].total += d.total;
    return acc;
  }, {} as Record<string, { nombre: string; items: KWHData[]; total: number }>), [data]);

  return (
    <div className="space-y-6">
      {/* KWH Table */}
      <div className="card">
        <h3 className="section-title mb-3">Control KW/H Recuperado por Brigada</h3>
        <div className="overflow-x-auto">
          <DataTable columns={columns} data={data} />
        </div>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="section-title mb-3">kWh Total Recuperado</h3>
          <div className="text-center">
            <p className="text-4xl font-bold text-oca-blue">
              {totalKWH >= 1000 ? `${(totalKWH / 1000).toFixed(0)} mil` : totalKWH.toLocaleString('es-CL')}
            </p>
            <div className="mt-4 flex justify-center gap-8 text-sm text-slate-400">
              <span>0 mil</span>
              <span>153 mil</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title mb-3">% kWh Recuperado del Total por Zona</h3>
          <GaugeChart
            value={pctKWHZona}
            title="% kWh"
            color="blue"
          />
        </div>
      </div>

      {/* Efectivas Table */}
      <div className="card">
        <h3 className="section-title mb-3">EFECTIVAS por Técnico</h3>
        <div className="overflow-x-auto">
          <DataTable columns={efectivasColumns} data={efectivasPorTecnico} />
        </div>
      </div>
    </div>
  );
}
