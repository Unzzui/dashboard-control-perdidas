'use client';

import { useEffect, useMemo, useState } from 'react';
import { Filters, JornadaTecnicoDetalle, JornadaDiaDetalle } from '@/types';
import { getJornadaTecnicoDetalle } from '@/lib/api/jornada';

const formatDuracion = (minutos: number): string => {
  if (!minutos || minutos < 0) return '—';
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

const formatFecha = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

interface Props {
  nombre: string;
  filters: Filters;
  onClose: () => void;
}

export default function JornadaTecnicoModal({ nombre, filters, onClose }: Props) {
  const [data, setData] = useState<JornadaTecnicoDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    setError(null);
    setData(null);
    getJornadaTecnicoDetalle(nombre, filters)
      .then(setData)
      .catch(() => setError('No se pudo cargar el detalle'))
      .finally(() => setCargando(false));
  }, [nombre, filters]);

  const totales = useMemo(() => {
    if (!data) return null;
    const dias = data.dias;
    return {
      totalAct: dias.reduce((a, d) => a + d.total_actividades, 0),
      totalEf: dias.reduce((a, d) => a + d.efectivas, 0),
      totalNorm: dias.reduce((a, d) => a + d.normales, 0),
      totalCnrFalla: dias.reduce((a, d) => a + d.cnr_falla, 0),
      totalCnrHurto: dias.reduce((a, d) => a + d.cnr_hurto, 0),
      totalVfCge: dias.reduce((a, d) => a + d.vf_cge, 0),
      totalVfNoEf: dias.reduce((a, d) => a + d.vf_no_efectivas, 0),
      totalMant: dias.reduce((a, d) => a + d.mantenimiento, 0),
      totalKwh: dias.reduce((a, d) => a + d.kwh, 0),
    };
  }, [data]);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <span className="font-semibold truncate">{data?.nombre ?? nombre}</span>
            {data && (
              <>
                <span className="text-xs text-slate-300 truncate">{data.zona}</span>
                <span className="text-xs text-slate-400">{data.periodo}</span>
              </>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {cargando && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-oca-blue" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-500 text-sm">{error}</div>
          )}

          {data && !cargando && (
            <>
              {/* KPIs principales */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <KPI label="Días" value={data.kpis.total_dias.toString()} hint={`${data.kpis.jornadas_cortas} cortas (<6h)`} />
                <KPI label="Jornada prom." value={formatDuracion(data.kpis.duracion_promedio_min)} hint={`${data.kpis.hora_inicio_promedio} → ${data.kpis.hora_fin_promedio}`} />
                <KPI label="Actividades" value={data.kpis.total_actividades.toLocaleString('es-CL')} hint={`${data.kpis.actividades_promedio_dia.toFixed(1)} prom/día`} />
                <KPI
                  label="Efectivas"
                  value={data.kpis.efectivas_total.toLocaleString('es-CL')}
                  hint={`${data.kpis.efectivas_promedio_dia.toFixed(1)} prom/día`}
                  tone={data.kpis.efectivas_promedio_dia >= 8 ? 'success' : data.kpis.efectivas_promedio_dia >= 5 ? 'default' : 'warning'}
                />
                <KPI
                  label="% Efectividad"
                  value={`${data.kpis.pct_efectividad_global.toFixed(0)}%`}
                  hint="Efectivas / Total"
                  tone={data.kpis.pct_efectividad_global >= 70 ? 'success' : data.kpis.pct_efectividad_global >= 50 ? 'default' : 'warning'}
                />
                <KPI
                  label="Prod/h"
                  value={data.kpis.productividad_promedio.toFixed(1)}
                  hint="Actividades por hora"
                  tone={data.kpis.productividad_promedio >= 5 ? 'success' : data.kpis.productividad_promedio >= 3 ? 'default' : 'warning'}
                />
              </div>

              {/* Desglose categorías */}
              <div className="bg-white border border-slate-200/60 rounded-lg overflow-hidden">
                <div className="bg-slate-800 text-white px-3 py-2">
                  <span className="font-semibold text-xs uppercase tracking-wide">Desglose del periodo</span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-slate-200">
                  <Stat label="Normales" value={data.kpis.normales} bg="bg-white" />
                  <Stat label="CNR Falla" value={data.kpis.cnr_falla} bg="bg-white" />
                  <Stat label="CNR Hurto" value={data.kpis.cnr_hurto} bg="bg-white" />
                  <Stat label="VF CGE" value={data.kpis.vf_cge} bg="bg-white" tone="success" />
                  <Stat label="VF No Efect." value={data.kpis.vf_no_efectivas} bg="bg-white" tone="warning" />
                  <Stat label="Mantenimiento" value={data.kpis.mantenimiento} bg="bg-white" />
                </div>
                {data.kpis.kwh_total > 0 && (
                  <div className="bg-slate-50 px-3 py-2 text-[11px] text-slate-600 border-t border-slate-200">
                    kWh recuperado: <span className="font-semibold tabular-nums">{data.kpis.kwh_total.toLocaleString('es-CL')}</span>
                  </div>
                )}
              </div>

              {/* Tabla detalle día a día */}
              <div className="bg-white border border-slate-200/60 rounded-lg overflow-hidden">
                <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between">
                  <span className="font-semibold text-xs uppercase tracking-wide">Detalle diario</span>
                  <span className="text-[10px] text-slate-300">{data.dias.length} días con actividad</span>
                </div>
                <div className="overflow-x-auto max-h-[450px]">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Fecha</th>
                        <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Día</th>
                        <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase text-slate-500">Inicio</th>
                        <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase text-slate-500">Fin</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Jornada</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Total</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Norm</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">CNR-F</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">CNR-H</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-emerald-600">VF CGE</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-amber-600">VF NoEf</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Mant</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-emerald-600 bg-emerald-50/50">Efect.</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">% Efect</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Prod/h</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">kWh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.dias.map((d) => (
                        <DiaRow key={d.fecha} dia={d} />
                      ))}
                    </tbody>
                    {totales && (
                      <tfoot className="bg-slate-50 border-t-2 border-slate-300 sticky bottom-0">
                        <tr>
                          <td className="px-3 py-2 font-bold text-slate-800" colSpan={5}>
                            TOTAL ({data.dias.length} días)
                          </td>
                          <td className="px-2 py-2 text-right font-bold text-slate-800 tabular-nums">{totales.totalAct.toLocaleString('es-CL')}</td>
                          <td className="px-2 py-2 text-right font-bold text-slate-700 tabular-nums">{totales.totalNorm}</td>
                          <td className="px-2 py-2 text-right font-bold text-slate-700 tabular-nums">{totales.totalCnrFalla}</td>
                          <td className="px-2 py-2 text-right font-bold text-slate-700 tabular-nums">{totales.totalCnrHurto}</td>
                          <td className="px-2 py-2 text-right font-bold text-emerald-700 tabular-nums">{totales.totalVfCge}</td>
                          <td className="px-2 py-2 text-right font-bold text-amber-700 tabular-nums">{totales.totalVfNoEf}</td>
                          <td className="px-2 py-2 text-right font-bold text-slate-700 tabular-nums">{totales.totalMant}</td>
                          <td className="px-2 py-2 text-right font-bold text-emerald-700 bg-emerald-50/50 tabular-nums">{totales.totalEf}</td>
                          <td className="px-2 py-2 text-right font-bold text-slate-700 tabular-nums">{data.kpis.pct_efectividad_global.toFixed(0)}%</td>
                          <td className="px-2 py-2 text-right font-bold text-slate-700 tabular-nums">{data.kpis.productividad_promedio.toFixed(1)}</td>
                          <td className="px-2 py-2 text-right font-bold text-slate-700 tabular-nums">{totales.totalKwh.toLocaleString('es-CL')}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Subcomponentes
// ----------------------------------------------------------------------------

function KPI({
  label, value, hint, tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const text =
    tone === 'success' ? 'text-emerald-600' :
    tone === 'warning' ? 'text-red-600' : 'text-slate-800';
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${text}`}>{value}</p>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function Stat({
  label, value, bg, tone = 'default',
}: {
  label: string;
  value: number;
  bg: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const text =
    tone === 'success' ? 'text-emerald-700' :
    tone === 'warning' ? 'text-amber-700' : 'text-slate-800';
  return (
    <div className={`${bg} px-3 py-2.5`}>
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-base font-bold tabular-nums ${text}`}>{value.toLocaleString('es-CL')}</p>
    </div>
  );
}

function DiaRow({ dia }: { dia: JornadaDiaDetalle }) {
  const cortaBg = dia.es_corta ? 'bg-red-50/40' : '';
  const efTone = dia.efectivas >= 8 ? 'text-emerald-700' : dia.efectivas >= 4 ? 'text-slate-800' : 'text-amber-700';
  const pctTone = dia.pct_efectividad >= 70 ? 'text-emerald-600' : dia.pct_efectividad >= 50 ? 'text-amber-600' : 'text-red-600';
  const prodTone = dia.productividad_hora >= 5 ? 'text-emerald-600' : dia.productividad_hora >= 3 ? 'text-slate-700' : 'text-red-600';

  return (
    <tr className={`border-b border-slate-100 hover:bg-slate-50/80 ${cortaBg}`}>
      <td className="px-3 py-1.5 text-slate-700 tabular-nums">{formatFecha(dia.fecha)}</td>
      <td className="px-2 py-1.5 text-slate-500 capitalize">{dia.dia_semana}</td>
      <td className="px-2 py-1.5 text-center">
        <span className="inline-block bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded tabular-nums">{dia.primera_actividad}</span>
      </td>
      <td className="px-2 py-1.5 text-center">
        <span className="inline-block bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded tabular-nums">{dia.ultima_actividad}</span>
      </td>
      <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${dia.es_corta ? 'text-red-600' : 'text-slate-700'}`}>
        {formatDuracion(dia.duracion_min)}
      </td>
      <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">{dia.total_actividades}</td>
      <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">{dia.normales}</td>
      <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">{dia.cnr_falla}</td>
      <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">{dia.cnr_hurto}</td>
      <td className="px-2 py-1.5 text-right text-emerald-700 tabular-nums">{dia.vf_cge}</td>
      <td className="px-2 py-1.5 text-right text-amber-700 tabular-nums">{dia.vf_no_efectivas}</td>
      <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">{dia.mantenimiento}</td>
      <td className={`px-2 py-1.5 text-right font-bold tabular-nums bg-emerald-50/50 ${efTone}`}>{dia.efectivas}</td>
      <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${pctTone}`}>{dia.pct_efectividad.toFixed(0)}%</td>
      <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${prodTone}`}>{dia.productividad_hora.toFixed(1)}</td>
      <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">{dia.kwh > 0 ? dia.kwh.toLocaleString('es-CL') : '—'}</td>
    </tr>
  );
}
