'use client';

import { useEffect, useMemo, useState } from 'react';
import { Filters, AnalisisJornadaMensual as AnalisisJornadaMensualData, JornadaZonaMensual } from '@/types';
import { getAnalisisJornadaMensual } from '@/lib/api/jornada';

interface Props {
  filters: Filters;
}

const formatDuracion = (minutos: number): string => {
  if (!minutos || minutos < 0) return '—';
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

export default function AnalisisJornadaMensual({ filters }: Props) {
  const [data, setData] = useState<AnalisisJornadaMensualData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    setCargando(true);
    setError(null);
    getAnalisisJornadaMensual(filters)
      .then(setData)
      .catch((err) => {
        console.error('Error fetch jornada mensual:', err);
        setError('No se pudo cargar el análisis mensual');
      })
      .finally(() => setCargando(false));
  }, [filters]);

  const zonasFiltradas = useMemo(() => {
    if (!data) return [];
    const term = busqueda.trim().toLowerCase();
    if (!term) return data.por_zona;
    return data.por_zona
      .map((z) => ({
        ...z,
        tecnicos_detalle: z.tecnicos_detalle.filter((t) => t.nombre.toLowerCase().includes(term)),
      }))
      .filter((z) => z.tecnicos_detalle.length > 0);
  }, [data, busqueda]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oca-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-center">
        <div>
          <p className="text-red-500 mb-2">{error}</p>
          <p className="text-[10px] text-slate-300">Intenta seleccionar otro periodo</p>
        </div>
      </div>
    );
  }

  if (!data || data.total_jornadas === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-center">
        <div>
          <p className="text-slate-400 mb-2">No hay datos de jornada en el periodo</p>
          <p className="text-[10px] text-slate-300">Selecciona un mes con inspecciones registradas</p>
        </div>
      </div>
    );
  }

  const sg = data.stats_globales;

  return (
    <div className="space-y-4">
      {/* Subhead con periodo y meta-info */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-700">{data.periodo}</span> ·{' '}
          {data.total_jornadas.toLocaleString('es-CL')} jornadas · {data.total_tecnicos} técnicos · {data.por_zona.length} zonas
        </p>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar técnico…"
          className="text-[11px] px-3 py-1 border border-slate-200 rounded focus:outline-none focus:border-oca-blue w-56"
        />
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI
          label="Jornada promedio"
          value={formatDuracion(sg.duracion_promedio_min)}
          hint="Inicio → fin"
        />
        <KPI
          label="Hora inicio prom."
          value={sg.hora_inicio_promedio}
          hint="Primera actividad"
          tone={parseInt(sg.hora_inicio_promedio.split(':')[0]) <= 9 ? 'success' : 'warning'}
        />
        <KPI
          label="Hora fin prom."
          value={sg.hora_fin_promedio}
          hint="Última actividad"
          tone={parseInt(sg.hora_fin_promedio.split(':')[0]) >= 17 ? 'success' : 'warning'}
        />
        <KPI
          label="Jornadas cortas"
          value={`${sg.jornadas_cortas}`}
          hint={`${sg.pct_jornadas_cortas}% del total · < 6h`}
          tone={sg.pct_jornadas_cortas > 20 ? 'warning' : 'default'}
        />
        <KPI
          label="Productividad/h"
          value={sg.productividad_promedio.toFixed(1)}
          hint="Actividades por hora"
        />
        <KPI
          label="Actividades/jornada"
          value={sg.actividades_promedio_jornada.toFixed(1)}
          hint={`Total ${sg.actividades_total.toLocaleString('es-CL')}`}
        />
      </div>

      {/* Tabla agrupada por zona, expandible */}
      <div className="space-y-3">
        {zonasFiltradas.length === 0 && (
          <div className="bg-white rounded-lg border border-slate-200/60 p-8 text-center text-sm text-slate-400">
            Sin coincidencias para &ldquo;{busqueda}&rdquo;
          </div>
        )}
        {zonasFiltradas.map((zona) => (
          <ZonaCard key={zona.zona} zona={zona} forceOpen={!!busqueda} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Subcomponentes
// ============================================================================

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
    tone === 'warning' ? 'text-amber-600' : 'text-slate-800';
  return (
    <div className="bg-white rounded-lg border border-slate-200/60 p-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${text}`}>{value}</p>
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function ZonaCard({ zona, forceOpen }: { zona: JornadaZonaMensual; forceOpen?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const open = forceOpen || abierto;

  const pctCorto = zona.pct_jornadas_cortas;
  const pctTone = pctCorto > 30 ? 'text-red-600' : pctCorto > 15 ? 'text-amber-600' : 'text-emerald-600';
  const prodTone = zona.productividad_promedio >= 5 ? 'text-emerald-600' : zona.productividad_promedio >= 3 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="w-full bg-slate-800 text-white px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-400 transition-transform" style={{ transform: open ? 'rotate(90deg)' : '' }}>▶</span>
          <span className="font-semibold text-xs">{zona.zona}</span>
          <span className="text-[10px] text-slate-300">
            {zona.tecnicos} {zona.tecnicos === 1 ? 'técnico' : 'técnicos'} · {zona.dias_trabajados} días · {zona.actividades_total.toLocaleString('es-CL')} act.
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <Pill label="Jornada" value={formatDuracion(zona.duracion_promedio_min)} />
          <Pill label="Inicio" value={zona.hora_inicio_promedio} />
          <Pill label="Fin" value={zona.hora_fin_promedio} />
          <Pill label="Prod/h" value={zona.productividad_promedio.toFixed(1)} valueClass={prodTone === 'text-red-600' ? 'text-red-300' : prodTone === 'text-amber-600' ? 'text-amber-300' : 'text-emerald-300'} />
          <Pill label="Cortas" value={`${zona.jornadas_cortas} (${pctCorto}%)`} valueClass={pctTone === 'text-red-600' ? 'text-red-300' : pctTone === 'text-amber-600' ? 'text-amber-300' : 'text-emerald-300'} />
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Técnico</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Días</th>
                <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase text-slate-500">Inicio prom.</th>
                <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase text-slate-500">Fin prom.</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Jornada prom.</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Act. total</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Act/día</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Prod/h</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Cortas</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">% Cortas</th>
              </tr>
            </thead>
            <tbody>
              {zona.tecnicos_detalle.map((t) => {
                const pctTone = t.pct_jornadas_cortas > 30 ? 'text-red-600' : t.pct_jornadas_cortas > 15 ? 'text-amber-600' : 'text-emerald-600';
                const prodTone = t.productividad_promedio >= 5 ? 'text-emerald-600' : t.productividad_promedio >= 3 ? 'text-slate-700' : 'text-red-600';
                return (
                  <tr key={t.nombre} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-3 py-1.5 font-medium text-slate-800 truncate max-w-[200px]" title={t.nombre}>{t.nombre}</td>
                    <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">{t.dias_trabajados}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className="inline-block bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded tabular-nums">
                        {t.hora_inicio_promedio}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span className="inline-block bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded tabular-nums">
                        {t.hora_fin_promedio}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">{formatDuracion(t.duracion_promedio_min)}</td>
                    <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">{t.actividades_total.toLocaleString('es-CL')}</td>
                    <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">{t.actividades_promedio.toFixed(1)}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${prodTone}`}>{t.productividad_promedio.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">{t.jornadas_cortas}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${pctTone}`}>{t.pct_jornadas_cortas}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Pill({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-slate-400">{label}:</span>
      <span className={`font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </span>
  );
}
