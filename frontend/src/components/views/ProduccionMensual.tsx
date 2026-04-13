'use client';

import { useMemo, useCallback, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { ProduccionZona, Filters } from '@/types';
import DataTable from '@/components/ui/DataTable';
import HorizontalBarChart, { HorizontalBarClickEvent } from '@/components/charts/HorizontalBarChart';

interface ProduccionMensualProps {
  produccion: ProduccionZona[];
  produccionTecnicos: { zona: string; nombre: string; produccion: number }[];
  onFilterByZona?: (zona: string) => void;
  onFilterByTecnico?: (tecnico: string) => void;
  currentFilters?: Filters;
}

export default function ProduccionMensual({
  produccion,
  produccionTecnicos,
  onFilterByZona,
  onFilterByTecnico,
  currentFilters
}: ProduccionMensualProps) {
  const [tecnicoSort, setTecnicoSort] = useState<{ key: 'nombre' | 'produccion'; direction: 'asc' | 'desc' }>({
    key: 'produccion',
    direction: 'desc',
  });

  // Detectar si hay filtro de técnico activo
  const tecnicosFiltrados = currentFilters?.nombre_asignado || [];
  const zonasFiltradas = currentFilters?.zona || [];
  const hayFiltroTecnico = tecnicosFiltrados.length > 0;
  const hayFiltroZona = zonasFiltradas.length > 0;

  const formatCompact = useCallback((value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString('es-CL')}`;
  }, []);

  const handleZonaClick = useCallback((zona: string) => {
    if (onFilterByZona) {
      onFilterByZona(zona);
    }
  }, [onFilterByZona]);

  const handleTecnicoClick = useCallback((tecnico: string) => {
    if (onFilterByTecnico) {
      onFilterByTecnico(tecnico);
    }
  }, [onFilterByTecnico]);

  const handleChartClick = useCallback((event: HorizontalBarClickEvent) => {
    if (onFilterByZona) {
      onFilterByZona(event.name);
    }
  }, [onFilterByZona]);

  // Calcular totales
  const totales = useMemo(() => {
    const totalProduccion = produccion.reduce((acc, p) => acc + p.produccion, 0);
    const totalMeta = produccion.reduce((acc, p) => acc + p.meta_produccion, 0);
    const totalCNR = produccion.reduce((acc, p) => acc + p.cnr, 0);
    const totalMontoCNR = produccion.reduce((acc, p) => acc + p.monto_cnr, 0);
    const pctCumplimiento = totalMeta > 0 ? (totalProduccion / totalMeta) * 100 : 0;
    return { totalProduccion, totalMeta, totalCNR, totalMontoCNR, pctCumplimiento };
  }, [produccion]);

  // Columnas de la tabla con click en zona
  const columns = useMemo(() => [
    {
      key: 'zona',
      header: 'Zona',
      width: '180px',
      render: (row: ProduccionZona) => (
        <span
          onClick={() => handleZonaClick(row.zona)}
          className={`
            ${onFilterByZona ? 'cursor-pointer hover:text-oca-blue hover:underline' : ''}
            ${zonasFiltradas.includes(row.zona) ? 'text-oca-blue font-semibold' : ''}
          `}
        >
          {row.zona}
        </span>
      ),
    },
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
  ], [formatCompact, handleZonaClick, onFilterByZona, zonasFiltradas]);

  // Datos del gráfico principal
  const chartData = useMemo(() => produccion.map((p) => ({
    name: p.zona,
    value: p.produccion,
    meta: p.meta_produccion,
  })), [produccion]);

  // Gráfico de técnicos filtrados
  const tecnicoChartOption = useMemo(() => {
    if (!hayFiltroTecnico) return null;

    // Obtener datos de los técnicos filtrados
    const tecnicosData = produccionTecnicos
      .filter(t => tecnicosFiltrados.includes(t.nombre))
      .sort((a, b) => b.produccion - a.produccion);

    if (tecnicosData.length === 0) return null;

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#fff',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        textStyle: { color: '#374151', fontSize: 12 },
        formatter: (params: Array<{ name: string; value: number; marker: string }>) => {
          if (!params.length) return '';
          const p = params[0];
          return `<div style="font-weight:600">${p.name}</div>
            <div>${p.marker} Producción: <b>${formatCompact(p.value)}</b></div>`;
        },
      },
      grid: {
        left: '3%',
        right: '10%',
        bottom: '5%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 10,
          formatter: (value: number) => formatCompact(value),
        },
      },
      yAxis: {
        type: 'category',
        data: tecnicosData.map(t => t.nombre),
        axisLabel: {
          fontSize: 10,
          width: 150,
          overflow: 'truncate',
        },
        inverse: true,
      },
      series: [{
        type: 'bar',
        data: tecnicosData.map(t => ({
          value: t.produccion,
          itemStyle: {
            color: tecnicosFiltrados.includes(t.nombre) ? '#294D6D' : '#94a3b8',
          },
        })),
        label: {
          show: true,
          position: 'right',
          fontSize: 10,
          formatter: (params: { value: number }) => formatCompact(params.value),
        },
        barMaxWidth: 30,
      }],
    };
  }, [hayFiltroTecnico, produccionTecnicos, tecnicosFiltrados, formatCompact]);

  // Agrupar técnicos por zona y ordenar
  const tecnicosPorZona = useMemo(() => {
    const grupos: Record<string, { zona: string; nombre: string; produccion: number }[]> = {};

    produccionTecnicos.forEach((t) => {
      if (!grupos[t.zona]) {
        grupos[t.zona] = [];
      }
      grupos[t.zona].push(t);
    });

    Object.keys(grupos).forEach((zona) => {
      grupos[zona].sort((a, b) => {
        const multiplier = tecnicoSort.direction === 'asc' ? 1 : -1;
        if (tecnicoSort.key === 'nombre') {
          return multiplier * a.nombre.localeCompare(b.nombre);
        }
        return multiplier * (a.produccion - b.produccion);
      });
    });

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
      {/* Indicador de filtros activos */}
      {(hayFiltroTecnico || hayFiltroZona) && (
        <div className="bg-oca-blue/5 border border-oca-blue/20 rounded-lg px-4 py-2 flex items-center gap-4">
          <span className="text-[11px] text-oca-blue font-medium">Filtros activos:</span>
          {hayFiltroZona && (
            <span className="text-[11px] bg-oca-blue/10 text-oca-blue px-2 py-0.5 rounded">
              Zonas: {zonasFiltradas.join(', ')}
            </span>
          )}
          {hayFiltroTecnico && (
            <span className="text-[11px] bg-oca-blue/10 text-oca-blue px-2 py-0.5 rounded">
              Técnicos: {tecnicosFiltrados.join(', ')}
            </span>
          )}
        </div>
      )}

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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cumplimiento por Zona
            </h3>
            {onFilterByZona && (
              <span className="text-[10px] text-slate-400">Click en zona para filtrar</span>
            )}
          </div>
          <DataTable columns={columns} data={produccion} />
        </div>

        {/* Chart - Cambia según si hay filtro de técnico */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {hayFiltroTecnico ? 'Producción de Técnicos Filtrados' : 'Producción vs Meta'}
            </h3>
            {!hayFiltroTecnico && onFilterByZona && (
              <span className="text-[10px] text-slate-400">Click en barra para filtrar</span>
            )}
          </div>
          {hayFiltroTecnico && tecnicoChartOption ? (
            <ReactECharts
              option={tecnicoChartOption}
              style={{ height: `${Math.max(200, tecnicosFiltrados.length * 40)}px`, width: '100%' }}
              notMerge={true}
            />
          ) : (
            <HorizontalBarChart
              data={chartData}
              valueLabel="Producción"
              metaLabel="Meta"
              color="#475569"
              metaColor="#94A3B8"
              onElementClick={onFilterByZona ? handleChartClick : undefined}
            />
          )}
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
            <div
              key={zona}
              className={`bg-white rounded-lg border overflow-hidden transition-all ${
                zonasFiltradas.includes(zona) ? 'border-oca-blue ring-1 ring-oca-blue/20' : 'border-slate-200/60'
              }`}
            >
              {/* Header de zona - clickeable */}
              <div
                onClick={() => handleZonaClick(zona)}
                className={`px-3 py-2 flex justify-between items-center cursor-pointer transition-colors ${
                  zonasFiltradas.includes(zona)
                    ? 'bg-oca-blue text-white'
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                <span className="font-semibold text-xs truncate">{zona}</span>
                <span className="font-bold text-xs">{formatCompact(totalProduccion)}</span>
              </div>
              {/* Lista de técnicos */}
              <div className="max-h-[200px] overflow-y-auto">
                {tecnicos.map((t, idx) => (
                  <div
                    key={`${zona}-${t.nombre}-${idx}`}
                    onClick={() => handleTecnicoClick(t.nombre)}
                    className={`flex justify-between items-center px-3 py-1.5 border-b border-slate-50 last:border-0 transition-colors ${
                      onFilterByTecnico ? 'cursor-pointer hover:bg-oca-blue/5' : ''
                    } ${tecnicosFiltrados.includes(t.nombre) ? 'bg-oca-blue/10' : 'hover:bg-slate-50'}`}
                  >
                    <span className={`text-[11px] truncate pr-2 ${
                      tecnicosFiltrados.includes(t.nombre) ? 'text-oca-blue font-medium' : 'text-slate-700'
                    }`}>
                      {t.nombre}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-800 whitespace-nowrap">
                      {formatCompact(t.produccion)}
                    </span>
                  </div>
                ))}
              </div>
              {/* Footer con cantidad */}
              <div className="bg-slate-50 px-3 py-1 text-[10px] text-slate-400 text-center border-t border-slate-100">
                {tecnicos.length} técnico{tecnicos.length !== 1 ? 's' : ''}
                {onFilterByTecnico && <span className="text-oca-blue ml-1">· Click para filtrar</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
