'use client';

import { VisitaFallidaResponsabilidad } from '@/types';
import DataTable from '@/components/ui/DataTable';
import DonutChart from '@/components/charts/DonutChart';
import HorizontalBarChart from '@/components/charts/HorizontalBarChart';

interface VisitasFallidasProps {
  responsabilidad: VisitaFallidaResponsabilidad[];
  totalCGE: number;
  totalContratista: number;
  resultadosFallidos: { resultado: string; cantidad: number }[];
}

export default function VisitasFallidas({
  responsabilidad,
  totalCGE,
  totalContratista,
  resultadosFallidos,
}: VisitasFallidasProps) {
  const columns = [
    { key: 'descripcion', header: 'Descripción del aviso', width: '280px' },
    {
      key: 'responsabilidad_cge',
      header: 'Responsabilidad CGE Q',
      align: 'right' as const,
      render: (row: VisitaFallidaResponsabilidad) =>
        row.responsabilidad_cge > 0 ? row.responsabilidad_cge.toLocaleString('es-CL') : '',
    },
    {
      key: 'pct_cge',
      header: '%',
      align: 'right' as const,
      render: (row: VisitaFallidaResponsabilidad) =>
        row.pct_cge > 0 ? `${row.pct_cge.toFixed(2)}%` : '',
    },
    {
      key: 'responsabilidad_contratista',
      header: 'Responsabilidad Contratista Q',
      align: 'right' as const,
      render: (row: VisitaFallidaResponsabilidad) =>
        row.responsabilidad_contratista > 0 ? row.responsabilidad_contratista.toLocaleString('es-CL') : '',
    },
    {
      key: 'pct_contratista',
      header: '%',
      align: 'right' as const,
      render: (row: VisitaFallidaResponsabilidad) =>
        row.pct_contratista > 0 ? `${row.pct_contratista.toFixed(2)}%` : '',
    },
    {
      key: 'total',
      header: 'Total Q',
      align: 'right' as const,
      render: (row: VisitaFallidaResponsabilidad) => (
        <span className="font-semibold">{row.total.toLocaleString('es-CL')}</span>
      ),
    },
  ];

  const donutData = [
    { name: 'Responsabilidad Contratista', value: totalContratista },
    { name: 'Responsabilidad CGE', value: totalCGE },
  ];

  const barData = resultadosFallidos.map((r) => ({
    name: r.resultado,
    value: r.cantidad,
  }));

  return (
    <div className="space-y-6">
      {/* Table and Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Responsibility Table */}
        <div className="card lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Visitas Fallidas por Delegación</h3>
          <div className="max-h-[400px] overflow-y-auto">
            <DataTable columns={columns} data={responsabilidad.slice(0, 20)} />
          </div>
        </div>

        {/* Donut Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Responsabilidad Visitas Fallidas</h3>
          <DonutChart
            data={donutData}
            colors={['#294D6D', '#DE473C']}
          />
        </div>
      </div>

      {/* Results Bar Chart */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Tipos de Resultados</h3>
        <HorizontalBarChart
          data={barData.slice(0, 15)}
          valueLabel="VISITA FALLIDA"
          color="#DE473C"
        />
      </div>
    </div>
  );
}
