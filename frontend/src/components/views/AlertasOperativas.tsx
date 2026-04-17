'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Filters, AlertasOperativasData, TecnicoInactivo, MetaNoCompida, ProblemaJornada, AltaVisitaFallida } from '@/types';
import { getAlertasOperativas } from '@/lib/api';

interface AlertasOperativasProps {
  filters: Filters;
}

function getFilterKey(filters: Filters): string {
  return `${filters.año}-${filters.mes.join(',')}-${filters.zona.join(',')}`;
}

// Componente de calendario similar al de Control de Metas
function CalendarioAsistencia({ fechasTrabajadasStr, fechaInicio, fechaFin }: {
  fechasTrabajadasStr: string[];
  fechaInicio: string;
  fechaFin: string;
}) {
  const fechasTrabajadas = new Set(fechasTrabajadasStr);
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  const dias = [];
  const current = new Date(inicio);

  while (current <= fin) {
    dias.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const mesesAgrupados: { [key: string]: Date[] } = {};
  dias.forEach(dia => {
    const mesKey = `${dia.getFullYear()}-${dia.getMonth()}`;
    if (!mesesAgrupados[mesKey]) {
      mesesAgrupados[mesKey] = [];
    }
    mesesAgrupados[mesKey].push(dia);
  });

  return (
    <div className="space-y-3">
      {Object.entries(mesesAgrupados).map(([mesKey, diasMes]) => {
        const primerDia = diasMes[0];
        const nombreMes = primerDia.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

        return (
          <div key={mesKey} className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-600 mb-2 capitalize">{nombreMes}</p>
            <div className="grid grid-cols-7 gap-1">
              {diasMes.map((dia, idx) => {
                const fechaStr = dia.toISOString().split('T')[0];
                const trabajado = fechasTrabajadas.has(fechaStr);
                const esFinde = dia.getDay() === 0 || dia.getDay() === 6;

                return (
                  <div
                    key={idx}
                    className={`text-center p-1.5 rounded text-xs ${
                      trabajado
                        ? 'bg-green-500 text-white font-semibold'
                        : esFinde
                        ? 'bg-slate-200 text-slate-400'
                        : 'bg-red-100 text-red-600'
                    }`}
                    title={`${dia.toLocaleDateString('es-CL')} - ${trabajado ? 'Trabajado' : esFinde ? 'Fin de semana' : 'Ausente'}`}
                  >
                    {dia.getDate()}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AlertasOperativas({ filters }: AlertasOperativasProps) {
  const [data, setData] = useState<AlertasOperativasData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tecnicoDetalle, setTecnicoDetalle] = useState<{
    tipo: 'inactivo' | 'meta' | 'jornada' | 'vf';
    data: TecnicoInactivo | MetaNoCompida | ProblemaJornada | AltaVisitaFallida;
  } | null>(null);
  const lastFilterKey = useRef<string>('');

  const fetchData = useCallback(async () => {
    const currentKey = getFilterKey(filters);
    if (currentKey === lastFilterKey.current && data !== null) return;
    if (!filters.año) return;

    lastFilterKey.current = currentKey;
    setIsLoading(true);

    try {
      const result = await getAlertasOperativas(filters);
      setData(result);
    } catch (error) {
      console.error('Error fetching alertas operativas:', error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [filters, data]);

  useEffect(() => {
    fetchData();
  }, [filters.año, filters.mes.join(','), filters.zona.join(',')]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oca-blue"></div>
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

  // Obtener los 10 casos más críticos de todas las zonas
  const topCriticos = [
    ...data.tecnicos_inactivos.filter(t => t.pct_ausentismo >= 50).slice(0, 5).map(t => ({
      tipo: 'Ausentismo crítico' as const,
      tecnico: t.tecnico,
      zona: t.zona,
      detalle: `${t.pct_ausentismo}% ausente (${t.dias_no_trabajados} días)`,
      gravedad: 'critica' as const,
    })),
    ...data.metas_no_cumplidas.filter(m => m.gravedad === 'alta').slice(0, 5).map(m => ({
      tipo: 'Meta no cumplida' as const,
      tecnico: m.tecnico,
      zona: m.zona,
      detalle: `CNR: ${m.promedio_cnr}, Efec: ${m.promedio_efectivas}`,
      gravedad: 'alta' as const,
    })),
    ...data.alta_visita_fallida.filter(v => v.pct_vf > 40).slice(0, 5).map(v => ({
      tipo: 'VF muy alta' as const,
      tecnico: v.tecnico,
      zona: v.zona,
      detalle: `${v.pct_vf}% VF (${v.visitas_fallidas} de ${v.total_visitas})`,
      gravedad: 'alta' as const,
    })),
  ].slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Alertas Operativas</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {data.periodo} · {data.dias_habiles} días hábiles ({data.dias_analizados} días calendario)
        </p>
      </div>

      {/* KPIs Resumen */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Técnicos Inactivos</p>
          <p className="text-2xl font-bold text-slate-800">{data.resumen_alertas.tecnicos_inactivos}</p>
          <p className="text-[10px] text-slate-400 mt-1">Con ausentismo</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Metas No Cumplidas</p>
          <p className="text-2xl font-bold text-slate-800">{data.resumen_alertas.metas_no_cumplidas}</p>
          <p className="text-[10px] text-slate-400 mt-1">Bajo rendimiento</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Problemas Jornada</p>
          <p className="text-2xl font-bold text-slate-800">{data.resumen_alertas.problemas_jornada}</p>
          <p className="text-[10px] text-slate-400 mt-1">Horarios irregulares</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Alta V. Fallida</p>
          <p className="text-2xl font-bold text-slate-800">{data.resumen_alertas.alta_visita_fallida}</p>
          <p className="text-[10px] text-slate-400 mt-1">&gt; 30% VF</p>
        </div>
      </div>

      {/* Resumen Ejecutivo - Top Casos Críticos */}
      {topCriticos.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
          <div className="px-4 py-3 bg-slate-800">
            <h3 className="text-sm font-semibold text-white">Resumen Ejecutivo - Casos Prioritarios</h3>
            <p className="text-[10px] text-slate-300 mt-0.5">Top {topCriticos.length} casos más críticos de todas las zonas</p>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Tipo</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Técnico</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Zona</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {topCriticos.map((caso, idx) => (
                <tr key={idx} className={`border-b border-slate-50 ${
                  caso.gravedad === 'critica' ? 'bg-red-50/40' : 'bg-amber-50/30'
                }`}>
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-700">{caso.tipo}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-600">{caso.tecnico}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-600">{caso.zona}</td>
                  <td className="px-3 py-2.5 text-sm font-semibold text-slate-700">{caso.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Alertas por Zona - Vista Consolidada */}
      {data.alertas_por_zona.map((zona, zIdx) => {
        const tecnicosInactivos = data.tecnicos_inactivos.filter(t => t.zona === zona.zona);
        const metasIncumplidas = data.metas_no_cumplidas.filter(m => m.zona === zona.zona);
        const problemasJornada = data.problemas_jornada.filter(j => j.zona === zona.zona);
        const altaVF = data.alta_visita_fallida.filter(v => v.zona === zona.zona);

        const tieneAlertas = tecnicosInactivos.length > 0 || metasIncumplidas.length > 0 ||
                            problemasJornada.length > 0 || altaVF.length > 0;

        if (!tieneAlertas) return null;

        return (
          <div key={zIdx} className="space-y-3">
            {/* Header de Zona con Resumen */}
            <div className="bg-white rounded-lg border border-slate-200/60 p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-800">{zona.zona}</h3>
                <div className="flex gap-4 text-sm">
                  {zona.tecnicos_inactivos > 0 && (
                    <span className="text-slate-500">
                      <span className="font-semibold text-slate-700">{zona.tecnicos_inactivos}</span> inactivos
                    </span>
                  )}
                  {zona.metas_no_cumplidas > 0 && (
                    <span className="text-slate-500">
                      <span className="font-semibold text-slate-700">{zona.metas_no_cumplidas}</span> metas
                    </span>
                  )}
                  {zona.problemas_jornada > 0 && (
                    <span className="text-slate-500">
                      <span className="font-semibold text-slate-700">{zona.problemas_jornada}</span> jornada
                    </span>
                  )}
                  {zona.alta_visita_fallida > 0 && (
                    <span className="text-slate-500">
                      <span className="font-semibold text-slate-700">{zona.alta_visita_fallida}</span> VF alta
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Técnicos Inactivos */}
              {tecnicosInactivos.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Técnicos Inactivos ({tecnicosInactivos.length})
                    </h4>
                  </div>
                  <table className="w-full">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Técnico</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-500">Días Trab.</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-500">Días Aus.</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-500">% Aus.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tecnicosInactivos.map((t, tIdx) => {
                        const esCritico = t.pct_ausentismo >= 50;
                        return (
                          <tr
                            key={tIdx}
                            onClick={() => setTecnicoDetalle({ tipo: 'inactivo', data: t })}
                            className={`border-b border-slate-50 cursor-pointer transition-all ${
                              esCritico
                                ? 'bg-red-50/40 hover:bg-red-50'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className={`px-3 py-2.5 text-sm ${esCritico ? 'text-slate-700 font-medium' : 'text-slate-600'}`}>
                              {t.tecnico}
                            </td>
                            <td className="px-2 py-2.5 text-right text-sm text-slate-600">
                              {t.dias_trabajados}
                            </td>
                            <td className={`px-2 py-2.5 text-right text-sm font-semibold ${
                              esCritico ? 'text-red-600' : 'text-slate-700'
                            }`}>
                              {t.dias_no_trabajados}
                            </td>
                            <td className={`px-2 py-2.5 text-right text-sm font-semibold ${
                              esCritico ? 'text-red-600' : 'text-slate-700'
                            }`}>
                              {t.pct_ausentismo}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Metas No Cumplidas */}
              {metasIncumplidas.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Metas No Cumplidas ({metasIncumplidas.length})
                    </h4>
                  </div>
                  <table className="w-full">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Técnico</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-500">CNR</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-500">Efec.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metasIncumplidas.map((m, mIdx) => {
                        const esCritico = m.gravedad === 'alta';
                        return (
                          <tr
                            key={mIdx}
                            onClick={() => setTecnicoDetalle({ tipo: 'meta', data: m })}
                            className={`border-b border-slate-50 cursor-pointer transition-all ${
                              esCritico
                                ? 'bg-red-50/40 hover:bg-red-50'
                                : 'bg-amber-50/30 hover:bg-amber-50'
                            }`}
                          >
                            <td className={`px-3 py-2.5 text-sm ${esCritico ? 'text-slate-700 font-medium' : 'text-slate-600'}`}>
                              {m.tecnico}
                            </td>
                            <td className={`px-2 py-2.5 text-right text-sm font-semibold ${m.promedio_cnr < 2 ? 'text-red-600' : 'text-slate-700'}`}>
                              {m.promedio_cnr}
                            </td>
                            <td className={`px-2 py-2.5 text-right text-sm font-semibold ${m.promedio_efectivas < 8 ? 'text-red-600' : 'text-slate-700'}`}>
                              {m.promedio_efectivas}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Problemas de Jornada */}
              {problemasJornada.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Problemas Jornada ({problemasJornada.length})
                    </h4>
                  </div>
                  <table className="w-full">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Técnico</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-500">Inicio Tardío</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-500">Cierre Temp.</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-500">Jorn. Corta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {problemasJornada.map((j, jIdx) => (
                        <tr
                          key={jIdx}
                          onClick={() => setTecnicoDetalle({ tipo: 'jornada', data: j })}
                          className="border-b border-slate-50 hover:bg-blue-50/30 cursor-pointer transition-all"
                        >
                          <td className="px-3 py-2.5 text-sm text-slate-600">{j.tecnico}</td>
                          <td className="px-2 py-2.5 text-right text-sm font-semibold text-slate-700">
                            {j.dias_inicio_tardio > 0 ? `${j.dias_inicio_tardio}d` : '-'}
                          </td>
                          <td className="px-2 py-2.5 text-right text-sm font-semibold text-slate-700">
                            {j.dias_cierre_temprano > 0 ? `${j.dias_cierre_temprano}d` : '-'}
                          </td>
                          <td className="px-2 py-2.5 text-right text-sm font-semibold text-slate-700">
                            {j.dias_jornada_corta > 0 ? `${j.dias_jornada_corta}d` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Alta Visita Fallida */}
              {altaVF.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Alta Visita Fallida ({altaVF.length})
                    </h4>
                  </div>
                  <table className="w-full">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Técnico</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-500">VF</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-500">% VF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {altaVF.map((v, vIdx) => {
                        const esCritico = v.pct_vf > 40;
                        return (
                          <tr
                            key={vIdx}
                            onClick={() => setTecnicoDetalle({ tipo: 'vf', data: v })}
                            className={`border-b border-slate-50 cursor-pointer transition-all ${
                              esCritico
                                ? 'bg-red-50/40 hover:bg-red-50'
                                : 'bg-amber-50/30 hover:bg-amber-50'
                            }`}
                          >
                            <td className={`px-3 py-2.5 text-sm ${esCritico ? 'text-slate-700 font-medium' : 'text-slate-600'}`}>
                              {v.tecnico}
                            </td>
                            <td className="px-2 py-2.5 text-right text-sm text-slate-600">{v.visitas_fallidas}</td>
                            <td className={`px-2 py-2.5 text-right text-sm font-semibold ${v.pct_vf > 40 ? 'text-red-600' : 'text-amber-600'}`}>
                              {v.pct_vf}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Mensaje si no hay alertas */}
      {data.resumen_alertas.tecnicos_inactivos === 0 &&
       data.resumen_alertas.metas_no_cumplidas === 0 &&
       data.resumen_alertas.problemas_jornada === 0 &&
       data.resumen_alertas.alta_visita_fallida === 0 && (
        <div className="bg-white rounded-lg border border-slate-200/60 p-8 text-center">
          <p className="text-slate-400">No hay alertas operativas en el período seleccionado</p>
        </div>
      )}

      {/* Modal de Detalle */}
      {tecnicoDetalle && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setTecnicoDetalle(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide">
                  {tecnicoDetalle.tipo === 'inactivo' && 'Técnico Inactivo'}
                  {tecnicoDetalle.tipo === 'meta' && 'Meta No Cumplida'}
                  {tecnicoDetalle.tipo === 'jornada' && 'Problema de Jornada'}
                  {tecnicoDetalle.tipo === 'vf' && 'Alta Visita Fallida'}
                </h3>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  {'tecnico' in tecnicoDetalle.data ? tecnicoDetalle.data.tecnico : ''}
                  {' · '}
                  {tecnicoDetalle.data.zona}
                </p>
              </div>
              <button onClick={() => setTecnicoDetalle(null)} className="text-slate-300 hover:text-white text-xs px-2 py-1">
                Cerrar
              </button>
            </div>

            <div className="p-6">
              {tecnicoDetalle.tipo === 'inactivo' && (() => {
                const t = tecnicoDetalle.data as TecnicoInactivo;
                return (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-[10px] uppercase text-slate-400 mb-1">Período analizado</p>
                      <p className="text-sm font-semibold text-slate-700">{data.periodo}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {data.dias_habiles} días hábiles de {data.dias_analizados} días calendario
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-slate-50 rounded-lg">
                        <p className="text-[10px] uppercase text-slate-400 mb-1">Días Trabajados</p>
                        <p className="text-2xl font-bold text-slate-800">{t.dias_trabajados}</p>
                        <p className="text-[10px] text-slate-400 mt-1">de {data.dias_habiles} hábiles</p>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg border border-red-100">
                        <p className="text-[10px] uppercase text-slate-400 mb-1">Días Ausente</p>
                        <p className="text-2xl font-bold text-red-600">{t.dias_no_trabajados}</p>
                        <p className="text-[10px] text-slate-400 mt-1">de {data.dias_habiles} hábiles</p>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg border border-red-100">
                        <p className="text-[10px] uppercase text-slate-400 mb-1">% Ausentismo</p>
                        <p className="text-2xl font-bold text-red-600">{t.pct_ausentismo}%</p>
                        <p className="text-[10px] text-slate-400 mt-1">del período</p>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-[10px] uppercase text-slate-400 mb-1">Última actividad registrada</p>
                      <p className="text-sm font-semibold text-slate-800">{t.ultima_actividad}</p>
                    </div>

                    {/* Calendario de asistencia */}
                    <div className="p-4 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-600 mb-3">Calendario de Asistencia</p>
                      <div className="flex gap-4 mb-3 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-green-500 rounded"></div>
                          <span className="text-slate-600">Trabajado</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-red-100 rounded"></div>
                          <span className="text-slate-600">Ausente</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-slate-200 rounded"></div>
                          <span className="text-slate-600">Fin de semana</span>
                        </div>
                      </div>
                      <CalendarioAsistencia
                        fechasTrabajadasStr={t.fechas_trabajadas}
                        fechaInicio={t.fecha_inicio}
                        fechaFin={t.fecha_fin}
                      />
                    </div>
                  </div>
                );
              })()}

              {tecnicoDetalle.tipo === 'meta' && (() => {
                const m = tecnicoDetalle.data as MetaNoCompida;
                return (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-[10px] uppercase text-slate-400 mb-1">Período analizado</p>
                      <p className="text-sm font-semibold text-slate-700">{data.periodo}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Trabajó {m.dias_trabajados} de {data.dias_habiles} días hábiles
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className={`p-4 rounded-lg ${m.promedio_cnr < 2 ? 'bg-red-50 border border-red-100' : 'bg-slate-50'}`}>
                        <p className="text-[10px] uppercase text-slate-400 mb-1">CNR Promedio</p>
                        <p className={`text-3xl font-bold ${m.promedio_cnr < 2 ? 'text-red-600' : 'text-slate-800'}`}>
                          {m.promedio_cnr}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">Meta: 2 CNR/día</p>
                        <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.promedio_cnr >= 2 ? 'bg-oca-blue' : 'bg-red-500'}`}
                            style={{ width: `${Math.min((m.promedio_cnr / 2) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg ${m.promedio_efectivas < 8 ? 'bg-red-50 border border-red-100' : 'bg-slate-50'}`}>
                        <p className="text-[10px] uppercase text-slate-400 mb-1">Efectivas Promedio</p>
                        <p className={`text-3xl font-bold ${m.promedio_efectivas < 8 ? 'text-red-600' : 'text-slate-800'}`}>
                          {m.promedio_efectivas}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">Meta: 8 efectivas/día</p>
                        <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.promedio_efectivas >= 8 ? 'bg-oca-blue' : 'bg-red-500'}`}
                            style={{ width: `${Math.min((m.promedio_efectivas / 8) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                      <p className="text-[10px] uppercase text-slate-400 mb-1">Problemas identificados</p>
                      <p className="text-sm text-slate-700">{m.problemas}</p>
                    </div>
                  </div>
                );
              })()}

              {tecnicoDetalle.tipo === 'jornada' && (() => {
                const j = tecnicoDetalle.data as ProblemaJornada;
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-[10px] uppercase text-slate-400 mb-1">Inicio Promedio</p>
                        <p className="text-2xl font-bold text-slate-800">{j.promedio_inicio}</p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-[10px] uppercase text-slate-400 mb-1">Fin Promedio</p>
                        <p className="text-2xl font-bold text-slate-800">{j.promedio_fin}</p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-[10px] uppercase text-slate-400 mb-1">Duración Prom.</p>
                        <p className="text-2xl font-bold text-slate-800">{j.promedio_duracion}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-[10px] uppercase text-slate-400 mb-3">Frecuencia de Problemas</p>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-xs text-slate-500 mb-1">Inicio tardío</p>
                          <p className="text-xl font-bold text-slate-800">{j.dias_inicio_tardio}</p>
                          <p className="text-[10px] text-slate-400">de {j.total_dias} días</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500 mb-1">Cierre temprano</p>
                          <p className="text-xl font-bold text-slate-800">{j.dias_cierre_temprano}</p>
                          <p className="text-[10px] text-slate-400">de {j.total_dias} días</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500 mb-1">Jornada corta</p>
                          <p className="text-xl font-bold text-slate-800">{j.dias_jornada_corta}</p>
                          <p className="text-[10px] text-slate-400">de {j.total_dias} días</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg text-xs text-slate-500 space-y-1">
                      <p>Horario esperado: 08:00 - 18:00</p>
                      <p>Duración mínima: 6 horas</p>
                      <p>Total días analizados: {j.total_dias}</p>
                    </div>
                  </div>
                );
              })()}

              {tecnicoDetalle.tipo === 'vf' && (() => {
                const v = tecnicoDetalle.data as AltaVisitaFallida;
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-red-50 rounded-lg border border-red-100">
                        <p className="text-[10px] uppercase text-slate-400 mb-1">Visitas Fallidas</p>
                        <p className="text-3xl font-bold text-red-600">{v.visitas_fallidas}</p>
                      </div>
                      <div className="text-center p-4 bg-slate-50 rounded-lg">
                        <p className="text-[10px] uppercase text-slate-400 mb-1">Total Visitas</p>
                        <p className="text-3xl font-bold text-slate-800">{v.total_visitas}</p>
                      </div>
                    </div>

                    <div className={`p-4 rounded-lg ${v.pct_vf > 40 ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'}`}>
                      <p className="text-[10px] uppercase text-slate-400 mb-2">Porcentaje de Visita Fallida</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-4 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${v.pct_vf > 40 ? 'bg-red-600' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(v.pct_vf, 100)}%` }}
                          />
                        </div>
                        <p className={`text-2xl font-bold ${v.pct_vf > 40 ? 'text-red-600' : 'text-amber-600'}`}>
                          {v.pct_vf}%
                        </p>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2">Meta: ≤ 30%</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
