'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Filters, ControlDiarioData, InspeccionesDia } from '@/types';
import { getControlDiario, getInspeccionesDia } from '@/lib/api';

interface ControlDiarioProps {
  filters: Filters;
}

type EstadoTecnico = 'critico' | 'alerta' | 'ok';

interface TecnicoAccion {
  nombre: string;
  zona: string;
  cnr: number;
  efectivas: number;
  visitas: number;
  pctVF: number;
  estado: EstadoTecnico;
  // Jornada
  horaInicio: string | null;
  horaFin: string | null;
  duracion: string | null;
  actividades: number | null;
}

function getFilterKey(filters: Filters): string {
  return `${filters.año}-${filters.mes.join(',')}-${filters.dia}-${filters.zona.join(',')}`;
}

export default function ControlDiario({ filters }: ControlDiarioProps) {
  const [data, setData] = useState<ControlDiarioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<'todos' | 'criticos' | 'alerta' | 'ok'>('todos');
  const [zonaExpandida, setZonaExpandida] = useState<string | null>(null);
  const [inspeccionesDia, setInspeccionesDia] = useState<InspeccionesDia | null>(null);
  const [cargandoInspecciones, setCargandoInspecciones] = useState(false);
  const lastFilterKey = useRef<string>('');

  const fetchData = useCallback(async () => {
    const currentKey = getFilterKey(filters);
    if (currentKey === lastFilterKey.current && data !== null) return;
    if (!filters.año) return;

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

  // Función para cargar inspecciones de un técnico en el día
  const cargarInspeccionesTecnico = async (nombre: string, zona: string) => {
    if (!data?.fecha_iso) return;

    setCargandoInspecciones(true);
    try {
      // Usar la fecha real del control diario (ya viene en formato ISO YYYY-MM-DD)
      const result = await getInspeccionesDia(nombre, zona, data.fecha_iso, filters);
      setInspeccionesDia(result);
    } catch (error) {
      console.error('Error cargando inspecciones del técnico:', error);
      setInspeccionesDia(null);
    } finally {
      setCargandoInspecciones(false);
    }
  };

  const { tecnicosPorZona, stats, zonasStats } = useMemo(() => {
    if (!data?.produccion) return { tecnicosPorZona: {}, stats: null, zonasStats: {} };

    // Crear mapa de jornada por técnico (nombre normalizado)
    const jornadaMap: Record<string, { horaInicio: string; horaFin: string; duracion: string; actividades: number }> = {};
    data.cierre_actividades?.forEach(j => {
      const key = j.tecnico.toLowerCase().trim();
      jornadaMap[key] = {
        horaInicio: j.primera_actividad,
        horaFin: j.ultima_actividad,
        duracion: j.duracion_jornada,
        actividades: j.total_actividades
      };
    });

    const porZona: Record<string, TecnicoAccion[]> = {};
    const zonasStats: Record<string, { total: number; criticos: number; ok: number }> = {};
    let zonaActual = '';

    data.produccion.forEach(p => {
      if (p.es_zona) {
        zonaActual = p.etiqueta;
        porZona[zonaActual] = [];
        zonasStats[zonaActual] = { total: 0, criticos: 0, ok: 0 };
      } else if (zonaActual) {
        const cumpleCNR = p.cnr >= 2;
        const cumpleEfectivas = p.q_efectivo >= 8;

        let estado: EstadoTecnico;
        if (!cumpleCNR && !cumpleEfectivas) estado = 'critico';
        else if (!cumpleCNR || !cumpleEfectivas) estado = 'alerta';
        else estado = 'ok';

        // Buscar jornada del técnico
        const tecnicoKey = p.etiqueta.toLowerCase().trim();
        const jornada = jornadaMap[tecnicoKey];

        porZona[zonaActual].push({
          nombre: p.etiqueta,
          zona: zonaActual,
          cnr: p.cnr,
          efectivas: p.q_efectivo,
          visitas: p.produccion,
          pctVF: p.pct_visita_fallida,
          estado,
          horaInicio: jornada?.horaInicio || null,
          horaFin: jornada?.horaFin || null,
          duracion: jornada?.duracion || null,
          actividades: jornada?.actividades || null
        });

        zonasStats[zonaActual].total++;
        if (estado === 'critico') zonasStats[zonaActual].criticos++;
        if (estado === 'ok') zonasStats[zonaActual].ok++;
      }
    });

    const ordenEstado = { critico: 0, alerta: 1, ok: 2 };
    Object.values(porZona).forEach(tecnicos => {
      tecnicos.sort((a, b) => {
        if (ordenEstado[a.estado] !== ordenEstado[b.estado]) {
          return ordenEstado[a.estado] - ordenEstado[b.estado];
        }
        return b.efectivas - a.efectivas;
      });
    });

    const allTecnicos = Object.values(porZona).flat();

    return {
      tecnicosPorZona: porZona,
      stats: {
        total: allTecnicos.length,
        criticos: allTecnicos.filter(t => t.estado === 'critico').length,
        enAlerta: allTecnicos.filter(t => t.estado === 'alerta').length,
        ok: allTecnicos.filter(t => t.estado === 'ok').length,
        produccion: data.resumen.total_produccion,
        pctCNR: data.resumen.pct_cnr_general,
        pctVF: data.resumen.pct_visita_fallida_general
      },
      zonasStats
    };
  }, [data]);

  const tecnicosFiltradosPorZona: Record<string, TecnicoAccion[]> = useMemo(() => {
    if (vistaActiva === 'todos') return tecnicosPorZona;

    const filtrados: Record<string, TecnicoAccion[]> = {};
    Object.entries(tecnicosPorZona).forEach(([zona, tecnicos]) => {
      const tecnicosFiltrados = tecnicos.filter((t: TecnicoAccion) => {
        if (vistaActiva === 'criticos') return t.estado === 'critico';
        if (vistaActiva === 'alerta') return t.estado === 'alerta';
        return t.estado === 'ok';
      });
      if (tecnicosFiltrados.length > 0) {
        filtrados[zona] = tecnicosFiltrados;
      }
    });
    return filtrados;
  }, [tecnicosPorZona, vistaActiva]);

  const totalFiltrados = Object.values(tecnicosFiltradosPorZona).flat().length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  if (!data || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">No hay datos disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Control Diario</h2>
          <p className="text-sm text-slate-500">{data.fecha_reporte}</p>
        </div>
      </div>

      {/* 6 KPIs */}
      <div className="grid grid-cols-6 gap-3">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Producción</p>
          <p className="text-3xl font-bold text-slate-800">{stats.produccion.toLocaleString('es-CL')}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.total} técnicos</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Efectivas</p>
          <p className="text-3xl font-bold text-slate-800">{(data.resumen.total_cnr + data.resumen.total_normal).toLocaleString('es-CL')}</p>
          <p className="text-xs text-slate-500 mt-1">{(100 - stats.pctVF).toFixed(0)}% del total</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">CNR</p>
          <p className={`text-3xl font-bold ${stats.pctCNR >= 25 ? 'text-green-600' : 'text-red-600'}`}>
            {data.resumen.total_cnr.toLocaleString('es-CL')}
          </p>
          <p className="text-xs text-slate-500 mt-1">{stats.pctCNR.toFixed(1)}% · Meta 25%</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">V. Fallida</p>
          <p className={`text-3xl font-bold ${stats.pctVF <= 25 ? 'text-green-600' : 'text-red-600'}`}>
            {data.resumen.total_visita_fallida.toLocaleString('es-CL')}
          </p>
          <p className="text-xs text-slate-500 mt-1">{stats.pctVF.toFixed(1)}% · Meta ≤25%</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">kWh Recuperado</p>
          <p className="text-3xl font-bold text-slate-700">{data.resumen.total_kwh.toLocaleString('es-CL')}</p>
          <p className="text-xs text-slate-500 mt-1">Energía recuperada</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Estado Técnicos</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setVistaActiva(vistaActiva === 'criticos' ? 'todos' : 'criticos')}
              className={`text-center transition-opacity ${vistaActiva === 'criticos' ? '' : 'opacity-60 hover:opacity-100'}`}
            >
              <p className="text-2xl font-bold text-red-600">{stats.criticos}</p>
              <p className="text-[10px] text-slate-500">Crit</p>
            </button>
            <button
              onClick={() => setVistaActiva(vistaActiva === 'alerta' ? 'todos' : 'alerta')}
              className={`text-center transition-opacity ${vistaActiva === 'alerta' ? '' : 'opacity-60 hover:opacity-100'}`}
            >
              <p className="text-2xl font-bold text-amber-500">{stats.enAlerta}</p>
              <p className="text-[10px] text-slate-500">Alerta</p>
            </button>
            <button
              onClick={() => setVistaActiva(vistaActiva === 'ok' ? 'todos' : 'ok')}
              className={`text-center transition-opacity ${vistaActiva === 'ok' ? '' : 'opacity-60 hover:opacity-100'}`}
            >
              <p className="text-2xl font-bold text-green-600">{stats.ok}</p>
              <p className="text-[10px] text-slate-500">OK</p>
            </button>
          </div>
        </div>
      </div>

      {/* Filtro activo */}
      {vistaActiva !== 'todos' && (
        <div className="flex items-center gap-3">
          <span className={`text-sm px-3 py-1 rounded font-medium ${
            vistaActiva === 'criticos' ? 'bg-red-100 text-red-700' :
            vistaActiva === 'alerta' ? 'bg-amber-100 text-amber-700' :
            'bg-green-100 text-green-700'
          }`}>
            {vistaActiva === 'criticos' ? 'Críticos' : vistaActiva === 'alerta' ? 'En Alerta' : 'Cumplen'}
          </span>
          <span className="text-sm text-slate-500">{totalFiltrados} técnicos</span>
          <button
            onClick={() => setVistaActiva('todos')}
            className="text-sm text-slate-400 hover:text-slate-600 ml-auto"
          >
            Ver todos
          </button>
        </div>
      )}

      {/* Tablas por Zona - Grid 3 columnas */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(tecnicosFiltradosPorZona).map(([zona, tecnicos]) => {
          const zonaData = zonasStats[zona] || { total: 0, criticos: 0, ok: 0 };
          const pctOk = zonaData.total > 0 ? (zonaData.ok / zonaData.total) * 100 : 0;

          return (
            <div key={zona} className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
              <div
                className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors"
                onClick={() => setZonaExpandida(zona)}
              >
                <span className="font-semibold text-xs">{zona}</span>
                <div className="flex items-center gap-2 text-[10px]">
                  {zonaData.criticos > 0 && <span className="text-red-300">{zonaData.criticos} crit</span>}
                  <span className={pctOk >= 70 ? 'text-green-300' : 'text-red-300'}>{pctOk.toFixed(0)}%</span>
                  <span className="text-slate-400 ml-1">↗</span>
                </div>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-[200px]">
                <table className="w-full min-w-[420px]">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Técnico</th>
                      <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase text-slate-400">Inicio</th>
                      <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase text-slate-400">Fin</th>
                      <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase text-slate-400">Dur</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Vis</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">CNR</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Efec</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">%VF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tecnicos.map((t, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${
                          t.estado === 'critico' ? 'bg-red-50/50' :
                          t.estado === 'alerta' ? 'bg-amber-50/30' : ''
                        }`}
                        onClick={() => cargarInspeccionesTecnico(t.nombre, t.zona)}
                        title="Click para ver detalle de inspecciones"
                      >
                        <td className="px-3 py-1.5 text-[11px] text-slate-800 truncate max-w-[80px]">{t.nombre}</td>
                        <td className="px-2 py-1.5 text-[11px] text-center text-slate-400">{t.horaInicio || '-'}</td>
                        <td className="px-2 py-1.5 text-[11px] text-center text-slate-400">{t.horaFin || '-'}</td>
                        <td className="px-2 py-1.5 text-[11px] text-center font-medium text-slate-500">{t.duracion || '-'}</td>
                        <td className="px-2 py-1.5 text-[11px] text-right text-slate-600">{t.visitas}</td>
                        <td className={`px-2 py-1.5 text-[11px] font-semibold text-right ${t.cnr >= 2 ? 'text-green-600' : 'text-red-600'}`}>
                          {t.cnr}
                        </td>
                        <td className={`px-2 py-1.5 text-[11px] font-semibold text-right ${t.efectivas >= 8 ? 'text-green-600' : 'text-red-600'}`}>
                          {t.efectivas.toFixed(0)}
                        </td>
                        <td className={`px-3 py-1.5 text-[11px] text-right ${t.pctVF > 25 ? 'text-red-500' : 'text-slate-500'}`}>
                          {t.pctVF.toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Tabla Expandida */}
      {zonaExpandida && tecnicosFiltradosPorZona[zonaExpandida] && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setZonaExpandida(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <span className="font-semibold">{zonaExpandida}</span>
              <button onClick={() => setZonaExpandida(null)} className="text-slate-300 hover:text-white text-lg">✕</button>
            </div>
            <div className="overflow-auto max-h-[calc(80vh-60px)]">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Técnico</th>
                    <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase text-slate-500">Inicio</th>
                    <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase text-slate-500">Fin</th>
                    <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase text-slate-500">Duración</th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Visitas</th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">CNR</th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Efectivas</th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">% V.Fallida</th>
                    <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase text-slate-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {tecnicosFiltradosPorZona[zonaExpandida].map((t, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${
                        t.estado === 'critico' ? 'bg-red-50/50' :
                        t.estado === 'alerta' ? 'bg-amber-50/30' : ''
                      }`}
                      onClick={() => cargarInspeccionesTecnico(t.nombre, t.zona)}
                      title="Click para ver detalle de inspecciones"
                    >
                      <td className="px-4 py-2 text-sm text-slate-800 font-medium">{t.nombre}</td>
                      <td className="px-3 py-2 text-sm text-center text-slate-500">{t.horaInicio || '-'}</td>
                      <td className="px-3 py-2 text-sm text-center text-slate-500">{t.horaFin || '-'}</td>
                      <td className="px-3 py-2 text-sm text-center font-medium text-slate-600">{t.duracion || '-'}</td>
                      <td className="px-3 py-2 text-sm text-right text-slate-600">{t.visitas}</td>
                      <td className={`px-3 py-2 text-sm font-bold text-right ${t.cnr >= 2 ? 'text-green-600' : 'text-red-600'}`}>
                        {t.cnr}
                      </td>
                      <td className={`px-3 py-2 text-sm font-bold text-right ${t.efectivas >= 8 ? 'text-green-600' : 'text-red-600'}`}>
                        {t.efectivas.toFixed(0)}
                      </td>
                      <td className={`px-3 py-2 text-sm text-right ${t.pctVF > 25 ? 'text-red-500' : 'text-slate-500'}`}>
                        {t.pctVF.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          t.estado === 'critico' ? 'bg-red-100 text-red-700' :
                          t.estado === 'alerta' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {t.estado === 'critico' ? 'Crítico' : t.estado === 'alerta' ? 'Alerta' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Top 10 Causas de Visita Fallida */}
      {data.resultados_fallidos && data.resultados_fallidos.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-800">Top 10 Causas de Visita Fallida</span>
            <span className="text-xs text-slate-400">{data.resumen.total_visita_fallida} visitas fallidas</span>
          </div>
          <div className="space-y-2">
            {(() => {
              const top10 = [...data.resultados_fallidos]
                .sort((a, b) => b.cantidad - a.cantidad)
                .slice(0, 10);
              const maxCantidad = Math.max(...top10.map(r => r.cantidad), 1);
              const total = data.resumen.total_visita_fallida || top10.reduce((a, b) => a + b.cantidad, 0);

              return top10.map((r, idx) => {
                const pct = total > 0 ? (r.cantidad / total) * 100 : 0;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-600 w-56 truncate" title={r.resultado}>{r.resultado}</span>
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-500"
                        style={{ width: `${(r.cantidad / maxCantidad) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 w-10 text-right">{r.cantidad}</span>
                    <span className="text-[11px] text-slate-400 w-12 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Modal Inspecciones del Día */}
      {inspeccionesDia && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setInspeccionesDia(null)}>
          <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-semibold">{inspeccionesDia.nombre}</span>
                <span className="text-xs text-slate-300">{inspeccionesDia.zona}</span>
                <span className="text-xs text-slate-300">
                  {(() => {
                    const [year, month, day] = inspeccionesDia.fecha.split('-');
                    return `${day}-${month}-${year}`;
                  })()}
                </span>
                <span className="text-xs text-slate-400">
                  {inspeccionesDia.total_inspecciones} inspecciones
                </span>
              </div>
              <button onClick={() => setInspeccionesDia(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Contenido */}
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
              {cargandoInspecciones ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-slate-400">Cargando inspecciones...</p>
                </div>
              ) : inspeccionesDia.inspecciones.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-slate-400">No hay inspecciones para este técnico</p>
                </div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">ID Medida</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Aviso</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Resultado</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Causa VF</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Tipo CNR</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Comuna</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Dirección</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Horario</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">kWh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspeccionesDia.inspecciones.map((insp, idx) => (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/80">
                        <td className="px-3 py-2 text-slate-800 font-medium">{insp['ID Medida'] || '-'}</td>
                        <td className="px-3 py-2 text-slate-700">{insp['Aviso'] || '-'}</td>
                        <td className={`px-3 py-2 font-semibold ${
                          insp['Resultado visita'] === 'CNR' ? 'text-green-600' :
                          insp['Resultado visita'] === 'Visita fallida' ? 'text-red-600' :
                          'text-slate-800'
                        }`}>
                          {insp['Resultado visita'] || '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-600 max-w-[180px] truncate" title={insp['Resultado final'] || '-'}>
                          {insp['Resultado visita'] === 'Visita fallida' ? (insp['Resultado final'] || '-') : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{insp['Tipo_CNR.Tipo de CNR'] || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{insp['Comuna'] || '-'}</td>
                        <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={insp['Dirección Servicio'] || '-'}>
                          {insp['Dirección Servicio'] || '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {insp['Hora inicio'] && insp['Hora fin']
                            ? `${insp['Hora inicio']} - ${insp['Hora fin']}`
                            : '-'}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700 font-medium">
                          {insp['kWh CNR'] ? insp['kWh CNR'].toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
