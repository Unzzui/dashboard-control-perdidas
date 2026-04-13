'use client';

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { X, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { Filters, ControlDiarioData, CierreActividades, DetalleCNR, CampanaCNR } from '@/types';
import { getControlDiario } from '@/lib/api';

interface ControlDiarioProps {
  filters: Filters;
}

type ModalType = 'cnr' | 'efectivas' | 'ambas' | 'ninguna' | null;

// Componente para barra de progreso visual - memoizado
const ProgressBar = memo(function ProgressBar({ value, max, color = 'slate' }: { value: number; max: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const colorClasses: Record<string, string> = {
    slate: 'bg-slate-600',
    green: 'bg-green-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
  };
  return (
    <div className="w-full bg-slate-200 rounded-full h-2">
      <div
        className={`h-2 rounded-full ${colorClasses[color]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
});

// Generar clave de filtros para evitar refetch innecesario
function getFilterKey(filters: Filters): string {
  return `${filters.año}-${filters.mes.join(',')}-${filters.dia}-${filters.zona.join(',')}`;
}

export default function ControlDiario({ filters }: ControlDiarioProps) {
  const [data, setData] = useState<ControlDiarioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState<ModalType>(null);
  const lastFilterKey = useRef<string>('');

  const fetchData = useCallback(async () => {
    const currentKey = getFilterKey(filters);

    // Evitar refetch si los filtros no cambiaron
    if (currentKey === lastFilterKey.current && data !== null) {
      return;
    }

    // No hacer fetch si no hay año
    if (!filters.año) {
      return;
    }

    lastFilterKey.current = currentKey;
    setIsLoading(true);

    try {
      const result = await getControlDiario(filters);
      setData(result);
    } catch (error) {
      console.error('Error fetching control diario:', error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [filters, data]);

  useEffect(() => {
    fetchData();
  }, [filters.año, filters.mes.join(','), filters.zona.join(','), filters.dia]);

  // Memoizar agrupaciones por zona
  const cierreByZona = useMemo(() => {
    if (!data?.cierre_actividades) return {};
    return data.cierre_actividades.reduce((acc, item) => {
      if (!acc[item.zona]) acc[item.zona] = [];
      acc[item.zona].push(item);
      return acc;
    }, {} as Record<string, CierreActividades[]>);
  }, [data?.cierre_actividades]);

  const cnrByZona = useMemo(() => {
    if (!data?.detalle_cnr) return {};
    return data.detalle_cnr.reduce((acc, item) => {
      if (!acc[item.zona]) acc[item.zona] = [];
      acc[item.zona].push(item);
      return acc;
    }, {} as Record<string, DetalleCNR[]>);
  }, [data?.detalle_cnr]);

  const campanasByZona = useMemo(() => {
    if (!data?.campanas_cnr) return {};
    return data.campanas_cnr.reduce((acc, item) => {
      if (!acc[item.zona]) acc[item.zona] = [];
      acc[item.zona].push(item);
      return acc;
    }, {} as Record<string, CampanaCNR[]>);
  }, [data?.campanas_cnr]);

  // Memoizar cálculos derivados
  const { resumenPorZona, tecnicosData, tecnicosCumplenCNR, tecnicosCumplenEfectivas,
          tecnicosCumplenAmbas, totalTecnicos, topTecnicos, tecnicosAlerta, tecnicosNoCumplenNinguna } = useMemo(() => {
    const produccion = data?.produccion || [];

    const resumenPorZona = produccion
      .filter(p => p.es_zona)
      .map(z => ({
        zona: z.etiqueta,
        produccion: z.produccion,
        cnr: z.cnr,
        qEfectivo: z.q_efectivo,
        pctVF: z.pct_visita_fallida,
      }));

    const tecnicosDataFiltered = produccion.filter(p => !p.es_zona);
    const tecnicosCumplenCNR = tecnicosDataFiltered.filter(t => t.cnr >= 2).length;
    const tecnicosCumplenEfectivas = tecnicosDataFiltered.filter(t => t.q_efectivo >= 8).length;
    const tecnicosCumplenAmbas = tecnicosDataFiltered.filter(t => t.cnr >= 2 && t.q_efectivo >= 8).length;
    const totalTecnicos = tecnicosDataFiltered.length;

    const topTecnicos = [...tecnicosDataFiltered]
      .sort((a, b) => b.q_efectivo - a.q_efectivo)
      .slice(0, 5);

    // Todos los técnicos que no cumplen ninguna meta (sin límite)
    const tecnicosAlerta = tecnicosDataFiltered
      .filter(t => t.cnr < 2 && t.q_efectivo < 8);

    const tecnicosNoCumplenNinguna = tecnicosAlerta.length;

    return { resumenPorZona, tecnicosData: tecnicosDataFiltered, tecnicosCumplenCNR, tecnicosCumplenEfectivas,
             tecnicosCumplenAmbas, totalTecnicos, topTecnicos, tecnicosAlerta, tecnicosNoCumplenNinguna };
  }, [data?.produccion]);

  // Técnicos agrupados por zona para el modal
  const tecnicosPorZona = useMemo(() => {
    const produccion = data?.produccion || [];
    const zonas: Record<string, {
      nombre: string;
      tecnicos: Array<{
        nombre: string;
        cnr: number;
        qEfectivo: number;
        cumpleCNR: boolean;
        cumpleEfectivas: boolean;
        cumpleAmbas: boolean;
      }>;
      totales: { cumplenCNR: number; cumplenEfectivas: number; cumplenAmbas: number; total: number };
    }> = {};

    let currentZona = '';
    produccion.forEach(p => {
      if (p.es_zona) {
        currentZona = p.etiqueta;
        zonas[currentZona] = {
          nombre: currentZona,
          tecnicos: [],
          totales: { cumplenCNR: 0, cumplenEfectivas: 0, cumplenAmbas: 0, total: 0 }
        };
      } else if (currentZona && zonas[currentZona]) {
        const cumpleCNR = p.cnr >= 2;
        const cumpleEfectivas = p.q_efectivo >= 8;
        const cumpleAmbas = cumpleCNR && cumpleEfectivas;

        zonas[currentZona].tecnicos.push({
          nombre: p.etiqueta,
          cnr: p.cnr,
          qEfectivo: p.q_efectivo,
          cumpleCNR,
          cumpleEfectivas,
          cumpleAmbas
        });

        zonas[currentZona].totales.total++;
        if (cumpleCNR) zonas[currentZona].totales.cumplenCNR++;
        if (cumpleEfectivas) zonas[currentZona].totales.cumplenEfectivas++;
        if (cumpleAmbas) zonas[currentZona].totales.cumplenAmbas++;
      }
    });

    return Object.values(zonas);
  }, [data?.produccion]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">No hay datos disponibles</p>
      </div>
    );
  }

  // Calcular máximos para barras de progreso
  const maxProduccion = Math.max(...resumenPorZona.map(z => z.produccion), 1);
  const maxCNR = Math.max(...resumenPorZona.map(z => z.cnr), 1);

  return (
    <div className="space-y-6">
      {/* Header con fecha */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Control Diario de Operaciones</h2>
          <p className="text-sm text-slate-500">
            Reporte del día anterior: <span className="font-medium text-slate-700">{data.fecha_reporte}</span>
          </p>
        </div>
      </div>

      {/* KPIs Principales - Solo los 4 más críticos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Producción Total</p>
          <p className="text-2xl font-bold text-slate-800">{data.resumen.total_produccion.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">CNR: {data.resumen.total_cnr} | Normal: {data.resumen.total_normal}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% CNR</p>
          <p className={`text-2xl font-bold ${data.resumen.pct_cnr_general >= 25 ? 'text-green-600' : 'text-slate-800'}`}>
            {data.resumen.pct_cnr_general.toFixed(1)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Meta: 25%</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% V. Fallida</p>
          <p className={`text-2xl font-bold ${data.resumen.pct_visita_fallida_general <= 25 ? 'text-green-600' : 'text-red-600'}`}>
            {data.resumen.pct_visita_fallida_general.toFixed(1)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Meta: {'<'}25% | {data.resumen.total_visita_fallida.toLocaleString('es-CL')} casos</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Técnicos Activos</p>
          <p className="text-2xl font-bold text-slate-800">{totalTecnicos}</p>
          <p className="text-[10px] text-slate-400 mt-1">{tecnicosCumplenAmbas} cumplen ambas metas</p>
        </div>
      </div>

      {/* Panel de Cumplimiento de Metas y Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Resumen de Cumplimiento */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Cumplimiento de Metas</h3>
          <p className="text-[9px] text-slate-400 mb-3">Click para ver detalle por zona</p>
          <div className="space-y-3">
            <button
              onClick={() => setModalOpen('cnr')}
              className="w-full flex items-center justify-between p-2 bg-slate-50 rounded hover:bg-slate-100 transition-colors cursor-pointer group"
            >
              <div className="text-left">
                <p className="text-[10px] text-slate-500 uppercase">Meta CNR/día {'>='} 2</p>
                <p className="text-lg font-bold text-slate-700">{tecnicosCumplenCNR} / {totalTecnicos}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${tecnicosCumplenCNR >= totalTecnicos * 0.7 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalTecnicos > 0 ? Math.round((tecnicosCumplenCNR / totalTecnicos) * 100) : 0}%
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
              </div>
            </button>
            <button
              onClick={() => setModalOpen('efectivas')}
              className="w-full flex items-center justify-between p-2 bg-slate-50 rounded hover:bg-slate-100 transition-colors cursor-pointer group"
            >
              <div className="text-left">
                <p className="text-[10px] text-slate-500 uppercase">Meta Efectivas/día {'>='} 8</p>
                <p className="text-lg font-bold text-slate-700">{tecnicosCumplenEfectivas} / {totalTecnicos}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${tecnicosCumplenEfectivas >= totalTecnicos * 0.7 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalTecnicos > 0 ? Math.round((tecnicosCumplenEfectivas / totalTecnicos) * 100) : 0}%
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
              </div>
            </button>
            <button
              onClick={() => setModalOpen('ambas')}
              className="w-full flex items-center justify-between p-2 bg-green-50 rounded border border-green-200 hover:bg-green-100 transition-colors cursor-pointer group"
            >
              <div className="text-left">
                <p className="text-[10px] text-green-700 uppercase font-medium">Cumplen ambas metas</p>
                <p className="text-lg font-bold text-green-700">{tecnicosCumplenAmbas} / {totalTecnicos}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-green-600">
                  {totalTecnicos > 0 ? Math.round((tecnicosCumplenAmbas / totalTecnicos) * 100) : 0}%
                </span>
                <ChevronRight className="w-4 h-4 text-green-500 group-hover:text-green-700" />
              </div>
            </button>
            <button
              onClick={() => setModalOpen('ninguna')}
              className="w-full flex items-center justify-between p-2 bg-red-50 rounded border border-red-200 hover:bg-red-100 transition-colors cursor-pointer group"
            >
              <div className="text-left">
                <p className="text-[10px] text-red-700 uppercase font-medium">No cumplen ninguna meta</p>
                <p className="text-lg font-bold text-red-700">{tecnicosNoCumplenNinguna} / {totalTecnicos}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-red-600">
                  {totalTecnicos > 0 ? Math.round((tecnicosNoCumplenNinguna / totalTecnicos) * 100) : 0}%
                </span>
                <ChevronRight className="w-4 h-4 text-red-500 group-hover:text-red-700" />
              </div>
            </button>
          </div>
        </div>

        {/* Top Técnicos */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Top 5 Técnicos del Día</h3>
          <div className="space-y-2">
            {topTecnicos.map((t, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold ${
                  idx === 0 ? 'bg-slate-800 text-white' :
                  idx === 1 ? 'bg-slate-600 text-white' :
                  idx === 2 ? 'bg-slate-400 text-white' :
                  'bg-slate-200 text-slate-600'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-700 truncate">{t.etiqueta}</p>
                  <p className="text-[10px] text-slate-400">CNR: {t.cnr} | Efect: {t.q_efectivo.toFixed(0)}</p>
                </div>
                <span className="text-xs font-bold text-green-600">{t.q_efectivo.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-red-600">Técnicos en Alerta</h3>
            {tecnicosAlerta.length > 0 && (
              <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                {tecnicosAlerta.length}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mb-3">No cumplen ninguna meta (CNR {'<'} 2 y Efect {'<'} 8)</p>
          {tecnicosAlerta.length === 0 ? (
            <div className="p-4 bg-green-50 rounded text-center">
              <p className="text-green-700 font-medium text-sm">Sin alertas</p>
              <p className="text-[10px] text-green-600">Todos los técnicos cumplen al menos una meta</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {tecnicosAlerta.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-200">
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-red-700 truncate">{t.etiqueta}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] text-red-600">CNR: {t.cnr}</span>
                    <span className="text-[10px] text-red-600 ml-2">Efect: {t.q_efectivo.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resumen Visual por Zona */}
      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Resumen por Zona</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {resumenPorZona.map((zona) => {
            const cumpleQEfectivo = zona.qEfectivo >= 8;
            const cumpleVF = zona.pctVF <= 25;
            return (
              <div key={zona.zona} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 mb-3 truncate" title={zona.zona}>
                  {zona.zona}
                </h4>

                <div className="space-y-3">
                  {/* Producción */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Producción</span>
                      <span className="font-semibold text-slate-700">{zona.produccion}</span>
                    </div>
                    <ProgressBar value={zona.produccion} max={maxProduccion} color="slate" />
                  </div>

                  {/* CNR */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>CNR</span>
                      <span className="font-semibold text-slate-800">{zona.cnr}</span>
                    </div>
                    <ProgressBar value={zona.cnr} max={maxCNR} color="slate" />
                  </div>

                  {/* Q Efectivo y % VF */}
                  <div className="flex gap-2 pt-2 border-t border-slate-200">
                    <div className="flex-1 text-center">
                      <p className="text-[9px] text-slate-400 uppercase">Q Efect.</p>
                      <p className={`text-sm font-bold ${cumpleQEfectivo ? 'text-green-600' : 'text-red-600'}`}>
                        {zona.qEfectivo.toFixed(1)}
                      </p>
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-[9px] text-slate-400 uppercase">% VF</p>
                      <p className={`text-sm font-bold ${cumpleVF ? 'text-green-600' : 'text-red-600'}`}>
                        {zona.pctVF.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Producción por Técnico */}
      <div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Producción por Técnico</h3>
            <div className="flex items-center gap-2 text-[9px]">
              <span className="flex items-center gap-1">
                <span className="px-1 rounded bg-green-100 text-green-700">OK</span> Meta
              </span>
              <span className="flex items-center gap-1">
                <span className="px-1 rounded bg-red-100 text-red-700">X</span> Bajo
              </span>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 mb-2">CNR {'>='} 2 | Q Efect {'>='} 8</p>

          <div className="overflow-y-auto max-h-[400px]">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <th className="px-1.5 py-1.5 text-[8px] font-semibold uppercase text-slate-500 bg-slate-50 text-left">Técnico</th>
                  <th className="px-1 py-1.5 text-[8px] font-semibold uppercase text-slate-500 bg-slate-50 text-right">CNR</th>
                  <th className="px-1 py-1.5 text-[8px] font-semibold uppercase text-slate-500 bg-slate-50 text-right">Mant</th>
                  <th className="px-1 py-1.5 text-[8px] font-semibold uppercase text-slate-500 bg-slate-50 text-right">Norm</th>
                  <th className="px-1 py-1.5 text-[8px] font-semibold uppercase text-slate-500 bg-slate-50 text-right">VF</th>
                  <th className="px-1 py-1.5 text-[8px] font-semibold uppercase text-slate-500 bg-slate-50 text-right">Prod</th>
                  <th className="px-1 py-1.5 text-[8px] font-semibold uppercase text-slate-500 bg-slate-50 text-right">QEf</th>
                  <th className="px-1 py-1.5 text-[8px] font-semibold uppercase text-slate-500 bg-slate-50 text-right">%VF</th>
                </tr>
              </thead>
              <tbody>
                {data.produccion.map((row, idx) => {
                  const isZona = row.es_zona;
                  return (
                    <tr
                      key={idx}
                      className={isZona
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'border-b border-slate-50 hover:bg-slate-50'
                      }
                    >
                      <td className={`px-1.5 py-1 truncate max-w-[120px] ${isZona ? '' : 'pl-3'}`} title={row.etiqueta}>{row.etiqueta}</td>
                      <td className="px-1 py-1 text-right">
                        {isZona ? row.cnr : (
                          <span className={`inline-block px-1 rounded text-[9px] font-bold ${
                            row.cnr >= 2 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>{row.cnr}</span>
                        )}
                      </td>
                      <td className="px-1 py-1 text-right">{row.mantenimiento_medidor}</td>
                      <td className="px-1 py-1 text-right">{row.normal}</td>
                      <td className="px-1 py-1 text-right">{row.visita_fallida}</td>
                      <td className="px-1 py-1 text-right font-medium">{row.produccion}</td>
                      <td className="px-1 py-1 text-right">
                        {isZona ? row.q_efectivo.toFixed(0) : (
                          <span className={`inline-block px-1 rounded text-[9px] font-bold ${
                            row.q_efectivo >= 8 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>{row.q_efectivo.toFixed(0)}</span>
                        )}
                      </td>
                      <td className={`px-1 py-1 text-right ${!isZona && row.pct_visita_fallida > 25 ? 'text-red-600' : ''}`}>
                        {row.pct_visita_fallida.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Grid de 2 columnas para Cierre y CNR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cierre de Actividades */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Cierre de Actividades</h3>
          <p className="text-[10px] text-slate-400 mb-4">
            Primera y última actividad registrada por técnico
          </p>
          <div className="max-h-[450px] overflow-y-auto space-y-3">
            {Object.entries(cierreByZona).map(([zona, items]) => (
              <div key={zona}>
                <div className="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-t">
                  {zona}
                </div>
                <div className="border border-t-0 border-slate-200 rounded-b overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-3 py-1.5 text-[9px] font-semibold text-slate-500 text-left">Técnico</th>
                        <th className="px-3 py-1.5 text-[9px] font-semibold text-slate-500 text-center">Inicio</th>
                        <th className="px-3 py-1.5 text-[9px] font-semibold text-slate-500 text-center">Fin</th>
                        <th className="px-3 py-1.5 text-[9px] font-semibold text-slate-500 text-center">Duración</th>
                        <th className="px-3 py-1.5 text-[9px] font-semibold text-slate-500 text-right">Act.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-3 py-2 text-[11px] text-slate-700">{item.tecnico}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-block bg-green-100 text-green-700 text-[10px] font-medium px-2 py-0.5 rounded">
                              {item.primera_actividad}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded">
                              {item.ultima_actividad}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[11px] text-slate-600 text-center">{item.duracion_jornada}</td>
                          <td className="px-3 py-2 text-[11px] font-bold text-right">{item.total_actividades}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detalle de CNR */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Detalle de CNR</h3>
          <p className="text-[10px] text-slate-400 mb-4">
            Tipos de CNR por zona y responsable
          </p>
          <div className="max-h-[450px] overflow-y-auto space-y-3">
            {Object.entries(cnrByZona).map(([zona, items]) => {
              const totalZona = items.reduce((acc, i) => acc + i.cantidad, 0);
              return (
                <div key={zona}>
                  <div className="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-t flex justify-between items-center">
                    <span>{zona}</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">{totalZona} CNR</span>
                  </div>
                  <div className="border border-t-0 border-slate-200 rounded-b overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-3 py-1.5 text-[9px] font-semibold text-slate-500 text-left">Tipo CNR</th>
                          <th className="px-3 py-1.5 text-[9px] font-semibold text-slate-500 text-left">Responsable</th>
                          <th className="px-3 py-1.5 text-[9px] font-semibold text-slate-500 text-right w-16">Cant.</th>
                          <th className="px-3 py-1.5 text-[9px] font-semibold text-slate-500 text-right w-16">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded ${
                                item.tipo_cnr.includes('Hurto')
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {item.tipo_cnr}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-700">{item.responsable}</td>
                            <td className="px-3 py-2 text-[11px] font-bold text-right">{item.cantidad}</td>
                            <td className="px-3 py-2 text-[11px] text-slate-400 text-right">{item.pct_del_total.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Campañas con CNR */}
      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Campañas con CNR por Zona</h3>
        <p className="text-[10px] text-slate-400 mb-4">
          Detalle de campañas que generaron CNR
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {Object.entries(campanasByZona).map(([zona, items]) => {
            const totalCNRZona = items.reduce((acc, i) => acc + i.cnr, 0);
            return (
              <div key={zona} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-800 text-white text-xs font-bold px-3 py-2 flex justify-between items-center">
                  <span>{zona}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">{totalCNRZona} CNR</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-1.5 text-[9px] font-semibold text-slate-500 text-left">Descripción</th>
                      <th className="px-3 py-1.5 text-[9px] font-semibold text-slate-500 text-right w-12">CNR</th>
                      <th className="px-3 py-1.5 text-[9px] font-semibold text-slate-500 text-right w-12">Norm</th>
                      <th className="px-3 py-1.5 text-[9px] font-semibold text-slate-500 text-right w-12">Total</th>
                      <th className="px-3 py-1.5 text-[9px] font-semibold text-slate-500 text-right w-14">%CNR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-3 py-2 text-[11px] text-slate-700">{item.descripcion_aviso}</td>
                        <td className="px-3 py-2 text-[11px] font-bold text-slate-800 text-right">{item.cnr}</td>
                        <td className="px-3 py-2 text-[11px] text-right">{item.normal}</td>
                        <td className="px-3 py-2 text-[11px] text-right">{item.total}</td>
                        <td className="px-3 py-2 text-[11px] text-right">
                          <span className={item.pct_cnr >= 25 ? 'text-green-600 font-medium' : 'text-slate-600'}>
                            {item.pct_cnr.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Cumplimiento de Metas */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setModalOpen(null)}
          />

          {/* Modal Content */}
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] m-4 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {modalOpen === 'cnr' && 'Detalle Meta CNR >= 2'}
                  {modalOpen === 'efectivas' && 'Detalle Meta Efectivas >= 8'}
                  {modalOpen === 'ambas' && 'Detalle Cumplen Ambas Metas'}
                  {modalOpen === 'ninguna' && 'Técnicos que No Cumplen Ninguna Meta'}
                </h2>
                <p className="text-sm text-slate-500">{data.fecha_reporte}</p>
              </div>
              <button
                onClick={() => setModalOpen(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Summary */}
            {modalOpen === 'ninguna' ? (
              <div className="px-6 py-3 bg-red-50 border-b border-red-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="text-sm text-red-800">
                    <strong>{tecnicosNoCumplenNinguna}</strong>
                    {' '}de {totalTecnicos} técnicos no cumplen ninguna meta
                    {' '}
                    <span className="text-red-600">
                      ({totalTecnicos > 0 ? Math.round((tecnicosNoCumplenNinguna / totalTecnicos) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="px-6 py-3 bg-green-50 border-b border-green-200">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-800">
                    <strong>
                      {modalOpen === 'cnr' ? tecnicosCumplenCNR :
                       modalOpen === 'efectivas' ? tecnicosCumplenEfectivas :
                       tecnicosCumplenAmbas}
                    </strong>
                    {' '}de {totalTecnicos} técnicos cumplen esta meta
                    {' '}
                    <span className="text-green-600">
                      ({totalTecnicos > 0 ? Math.round(((modalOpen === 'cnr' ? tecnicosCumplenCNR :
                       modalOpen === 'efectivas' ? tecnicosCumplenEfectivas :
                       tecnicosCumplenAmbas) / totalTecnicos) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {tecnicosPorZona.map((zona) => {
                  // Filtrar técnicos según la meta seleccionada
                  const tecnicosFiltrados = zona.tecnicos.filter(t => {
                    if (modalOpen === 'cnr') return t.cumpleCNR;
                    if (modalOpen === 'efectivas') return t.cumpleEfectivas;
                    if (modalOpen === 'ambas') return t.cumpleAmbas;
                    if (modalOpen === 'ninguna') return !t.cumpleCNR && !t.cumpleEfectivas;
                    return true;
                  });

                  // Si no hay técnicos en esta zona, no mostrar la zona
                  if (tecnicosFiltrados.length === 0) return null;

                  const esAlerta = modalOpen === 'ninguna';

                  return (
                    <div key={zona.nombre} className="border border-slate-200 rounded-lg overflow-hidden">
                      {/* Zona Header */}
                      <div className={`${esAlerta ? 'bg-red-700' : 'bg-slate-800'} text-white px-4 py-2 flex items-center justify-between`}>
                        <span className="font-semibold text-sm">{zona.nombre}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`flex items-center gap-1 ${esAlerta ? 'bg-red-500/30' : 'bg-green-500/20'} px-2 py-0.5 rounded`}>
                            {esAlerta ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-300" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-green-400" />
                            )}
                            <span className={`${esAlerta ? 'text-red-200' : 'text-green-300'} font-medium`}>{tecnicosFiltrados.length} técnicos</span>
                          </span>
                        </div>
                      </div>

                      {/* Técnicos Table */}
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-2 text-[10px] font-semibold uppercase text-slate-500 text-left">Técnico</th>
                            <th className="px-4 py-2 text-[10px] font-semibold uppercase text-slate-500 text-center w-24">CNR</th>
                            <th className="px-4 py-2 text-[10px] font-semibold uppercase text-slate-500 text-center w-24">Efectivas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tecnicosFiltrados.map((tecnico, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-slate-50 hover:bg-slate-50"
                            >
                              <td className="px-4 py-2 text-sm text-slate-700">{tecnico.nombre}</td>
                              <td className="px-4 py-2 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                  tecnico.cumpleCNR ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {tecnico.cnr}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                  tecnico.cumpleEfectivas ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {tecnico.qEfectivo.toFixed(0)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">
                  {modalOpen === 'cnr' && 'Meta: >= 2 CNR por día'}
                  {modalOpen === 'efectivas' && 'Meta: >= 8 Efectivas por día'}
                  {modalOpen === 'ambas' && 'Técnicos que cumplen ambas metas simultáneamente'}
                  {modalOpen === 'ninguna' && 'Técnicos con CNR < 2 y Efectivas < 8'}
                </p>
                <button
                  onClick={() => setModalOpen(null)}
                  className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
