'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { Filters, AtrasoZona, ResponsableRetiro, RetiroDiario } from '@/types';
import DataTable from '@/components/ui/DataTable';
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

  const atrasoColumns = [
    { key: 'zona', header: 'Zona', width: '220px' },
    {
      key: 'dentro_plazo',
      header: 'Dentro de plazo',
      align: 'right' as const,
      render: (row: AtrasoZona) => row.dentro_plazo.toLocaleString('es-CL'),
    },
    {
      key: 'entre_3_7',
      header: 'Entre 03-07 dias',
      align: 'right' as const,
      render: (row: AtrasoZona) => row.entre_3_7.toLocaleString('es-CL'),
    },
    {
      key: 'mas_7',
      header: '+7 dias',
      align: 'right' as const,
      render: (row: AtrasoZona) => row.mas_7.toLocaleString('es-CL'),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right' as const,
      render: (row: AtrasoZona) => (
        <span className="font-semibold">{row.total.toLocaleString('es-CL')}</span>
      ),
    },
  ];

  const respColumns = [
    { key: 'zona', header: 'Zona', width: '200px' },
    {
      key: 'aviso',
      header: 'N° Aviso',
      align: 'right' as const,
      render: (row: ResponsableRetiro) => row.aviso.toLocaleString('es-CL'),
    },
    { key: 'tecnico', header: 'Tecnico', width: '240px' },
    { key: 'estado_envio', header: 'Estado envio' },
    { key: 'control_atraso', header: 'Control atraso' },
    {
      key: 'dias_atraso',
      header: 'Dias atraso',
      align: 'right' as const,
      render: (row: ResponsableRetiro) => row.dias_atraso.toFixed(0),
    },
  ];

  const chartOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#fff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '5%',
      top: '5%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: retiroDiario.map((r) => r.dia),
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10 },
    },
    series: [
      {
        name: 'Cantidad',
        type: 'bar',
        data: retiroDiario.map((r) => r.cantidad),
        itemStyle: { color: '#294D6D' },
        label: {
          show: retiroDiario.length <= 15,
          position: 'top',
          fontSize: 10,
          color: '#374151',
        },
      },
    ],
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oca-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Daily Retiro Chart */}
      {retiroDiario.length > 0 && (
        <div className="card">
          <h3 className="section-title mb-3">Fecha de retiro del medidor de terreno</h3>
          <ReactECharts
            option={chartOption}
            style={{ height: '300px', width: '100%' }}
            notMerge={true}
          />
        </div>
      )}

      {/* Atraso por Zona */}
      <div className="card">
        <h3 className="section-title mb-3">Dias de atraso en el envio</h3>
        <DataTable columns={atrasoColumns} data={atrasoZona} />
      </div>

      {/* Responsables */}
      <div className="card">
        <h3 className="section-title mb-3">Responsable del retiro del medidor</h3>
        <DataTable columns={respColumns} data={responsables} />
      </div>
    </div>
  );
}
