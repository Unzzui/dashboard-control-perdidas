'use client';

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
  // Get unique days
  const allDays = new Set<string>();
  data.forEach((d) => Object.keys(d.valores).forEach((k) => allDays.add(k)));
  const days = Array.from(allDays).sort((a, b) => Number(a) - Number(b));

  const columns = [
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
  ];

  const efectivasColumns = [
    { key: 'nombre', header: 'Nombre asignado', width: '220px' },
    ...days.map((day) => ({
      key: `day_${day}`,
      header: day,
      align: 'right' as const,
      render: (row: { nombre: string; valores: { [dia: string]: number }; total: number }) => {
        const value = row.valores[day];
        if (!value) return '';
        // Show with status indicator
        const meta = 10; // Daily meta
        const isGood = value >= meta;
        return (
          <span className={`flex items-center justify-end gap-1 ${isGood ? 'text-green-600' : value >= meta * 0.7 ? 'text-yellow-500' : 'text-red-500'}`}>
            {value}
            <span className={`w-2 h-2 rounded-full ${isGood ? 'bg-green-500' : value >= meta * 0.7 ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
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
  ];

  // Group by technician and CNR type
  const grouped = data.reduce((acc, d) => {
    if (!acc[d.nombre]) {
      acc[d.nombre] = { nombre: d.nombre, items: [], total: 0 };
    }
    acc[d.nombre].items.push(d);
    acc[d.nombre].total += d.total;
    return acc;
  }, {} as Record<string, { nombre: string; items: KWHData[]; total: number }>);

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
