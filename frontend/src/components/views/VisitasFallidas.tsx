'use client';

import { useMemo } from 'react';
import { VisitaFallidaResponsabilidad, ResultadoFallido } from '@/types';
import DataTable from '@/components/ui/DataTable';
import DonutChart from '@/components/charts/DonutChart';
import HorizontalBarChart from '@/components/charts/HorizontalBarChart';

interface VisitasFallidasProps {
  responsabilidad: VisitaFallidaResponsabilidad[];
  totalCGE: number;
  totalContratista: number;
  resultadosFallidos: ResultadoFallido[];
}

export default function VisitasFallidas({
  responsabilidad,
  totalCGE,
  totalContratista,
  resultadosFallidos,
}: VisitasFallidasProps) {
  const columns = useMemo(() => [
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
  ], []);

  const donutData = useMemo(() => [
    { name: 'Responsabilidad Contratista', value: totalContratista },
    { name: 'Responsabilidad CGE', value: totalCGE },
  ], [totalContratista, totalCGE]);

  const barData = useMemo(() => resultadosFallidos.map((r) => ({
    name: r.resultado,
    value: r.cantidad,
  })), [resultadosFallidos]);

  const limitedResponsabilidad = useMemo(() => responsabilidad.slice(0, 20), [responsabilidad]);
  const limitedBarData = useMemo(() => barData.slice(0, 15), [barData]);

  return (
    <div className="space-y-6">
      {/* Table and Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Responsibility Table */}
        <div className="card lg:col-span-2">
          <h3 className="section-title mb-3">Visitas Fallidas por Delegación</h3>
          <div className="max-h-[400px] overflow-y-auto">
            <DataTable columns={columns} data={limitedResponsabilidad} />
          </div>
        </div>

        {/* Donut Chart */}
        <div className="card">
          <h3 className="section-title mb-3">Responsabilidad Visitas Fallidas</h3>
          <DonutChart
            data={donutData}
            colors={['#294D6D', '#DE473C']}
          />
        </div>
      </div>

      {/* Results Bar Chart */}
      <div className="card">
        <h3 className="section-title mb-3">Tipos de Resultados</h3>
        <HorizontalBarChart
          data={limitedBarData}
          valueLabel="VISITA FALLIDA"
          color="#DE473C"
        />
      </div>
    </div>
  );
}
