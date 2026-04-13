'use client';

import { useMemo, useCallback, useState } from 'react';
import { ProduccionZona } from '@/types';
import DataTable from '@/components/ui/DataTable';
import HorizontalBarChart from '@/components/charts/HorizontalBarChart';

interface ProduccionMensualProps {
  produccion: ProduccionZona[];
  produccionTecnicos: { zona: string; nombre: string; produccion: number }[];
}

export default function ProduccionMensual({ produccion, produccionTecnicos }: ProduccionMensualProps) {
  // Formato compacto para millones
  const formatCompact = useCallback((value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString('es-CL')}`;
  }, []);

  // Calcular totales
  const totales = useMemo(() => {
    const totalProduccion = produccion.reduce((acc, p) => acc + p.produccion, 0);
    const totalMeta = produccion.reduce((acc, p) => acc + p.meta_produccion, 0);
    const totalCNR = produccion.reduce((acc, p) => acc + p.cnr, 0);
    const totalMontoCNR = produccion.reduce((acc, p) => acc + p.monto_cnr, 0);
    const pctCumplimiento = totalMeta > 0 ? (totalProduccion / totalMeta) * 100 : 0;
    return { totalProduccion, totalMeta, totalCNR, totalMontoCNR, pctCumplimiento };
  }, [produccion]);

  const columns = useMemo(() => [
    { key: 'zona', header: 'Zona', width: '180px' },
    {
      key: 'brigadas_activas',
      header: 'Brigadas',
      align: 'right' as const,
      render: (row: ProduccionZona) => (
        <span className="text-slate-600">{row.brigadas_activas}</span>
      ),
    },
    {
      key: 'meta_produccion',
      header: 'Meta',
      align: 'right' as const,
      render: (row: ProduccionZona) => (
        <span className="text-slate-500">{formatCompact(row.meta_produccion)}</span>
      ),
    },
    {
      key: 'produccion',
      header: 'Producción',
      align: 'right' as const,
      render: (row: ProduccionZona) => (
        <span className="font-semibold text-slate-800">{formatCompact(row.produccion)}</span>
      ),
    },
    {
      key: 'pct_produccion',
      header: '% Cumpl.',
      align: 'right' as const,
      render: (row: ProduccionZona) => {
        const isGood = row.pct_produccion >= 100;
        const isWarning = row.pct_produccion >= 70 && row.pct_produccion < 100;
        return (
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
            isGood ? 'bg-green-100 text-green-700' :
            isWarning ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            {row.pct_produccion.toFixed(0)}%
          </span>
        );
      },
    },
    {
      key: 'cnr',
      header: 'CNR',
      align: 'right' as const,
      render: (row: ProduccionZona) => (
        <span className="font-medium text-slate-800">{row.cnr}</span>
      ),
    },
    {
      key: 'monto_cnr',
      header: 'Monto CNR',
      align: 'right' as const,
      render: (row: ProduccionZona) => (
        <span className="text-slate-600">{formatCompact(row.monto_cnr)}</span>
      ),
    },
    {
      key: 'promedio_monto_cnr',
      header: 'Prom. CNR',
      align: 'right' as const,
      render: (row: ProduccionZona) => (
        <span className="text-slate-600">{formatCompact(row.promedio_monto_cnr)}</span>
      ),
    },
  ], [formatCompact]);

  // Prepare chart data
  const chartData = useMemo(() => produccion.map((p) => ({
    name: p.zona,
    value: p.produccion,
    meta: p.meta_produccion,
  })), [produccion]);

  // Estado para ordenamiento de técnicos
  const [tecnicoSort, setTecnicoSort] = useState<{ key: 'nombre' | 'produccion'; direction: 'asc' | 'desc' }>({
    key: 'produccion',
    direction: 'desc',
  });

  // Agrupar técnicos por zona y ordenar
  const tecnicosPorZona = useMemo(() => {
    // Agrupar por zona
    const grupos: Record<string, { zona: string; nombre: string; produccion: number }[]> = {};

    produccionTecnicos.forEach((t) => {
      if (!grupos[t.zona]) {
        grupos[t.zona] = [];
      }
      grupos[t.zona].push(t);
    });

    // Ordenar técnicos dentro de cada zona
    Object.keys(grupos).forEach((zona) => {
      grupos[zona].sort((a, b) => {
        const multiplier = tecnicoSort.direction === 'asc' ? 1 : -1;
        if (tecnicoSort.key === 'nombre') {
          return multiplier * a.nombre.localeCompare(b.nombre);
        }
        return multiplier * (a.produccion - b.produccion);
      });
    });

    // Calcular totales por zona y ordenar zonas por producción total
    const zonasConTotal = Object.entries(grupos).map(([zona, tecnicos]) => ({
      zona,
      tecnicos,
      totalProduccion: tecnicos.reduce((acc, t) => acc + t.produccion, 0),
    }));

    zonasConTotal.sort((a, b) => b.totalProduccion - a.totalProduccion);

    return zonasConTotal;
  }, [produccionTecnicos, tecnicoSort]);

  const handleTecnicoSort = (key: 'nombre' | 'produccion') => {
    setTecnicoSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  return (
    <div className="space-y-6">
      {/* KPIs de Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Producción Total</p>
          <p className="text-2xl font-bold text-slate-800">{formatCompact(totales.totalProduccion)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Meta Total</p>
          <p className="text-2xl font-bold text-slate-600">{formatCompact(totales.totalMeta)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% Cumplimiento</p>
          <p className={`text-2xl font-bold ${
            totales.pctCumplimiento >= 100 ? 'text-green-600' :
            totales.pctCumplimiento >= 70 ? 'text-amber-600' : 'text-red-600'
          }`}>
            {totales.pctCumplimiento.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total CNR</p>
          <p className="text-2xl font-bold text-slate-800">{totales.totalCNR.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Monto CNR</p>
          <p className="text-2xl font-bold text-green-600">{formatCompact(totales.totalMontoCNR)}</p>
        </div>
      </div>

      {/* Tabla y Gráfico lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Summary Table */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Cumplimiento por Zona
          </h3>
          <DataTable columns={columns} data={produccion} />
        </div>

        {/* Chart */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Producción vs Meta
          </h3>
          <HorizontalBarChart
            data={chartData}
            valueLabel="Producción"
            metaLabel="Meta"
            color="#475569"
            metaColor="#94A3B8"
          />
        </div>
      </div>

      {/* Production by Technician - Cards por zona */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Producción por Técnico
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-400">
              {tecnicosPorZona.length} zonas · {produccionTecnicos.length} técnicos
            </span>
            <div className="flex gap-1 text-[10px]">
              <button
                onClick={() => handleTecnicoSort('nombre')}
                className={`px-2 py-1 rounded ${tecnicoSort.key === 'nombre' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                A-Z {tecnicoSort.key === 'nombre' && (tecnicoSort.direction === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => handleTecnicoSort('produccion')}
                className={`px-2 py-1 rounded ${tecnicoSort.key === 'produccion' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                $ {tecnicoSort.key === 'produccion' && (tecnicoSort.direction === 'asc' ? '↑' : '↓')}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tecnicosPorZona.map(({ zona, tecnicos, totalProduccion }) => (
            <div key={zona} className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
              {/* Header de zona */}
              <div className="bg-slate-800 text-white px-3 py-2 flex justify-between items-center">
                <span className="font-semibold text-xs truncate">{zona}</span>
                <span className="font-bold text-xs">{formatCompact(totalProduccion)}</span>
              </div>
              {/* Lista de técnicos */}
              <div className="max-h-[200px] overflow-y-auto">
                {tecnicos.map((t, idx) => (
                  <div
                    key={`${zona}-${t.nombre}-${idx}`}
                    className="flex justify-between items-center px-3 py-1.5 border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  >
                    <span className="text-[11px] text-slate-700 truncate pr-2">{t.nombre}</span>
                    <span className="text-[11px] font-semibold text-slate-800 whitespace-nowrap">
                      {formatCompact(t.produccion)}
                    </span>
                  </div>
                ))}
              </div>
              {/* Footer con cantidad */}
              <div className="bg-slate-50 px-3 py-1 text-[10px] text-slate-400 text-center border-t border-slate-100">
                {tecnicos.length} técnico{tecnicos.length !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
