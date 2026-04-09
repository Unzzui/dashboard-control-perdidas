'use client';

import { ProduccionZona, TecnicoRanking } from '@/types';
import DataTable from '@/components/ui/DataTable';
import HorizontalBarChart from '@/components/charts/HorizontalBarChart';

interface ProduccionMensualProps {
  produccion: ProduccionZona[];
  produccionTecnicos: { zona: string; nombre: string; produccion: number }[];
}

export default function ProduccionMensual({ produccion, produccionTecnicos }: ProduccionMensualProps) {
  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('es-CL')}`;
  };

  const columns = [
    { key: 'zona', header: 'Zona', width: '200px' },
    {
      key: 'brigadas_activas',
      header: 'Brigadas Activas',
      align: 'right' as const,
    },
    {
      key: 'meta_produccion',
      header: 'Meta Producción',
      align: 'right' as const,
      render: (row: ProduccionZona) => formatCurrency(row.meta_produccion),
    },
    {
      key: 'produccion',
      header: 'Producción',
      align: 'right' as const,
      render: (row: ProduccionZona) => (
        <span className="font-semibold text-oca-blue">{formatCurrency(row.produccion)}</span>
      ),
    },
    {
      key: 'pct_produccion',
      header: '% Producción',
      align: 'right' as const,
      render: (row: ProduccionZona) => {
        const isGood = row.pct_produccion >= 20;
        return (
          <span className={`flex items-center justify-end gap-1 ${isGood ? 'text-green-600' : 'text-red-500'}`}>
            {row.pct_produccion.toFixed(0)}%
            {isGood ? (
              <span className="text-green-500">✓</span>
            ) : (
              <span className="text-red-500">✗</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'cnr',
      header: 'CNR',
      align: 'right' as const,
    },
    {
      key: 'monto_cnr',
      header: 'MONTO_CNR',
      align: 'right' as const,
      render: (row: ProduccionZona) => formatCurrency(row.monto_cnr),
    },
    {
      key: 'promedio_monto_cnr',
      header: 'PROMEDIO_MONTO_CNR',
      align: 'right' as const,
      render: (row: ProduccionZona) => formatCurrency(row.promedio_monto_cnr),
    },
  ];

  // Prepare chart data
  const chartData = produccion.map((p) => ({
    name: p.zona,
    value: p.produccion,
    meta: p.meta_produccion,
  }));

  // Group production by zona for detail
  const byZona = produccionTecnicos.reduce((acc, t) => {
    if (!acc[t.zona]) acc[t.zona] = [];
    acc[t.zona].push(t);
    return acc;
  }, {} as Record<string, typeof produccionTecnicos>);

  return (
    <div className="space-y-6">
      {/* Summary Table */}
      <div className="card">
        <h3 className="section-title mb-3">Cumplimiento por Establecimiento</h3>
        <DataTable columns={columns} data={produccion} />
      </div>

      {/* Chart */}
      <div className="card">
        <h3 className="section-title mb-3">Cumplimiento por Establecimiento</h3>
        <HorizontalBarChart
          data={chartData}
          valueLabel="Suma de Valor Unitario"
          metaLabel="Meta"
          color="#294D6D"
          metaColor="#E5E7EB"
        />
      </div>

      {/* Production by Technician */}
      <div className="card">
        <h3 className="section-title mb-3">Producción Mensual</h3>
        <div className="max-h-[500px] overflow-y-auto">
          {Object.entries(byZona).map(([zona, tecnicos]) => (
            <div key={zona} className="mb-4">
              <div className="flex justify-between items-center bg-oca-blue-lighter px-3 py-2 rounded mb-2">
                <h4 className="text-xs font-semibold text-oca-blue uppercase">{zona}</h4>
                <span className="text-sm font-semibold text-oca-blue">
                  {formatCurrency(tecnicos.reduce((acc, t) => acc + t.produccion, 0))}
                </span>
              </div>
              <div className="space-y-1 px-3">
                {tecnicos.map((t, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-1 border-b border-gray-50">
                    <span className="text-slate-500">{t.nombre}</span>
                    <span className="font-medium">{formatCurrency(t.produccion)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
