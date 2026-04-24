'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Filters, AlertasOperativasData, TecnicoInactivo, MetaNoCompida, ProblemaJornada, AltaVisitaFallida, PagoTecnico, CalendarioMes } from '@/types';
import { getAlertasOperativas } from '@/lib/api';
import CalendarioBrigadas from './CalendarioBrigadas';
import DetalleTecnicoDiarioModal from '@/components/ui/DetalleTecnicoDiarioModal';

interface AlertasOperativasProps {
  filters: Filters;
  pagoTecnicos?: PagoTecnico[];
  calendarioMes?: CalendarioMes | null;
}

function getFilterKey(filters: Filters): string {
  return `${filters.año}-${filters.mes.join(',')}-${filters.zona.join(',')}`;
}

export default function AlertasOperativas({ filters, pagoTecnicos, calendarioMes }: AlertasOperativasProps) {
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

      {/* KPIs Resumen — con severidad visual */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          {
            label: 'Faltando a Trabajar',
            value: data.resumen_alertas.tecnicos_inactivos,
            hint: `de ${data.alertas_por_zona.reduce((a, z) => a + z.tecnicos_inactivos + (data.metas_no_cumplidas.filter(m => m.zona === z.zona).length), 0) || 1} técnicos monitoreados`,
            critColor: 'red',
            worst: data.tecnicos_inactivos.slice().sort((a, b) => b.pct_ausentismo - a.pct_ausentismo)[0],
            worstFmt: (t: TecnicoInactivo) => `${t.tecnico.split(' ')[0]} ${t.pct_ausentismo}%`,
          },
          {
            label: 'No Cumplen Meta',
            value: data.resumen_alertas.metas_no_cumplidas,
            hint: 'Bajo rendimiento CNR/Efec',
            critColor: 'red',
            worst: data.metas_no_cumplidas.slice().sort((a, b) => a.promedio_efectivas - b.promedio_efectivas)[0],
            worstFmt: (m: MetaNoCompida) => `${m.tecnico.split(' ')[0]} · ${m.promedio_efectivas} ef/d`,
          },
          {
            label: 'Problemas de Jornada',
            value: data.resumen_alertas.problemas_jornada,
            hint: 'Horarios irregulares',
            critColor: 'amber',
            worst: data.problemas_jornada.slice().sort((a, b) => (b.dias_jornada_corta + b.dias_inicio_tardio + b.dias_cierre_temprano) - (a.dias_jornada_corta + a.dias_inicio_tardio + a.dias_cierre_temprano))[0],
            worstFmt: (j: ProblemaJornada) => `${j.tecnico.split(' ')[0]} · ${j.dias_jornada_corta}d cortas`,
          },
          {
            label: 'Alta V. Fallida',
            value: data.resumen_alertas.alta_visita_fallida,
            hint: '> 30% VF',
            critColor: 'amber',
            worst: data.alta_visita_fallida.slice().sort((a, b) => b.pct_vf - a.pct_vf)[0],
            worstFmt: (v: AltaVisitaFallida) => `${v.tecnico.split(' ')[0]} · ${v.pct_vf}%`,
          },
        ] as const).map((k, idx) => {
          const isCrit = k.value > 0;
          const ring = !isCrit ? 'border-green-200' : k.critColor === 'red' ? 'border-red-200' : 'border-amber-200';
          const valColor = !isCrit ? 'text-green-600' : k.critColor === 'red' ? 'text-red-600' : 'text-amber-600';
          const badgeBg = !isCrit ? 'bg-green-50' : k.critColor === 'red' ? 'bg-red-50' : 'bg-amber-50';
          const badgeText = !isCrit ? 'text-green-600' : k.critColor === 'red' ? 'text-red-600' : 'text-amber-600';
          return (
            <div key={idx} className={`bg-white rounded-lg border ${ring} p-4 flex flex-col justify-between min-h-[104px]`}>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">{k.label}</p>
                <div className="flex items-baseline gap-2">
                  <p className={`text-3xl font-bold ${valColor}`}>{k.value}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeBg} ${badgeText}`}>
                    {isCrit ? 'REVISAR' : 'OK'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{k.hint}</p>
              </div>
              {isCrit && k.worst && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <p className="text-[9px] uppercase tracking-wider text-slate-400">Peor caso</p>
                  <p className="text-[11px] font-semibold text-slate-700 truncate" title={k.worstFmt(k.worst as never)}>
                    {k.worstFmt(k.worst as never)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Calendario Operativo de Brigadas */}
      {calendarioMes && pagoTecnicos && pagoTecnicos.some((t) => t.dias_trabajados_count > 0) && (
        <CalendarioBrigadas
          pagoTecnicos={pagoTecnicos}
          calendario={calendarioMes}
        />
      )}

      {/* Ranking Crítico - dos paneles lado a lado */}
      {(data.tecnicos_inactivos.length > 0 || data.metas_no_cumplidas.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Panel: Faltando a Trabajar */}
          {(() => {
            const topAusentes = data.tecnicos_inactivos
              .slice()
              .sort((a, b) => b.pct_ausentismo - a.pct_ausentismo || b.dias_no_trabajados - a.dias_no_trabajados)
              .slice(0, 10);
            const maxPct = topAusentes[0]?.pct_ausentismo ?? 0;

            return (
              <div className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
                <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-xs uppercase tracking-wide">Faltando a Trabajar</span>
                    <span className="text-[10px] text-slate-300 ml-2">Top {topAusentes.length} · por % ausentismo</span>
                  </div>
                  <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                    {data.tecnicos_inactivos.length} totales
                  </span>
                </div>
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="w-6 px-2 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">#</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Técnico</th>
                      <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Zona</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Días Aus.</th>
                      <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase text-slate-500 w-40">% Ausentismo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAusentes.map((t, idx) => {
                      const esCrit = t.pct_ausentismo >= 50;
                      const esAlto = t.pct_ausentismo >= 30 && t.pct_ausentismo < 50;
                      return (
                        <tr
                          key={`aus-${idx}`}
                          onClick={() => setTecnicoDetalle({ tipo: 'inactivo', data: t })}
                          className={`border-b border-slate-50 cursor-pointer transition-colors ${
                            esCrit ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-2 py-1.5 text-right text-[10px] tabular-nums text-slate-400 font-semibold">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-1.5 text-slate-800 truncate max-w-[180px]" title={t.tecnico}>
                            {t.tecnico}
                          </td>
                          <td className="px-2 py-1.5 text-slate-500 truncate max-w-[120px]" title={t.zona}>
                            {t.zona.replace(/^\d+\.\s*/, '')}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${
                            esCrit ? 'text-red-600' : esAlto ? 'text-amber-600' : 'text-slate-700'
                          }`}>
                            {t.dias_no_trabajados}
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    esCrit ? 'bg-red-500' : esAlto ? 'bg-amber-500' : 'bg-slate-400'
                                  }`}
                                  style={{ width: `${maxPct > 0 ? (t.pct_ausentismo / maxPct) * 100 : 0}%` }}
                                />
                              </div>
                              <span className={`tabular-nums w-10 text-right font-semibold ${
                                esCrit ? 'text-red-600' : esAlto ? 'text-amber-600' : 'text-slate-600'
                              }`}>
                                {t.pct_ausentismo}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {topAusentes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-[11px] text-slate-400">
                          Sin técnicos con ausentismo detectado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Panel: No Cumplen Meta */}
          {(() => {
            const topMetas = data.metas_no_cumplidas
              .slice()
              .sort((a, b) => {
                // Criticas primero, luego por efectivas promedio ascendente
                if (a.gravedad === 'alta' && b.gravedad !== 'alta') return -1;
                if (b.gravedad === 'alta' && a.gravedad !== 'alta') return 1;
                return a.promedio_efectivas - b.promedio_efectivas;
              })
              .slice(0, 10);
            const maxDef = topMetas.length > 0
              ? Math.max(...topMetas.map((m) => Math.max(0, 8 - m.promedio_efectivas)))
              : 0;

            return (
              <div className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
                <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-xs uppercase tracking-wide">No Cumplen Meta</span>
                    <span className="text-[10px] text-slate-300 ml-2">Top {topMetas.length} · meta 8 ef/día</span>
                  </div>
                  <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                    {data.metas_no_cumplidas.length} totales
                  </span>
                </div>
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="w-6 px-2 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">#</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Técnico</th>
                      <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Zona</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">CNR/d</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Ef/d</th>
                      <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase text-slate-500 w-28">Déficit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topMetas.map((m, idx) => {
                      const esCrit = m.gravedad === 'alta';
                      const deficit = Math.max(0, 8 - m.promedio_efectivas);
                      return (
                        <tr
                          key={`meta-${idx}`}
                          onClick={() => setTecnicoDetalle({ tipo: 'meta', data: m })}
                          className={`border-b border-slate-50 cursor-pointer transition-colors ${
                            esCrit ? 'bg-red-50/40 hover:bg-red-50' : 'bg-amber-50/30 hover:bg-amber-50'
                          }`}
                        >
                          <td className="px-2 py-1.5 text-right text-[10px] tabular-nums text-slate-400 font-semibold">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-1.5 text-slate-800 truncate max-w-[180px]" title={m.tecnico}>
                            {m.tecnico}
                          </td>
                          <td className="px-2 py-1.5 text-slate-500 truncate max-w-[120px]" title={m.zona}>
                            {m.zona.replace(/^\d+\.\s*/, '')}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${m.promedio_cnr < 2 ? 'text-red-600' : 'text-slate-700'}`}>
                            {m.promedio_cnr}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${esCrit ? 'text-red-600' : 'text-amber-600'}`}>
                            {m.promedio_efectivas}
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${esCrit ? 'bg-red-500' : 'bg-amber-500'}`}
                                  style={{ width: `${maxDef > 0 ? (deficit / maxDef) * 100 : 0}%` }}
                                />
                              </div>
                              <span className={`tabular-nums text-[10px] w-10 text-right font-semibold ${esCrit ? 'text-red-600' : 'text-amber-600'}`}>
                                −{deficit.toFixed(1)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {topMetas.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-[11px] text-slate-400">
                          Todos los técnicos cumplen la meta.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}
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

      {/* Modal de Detalle con calendario al estilo Control de Metas */}
      {tecnicoDetalle && (() => {
        const nombre = 'tecnico' in tecnicoDetalle.data ? tecnicoDetalle.data.tecnico : '';
        const zona = tecnicoDetalle.data.zona;
        let titulo = '';
        let badge: { texto: string; clase: string } | undefined;
        let kpisTop: React.ReactNode = null;

        if (tecnicoDetalle.tipo === 'inactivo') {
          const t = tecnicoDetalle.data as TecnicoInactivo;
          titulo = 'Técnico Inactivo';
          badge = t.pct_ausentismo >= 50
            ? { texto: 'Crítico', clase: 'bg-red-500/20 text-red-300' }
            : { texto: 'Medio', clase: 'bg-amber-500/20 text-amber-300' };
          kpisTop = (
            <div className="grid grid-cols-4 gap-3">
              <KPI label="Período" main={data.periodo} hint={`${data.dias_habiles} hábiles`} />
              <KPI label="Días Trabajados" main={String(t.dias_trabajados)} hint={`de ${data.dias_habiles}`} />
              <KPI label="Días Ausente" main={String(t.dias_no_trabajados)} tone="red" />
              <KPI label="% Ausentismo" main={`${t.pct_ausentismo}%`} tone="red" />
            </div>
          );
        } else if (tecnicoDetalle.tipo === 'meta') {
          const m = tecnicoDetalle.data as MetaNoCompida;
          titulo = 'Meta No Cumplida';
          badge = m.gravedad === 'alta'
            ? { texto: 'Alta gravedad', clase: 'bg-red-500/20 text-red-300' }
            : { texto: 'Media', clase: 'bg-amber-500/20 text-amber-300' };
          kpisTop = (
            <div className="grid grid-cols-4 gap-3">
              <KPI label="Días trabajados" main={String(m.dias_trabajados)} hint={`de ${data.dias_habiles} hábiles`} />
              <KPI label="CNR / día" main={String(m.promedio_cnr)} hint="Meta: 2" tone={m.promedio_cnr < 2 ? 'red' : 'default'} />
              <KPI label="Efectivas / día" main={String(m.promedio_efectivas)} hint="Meta: 8" tone={m.promedio_efectivas < 8 ? 'red' : 'default'} />
              <KPI label="Problemas" main={m.problemas || '—'} small />
            </div>
          );
        } else if (tecnicoDetalle.tipo === 'jornada') {
          const j = tecnicoDetalle.data as ProblemaJornada;
          titulo = 'Problema de Jornada';
          kpisTop = (
            <div className="grid grid-cols-4 gap-3">
              <KPI label="Inicio Prom." main={j.promedio_inicio} />
              <KPI label="Fin Prom." main={j.promedio_fin} />
              <KPI label="Duración Prom." main={j.promedio_duracion} />
              <KPI
                label="Jornada corta"
                main={`${j.dias_jornada_corta}d`}
                hint={`de ${j.total_dias} días`}
                tone={j.dias_jornada_corta > 3 ? 'amber' : 'default'}
              />
            </div>
          );
        } else if (tecnicoDetalle.tipo === 'vf') {
          const v = tecnicoDetalle.data as AltaVisitaFallida;
          titulo = 'Alta Visita Fallida';
          badge = v.pct_vf > 40
            ? { texto: 'Crítico', clase: 'bg-red-500/20 text-red-300' }
            : { texto: 'Medio', clase: 'bg-amber-500/20 text-amber-300' };
          kpisTop = (
            <div className="grid grid-cols-3 gap-3">
              <KPI label="Visitas Fallidas" main={String(v.visitas_fallidas)} tone="red" />
              <KPI label="Total Visitas" main={String(v.total_visitas)} />
              <KPI label="% VF" main={`${v.pct_vf}%`} hint="Meta: ≤30%" tone={v.pct_vf > 40 ? 'red' : 'amber'} />
            </div>
          );
        }

        return (
          <DetalleTecnicoDiarioModal
            nombre={nombre}
            zona={zona}
            filters={filters}
            onClose={() => setTecnicoDetalle(null)}
            titulo={titulo}
            badge={badge}
            kpisTop={kpisTop}
          />
        );
      })()}
    </div>
  );
}

// KPI card pequeño reutilizable para la cabecera del modal
function KPI({
  label,
  main,
  hint,
  tone = 'default',
  small = false,
}: {
  label: string;
  main: string;
  hint?: string;
  tone?: 'default' | 'red' | 'amber';
  small?: boolean;
}) {
  const mainColor = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-800';
  const bg = tone === 'red' ? 'bg-red-50 border-red-100' : tone === 'amber' ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-200/60';
  return (
    <div className={`rounded-lg border p-3 ${bg}`}>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={`${small ? 'text-xs' : 'text-xl'} font-bold ${mainColor} ${small ? 'truncate' : ''}`} title={small ? main : undefined}>
        {main}
      </p>
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
