'use client';

import { useMemo, useState } from 'react';
import { PagoTecnico, CalendarioMes } from '@/types';
import { exportPagoExcel } from '@/lib/exportPagoExcel';
import CalendarioBrigadas from './CalendarioBrigadas';

interface ProduccionMensualProps {
  pagoTecnicos: PagoTecnico[];
  mesesSeleccionados?: string[];
  calendarioMes?: CalendarioMes | null;
}

const META_EFECTIVAS_MES = 160;
type FiltroVista = 'todos' | 'cumple' | 'no_cumple';

type VistaDetalle =
  | { tipo: 'tecnico'; tecnico: PagoTecnico }
  | { tipo: 'zona'; zona: string; items: PagoTecnico[] }
  | { tipo: 'global'; items: PagoTecnico[] };

interface ResumenAgregado {
  totalPago: number;
  pagoPotencial: number;
  brechaTotal: number;
  pctBrecha: number;
  efFaltantes: number;
  precioBaseTotal: number;
  efectivasMes: number;
  efectivasHabiles: number;
  efectivasSabado: number;
  normales: number;
  cnrMedida: number;
  cnrIntervencion: number;
  vfCge: number;
  normalesSab: number;
  cnrMedidaSab: number;
  cnrIntervSab: number;
  vfCgeSab: number;
  montoHabil: number;
  montoSabado: number;
  visitasTotalesAprox: number;
  pctEfectividad: number;
  cumplen: number;
  noCumplen: number;
  total: number;
}

const agregar = (items: PagoTecnico[]): ResumenAgregado => {
  const sum = (k: keyof PagoTecnico) => items.reduce((a, t) => a + (t[k] as number), 0);
  const efectivasMes = sum('efectivas_mes');
  const totVis = items.reduce((a, t) => a + (t.pct_efectividad > 0 ? t.efectivas_mes / (t.pct_efectividad / 100) : 0), 0);
  const totalPago = sum('total_pago');
  const pagoPotencial = items.reduce((a, t) => a + t.precio_base + t.monto_sabado, 0);
  const brechaTotal = Math.max(0, pagoPotencial - totalPago);
  const efFaltantes = items.reduce((a, t) => a + computeFaltanteEfHabiles(t), 0);
  return {
    totalPago,
    pagoPotencial,
    brechaTotal,
    pctBrecha: pagoPotencial > 0 ? (brechaTotal / pagoPotencial) * 100 : 0,
    efFaltantes,
    precioBaseTotal: sum('precio_base'),
    efectivasMes,
    efectivasHabiles: sum('efectivas_habiles'),
    efectivasSabado: sum('efectivas_sabado'),
    normales: sum('normales_mes'),
    cnrMedida: sum('cnr_medida_mes'),
    cnrIntervencion: sum('cnr_intervencion_mes'),
    vfCge: sum('vf_cge_mes'),
    normalesSab: sum('normales_sabado'),
    cnrMedidaSab: sum('cnr_medida_sabado'),
    cnrIntervSab: sum('cnr_intervencion_sabado'),
    vfCgeSab: sum('vf_cge_sabado'),
    montoHabil: sum('monto_habil'),
    montoSabado: sum('monto_sabado'),
    visitasTotalesAprox: Math.round(totVis),
    pctEfectividad: totVis > 0 ? (efectivasMes / totVis) * 100 : 0,
    cumplen: items.filter((t) => t.cumple_meta).length,
    noCumplen: items.filter((t) => !t.cumple_meta).length,
    total: items.length,
  };
};

const formatMoney = (v: number) =>
  `$${v.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;

const formatCompact = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return formatMoney(v);
};

// Brecha = (Precio Base + Sábado) − Total a Pago real.
// Equivale a max(0, Precio Base − Monto Hábil): lo que NO se cobró por no topear el monto base.
const computeBrecha = (t: PagoTecnico): number =>
  Math.max(0, t.precio_base + t.monto_sabado - t.total_pago);

const computeFaltanteEfHabiles = (t: PagoTecnico): number =>
  Math.max(0, META_EFECTIVAS_MES - t.efectivas_habiles);


export default function ProduccionMensual({ pagoTecnicos, mesesSeleccionados, calendarioMes }: ProduccionMensualProps) {
  const [vistaActiva, setVistaActiva] = useState<FiltroVista>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [vistaDetalle, setVistaDetalle] = useState<VistaDetalle | null>(null);

  // Aplica búsqueda y filtro de cumplimiento
  const tecnicosFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return pagoTecnicos.filter((t) => {
      if (term && !t.nombre.toLowerCase().includes(term)) return false;
      if (vistaActiva === 'cumple' && !t.cumple_meta) return false;
      if (vistaActiva === 'no_cumple' && t.cumple_meta) return false;
      return true;
    });
  }, [pagoTecnicos, busqueda, vistaActiva]);

  // Agrupa por zona (para grid de tarjetas)
  const { porZona, zonasOrdenadas } = useMemo(() => {
    const map: Record<string, PagoTecnico[]> = {};
    tecnicosFiltrados.forEach((t) => {
      const k = t.zona || '(sin zona)';
      if (!map[k]) map[k] = [];
      map[k].push(t);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => b.total_pago - a.total_pago));
    const ordenadas = Object.keys(map).sort();
    return { porZona: map, zonasOrdenadas: ordenadas };
  }, [tecnicosFiltrados]);

  // KPIs globales (sobre el total sin filtros para contexto general)
  const stats = useMemo(() => agregar(pagoTecnicos), [pagoTecnicos]);

  // Estadísticas por zona (para header de cada tarjeta y para el panel de brecha)
  const statsPorZona = useMemo(() => {
    const r: Record<string, { total: number; cumplen: number; noCumplen: number; pago: number; brecha: number; pagoPotencial: number; efFaltantes: number }> = {};
    Object.entries(porZona).forEach(([zona, items]) => {
      const pago = items.reduce((a, b) => a + b.total_pago, 0);
      const pagoPotencial = items.reduce((a, b) => a + b.precio_base + b.monto_sabado, 0);
      r[zona] = {
        total: items.length,
        cumplen: items.filter((i) => i.cumple_meta).length,
        noCumplen: items.filter((i) => !i.cumple_meta).length,
        pago,
        pagoPotencial,
        brecha: Math.max(0, pagoPotencial - pago),
        efFaltantes: items.reduce((a, b) => a + computeFaltanteEfHabiles(b), 0),
      };
    });
    return r;
  }, [porZona]);

  // Top técnicos con mayor brecha (sobre el conjunto filtrado)
  const topBrecha = useMemo(() => {
    return [...tecnicosFiltrados]
      .map((t) => ({ ...t, brecha: computeBrecha(t), faltan: computeFaltanteEfHabiles(t) }))
      .filter((t) => t.brecha > 0)
      .sort((a, b) => b.brecha - a.brecha)
      .slice(0, 10);
  }, [tecnicosFiltrados]);

  // Brecha por zona (ordenada para el panel)
  const brechaPorZona = useMemo(() => {
    return Object.entries(statsPorZona)
      .map(([zona, s]) => ({ zona, ...s, pctBrecha: s.pagoPotencial > 0 ? (s.brecha / s.pagoPotencial) * 100 : 0 }))
      .filter((z) => z.brecha > 0)
      .sort((a, b) => b.brecha - a.brecha);
  }, [statsPorZona]);

  const maxBrechaZona = brechaPorZona[0]?.brecha ?? 0;
  const maxBrechaTec = topBrecha[0]?.brecha ?? 0;

  // Lista plana de técnicos visibles (para navegación en el modal)
  const flat = useMemo(
    () => zonasOrdenadas.flatMap((z) => porZona[z]),
    [zonasOrdenadas, porZona]
  );

  const navegarTecnico = (dir: 'anterior' | 'siguiente') => {
    if (!vistaDetalle || vistaDetalle.tipo !== 'tecnico' || flat.length === 0) return;
    const actual = vistaDetalle.tecnico;
    const i = flat.findIndex((t) => t.nombre === actual.nombre);
    if (i === -1) return;
    const next = dir === 'anterior'
      ? (i === 0 ? flat.length - 1 : i - 1)
      : (i === flat.length - 1 ? 0 : i + 1);
    setVistaDetalle({ tipo: 'tecnico', tecnico: flat[next] });
  };

  const periodo = mesesSeleccionados && mesesSeleccionados.length > 0
    ? mesesSeleccionados.map((m) => m[0].toUpperCase() + m.slice(1)).join(', ')
    : 'Todo el período';

  if (pagoTecnicos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400 text-sm">No hay datos de pago disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Producción y Pago Mensual</h2>
          <p className="text-sm text-slate-500">
            Meta {META_EFECTIVAS_MES} efectivas · OCA Global · 1F · {periodo}
          </p>
        </div>
        <button
          onClick={() => exportPagoExcel(tecnicosFiltrados, { scope: 'global', periodo, calendarioMes })}
          className="text-[11px] px-3 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          Descargar Excel
        </button>
      </div>

      {/* 5 KPIs estilo Control de Metas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button
          onClick={() => setVistaDetalle({ tipo: 'global', items: tecnicosFiltrados })}
          className="bg-white rounded-lg border border-slate-200/60 p-4 text-left hover:border-slate-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            Total a Pago
            <span className="text-slate-300 group-hover:text-oca-blue text-[12px]">↗</span>
          </p>
          <p className="text-3xl font-bold text-slate-800">{formatCompact(stats.totalPago)}</p>
          <p className="text-xs text-slate-500 mt-1">{formatMoney(stats.totalPago)}</p>
        </button>
        <button
          onClick={() => setVistaDetalle({ tipo: 'global', items: tecnicosFiltrados })}
          className="bg-white rounded-lg border border-red-200 p-4 text-left hover:border-red-400 hover:shadow-sm transition-all cursor-pointer group"
          title="Lo que NO se está pagando por no topear el monto base mensual"
        >
          <p className="text-[10px] uppercase tracking-wider text-red-500 mb-1 flex items-center justify-between">
            Brecha No Pagada
            <span className="text-red-300 group-hover:text-red-500 text-[12px]">↗</span>
          </p>
          <p className="text-3xl font-bold text-red-600">{formatCompact(stats.brechaTotal)}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.pctBrecha.toFixed(1)}% del potencial</p>
        </button>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% Cumplen Meta</p>
          <p className={`text-3xl font-bold ${stats.pctEfectividad === 0 ? 'text-slate-600' : (stats.cumplen / stats.total) * 100 >= 70 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.total > 0 ? ((stats.cumplen / stats.total) * 100).toFixed(0) : 0}%
          </p>
          <p className="text-xs text-slate-500 mt-1">{stats.cumplen} de {stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Efectivas Faltantes</p>
          <p className="text-3xl font-bold text-amber-600">{stats.efFaltantes.toLocaleString('es-CL')}</p>
          <p className="text-xs text-slate-500 mt-1">para topear monto hábil</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Estado Técnicos</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setVistaActiva(vistaActiva === 'no_cumple' ? 'todos' : 'no_cumple')}
              className={`text-center cursor-pointer transition-opacity ${vistaActiva === 'no_cumple' ? '' : 'opacity-60 hover:opacity-100'}`}
            >
              <p className="text-2xl font-bold text-red-600">{stats.noCumplen}</p>
              <p className="text-[10px] text-slate-500">No cumplen</p>
            </button>
            <button
              onClick={() => setVistaActiva(vistaActiva === 'cumple' ? 'todos' : 'cumple')}
              className={`text-center cursor-pointer transition-opacity ${vistaActiva === 'cumple' ? '' : 'opacity-60 hover:opacity-100'}`}
            >
              <p className="text-2xl font-bold text-green-600">{stats.cumplen}</p>
              <p className="text-[10px] text-slate-500">Cumplen</p>
            </button>
          </div>
        </div>
      </div>

      {/* Análisis de Brecha — sección dedicada */}
      {(brechaPorZona.length > 0 || topBrecha.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Brecha por Zona */}
          <div className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
            <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between">
              <span className="font-semibold text-xs">Brecha por Zona</span>
              <span className="text-[10px] text-slate-300">Lo NO pagado por zona</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Zona</th>
                    <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Téc</th>
                    <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">NoCum</th>
                    <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Brecha</th>
                    <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase text-slate-500 w-32">% Pot</th>
                  </tr>
                </thead>
                <tbody>
                  {brechaPorZona.map((z) => (
                    <tr
                      key={z.zona}
                      onClick={() => setVistaDetalle({ tipo: 'zona', zona: z.zona, items: porZona[z.zona] })}
                      className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer"
                    >
                      <td className="px-3 py-1.5 text-slate-700 truncate max-w-[180px]" title={z.zona}>{z.zona}</td>
                      <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">{z.total}</td>
                      <td className="px-2 py-1.5 text-right text-red-500 tabular-nums">{z.noCumplen}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-red-600 tabular-nums whitespace-nowrap">{formatCompact(z.brecha)}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-500 rounded-full"
                              style={{ width: `${maxBrechaZona > 0 ? (z.brecha / maxBrechaZona) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 tabular-nums w-8 text-right">{z.pctBrecha.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                  <tr>
                    <td className="px-3 py-2 font-bold text-slate-800">TOTAL</td>
                    <td className="px-2 py-2 text-right font-bold text-slate-800">{stats.total}</td>
                    <td className="px-2 py-2 text-right font-bold text-red-600">{stats.noCumplen}</td>
                    <td className="px-2 py-2 text-right font-bold text-red-600 whitespace-nowrap">{formatCompact(stats.brechaTotal)}</td>
                    <td className="px-2 py-2 text-right text-[11px] font-semibold text-slate-600">{stats.pctBrecha.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Top 10 Técnicos con mayor brecha */}
          <div className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
            <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between">
              <span className="font-semibold text-xs">Top Técnicos con Mayor Brecha</span>
              <span className="text-[10px] text-slate-300">Click para detalle</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Técnico</th>
                    <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Zona</th>
                    <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">EfH</th>
                    <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Faltan</th>
                    <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Brecha</th>
                  </tr>
                </thead>
                <tbody>
                  {topBrecha.map((t, idx) => (
                    <tr
                      key={`brecha-${t.nombre}-${idx}`}
                      onClick={() => setVistaDetalle({ tipo: 'tecnico', tecnico: t })}
                      className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer"
                    >
                      <td className="px-3 py-1.5 text-slate-700 truncate max-w-[180px]" title={t.nombre}>{t.nombre}</td>
                      <td className="px-2 py-1.5 text-slate-500 truncate max-w-[120px]" title={t.zona}>{t.zona.replace(/^\d+\.\s*/, '')}</td>
                      <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">{t.efectivas_habiles}</td>
                      <td className="px-2 py-1.5 text-right text-amber-600 tabular-nums">{t.faltan}</td>
                      <td className="px-2 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-500 rounded-full"
                              style={{ width: `${maxBrechaTec > 0 ? (t.brecha / maxBrechaTec) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="font-bold text-red-600 tabular-nums whitespace-nowrap">{formatCompact(t.brecha)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {topBrecha.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-[11px] text-slate-400">
                        No hay técnicos con brecha en este conjunto.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Calendario Operativo de Brigadas */}
      {calendarioMes && pagoTecnicos.some((t) => t.dias_trabajados_count > 0) && (
        <CalendarioBrigadas
          pagoTecnicos={tecnicosFiltrados}
          calendario={calendarioMes}
        />
      )}

      {/* Búsqueda + filtro activo */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar técnico..."
          className="text-[11px] px-3 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-oca-blue w-64"
        />
        {vistaActiva !== 'todos' && (
          <>
            <span className={`text-sm px-3 py-1 rounded font-medium ${
              vistaActiva === 'cumple' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {vistaActiva === 'cumple' ? 'Cumplen Meta' : 'No Cumplen Meta'}
            </span>
            <button
              onClick={() => setVistaActiva('todos')}
              className="text-sm text-slate-400 hover:text-slate-600"
            >
              Ver todos
            </button>
          </>
        )}
        <span className="text-[10px] text-slate-400 ml-auto">
          Mostrando {tecnicosFiltrados.length} de {pagoTecnicos.length} técnicos
        </span>
      </div>

      {/* Grid de tarjetas por zona */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {zonasOrdenadas.map((zona) => {
          const items = porZona[zona];
          const z = statsPorZona[zona];
          const pctCumpleZona = z.total > 0 ? (z.cumplen / z.total) * 100 : 0;

          return (
            <div key={zona} className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
              <button
                onClick={() => setVistaDetalle({ tipo: 'zona', zona, items })}
                className="w-full bg-slate-800 text-white px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors text-left"
              >
                <span className="font-semibold text-xs truncate">{zona}</span>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className={pctCumpleZona >= 70 ? 'text-green-300' : 'text-red-300'}>
                    {pctCumpleZona.toFixed(0)}%
                  </span>
                  {z.brecha > 0 && (
                    <>
                      <span className="text-slate-400">·</span>
                      <span className="text-red-300" title="Brecha no pagada">−{formatCompact(z.brecha)}</span>
                    </>
                  )}
                  <span className="text-slate-300">·</span>
                  <span className="text-white font-bold">{formatCompact(z.pago)}</span>
                  <span className="text-slate-400 ml-1">↗</span>
                </div>
              </button>
              <div className="overflow-x-auto overflow-y-auto max-h-[260px]">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Brigada</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Efect</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Sáb</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">%</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((t, idx) => (
                      <tr
                        key={`${zona}-${t.nombre}-${idx}`}
                        onClick={() => setVistaDetalle({ tipo: 'tecnico', tecnico: t })}
                        className={`border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer ${
                          !t.cumple_meta ? 'bg-red-50/30' : ''
                        }`}
                      >
                        <td className="px-3 py-1.5 text-[11px] text-slate-800 truncate max-w-[140px]" title={t.nombre}>
                          {t.nombre}
                        </td>
                        <td className={`px-2 py-1.5 text-[11px] text-right font-semibold ${t.cumple_meta ? 'text-green-600' : 'text-slate-700'}`}>
                          {t.efectivas_mes}
                        </td>
                        <td className="px-2 py-1.5 text-[11px] text-right text-slate-500">{t.efectivas_sabado}</td>
                        <td className={`px-2 py-1.5 text-[11px] text-right ${
                          t.pct_efectividad >= 70 ? 'text-green-600' :
                          t.pct_efectividad >= 50 ? 'text-amber-600' : 'text-red-500'
                        }`}>
                          {t.pct_efectividad.toFixed(0)}%
                        </td>
                        <td className="px-2 py-1.5 text-[11px] text-right font-bold text-slate-800 whitespace-nowrap">
                          {formatCompact(t.total_pago)}
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

      {/* Modal Detalle de Pago - Técnico / Zona / Global */}
      {vistaDetalle && (
        <DetalleModal
          vista={vistaDetalle}
          onClose={() => setVistaDetalle(null)}
          onNavegar={navegarTecnico}
          onSeleccionarTecnico={(t) => setVistaDetalle({ tipo: 'tecnico', tecnico: t })}
          periodo={periodo}
          calendarioMes={calendarioMes}
        />
      )}
    </div>
  );
}

// =============================================================================
// MODAL UNIFICADO (técnico / zona / global)
// =============================================================================

interface DetalleModalProps {
  vista: VistaDetalle;
  onClose: () => void;
  onNavegar: (dir: 'anterior' | 'siguiente') => void;
  onSeleccionarTecnico: (t: PagoTecnico) => void;
  periodo?: string;
  calendarioMes?: CalendarioMes | null;
}

function DetalleModal({ vista, onClose, onNavegar, onSeleccionarTecnico, periodo, calendarioMes }: DetalleModalProps) {
  const isTecnico = vista.tipo === 'tecnico';

  // Header data
  let titulo = '';
  let subtitulo = '';
  let badge: { texto: string; clase: string } | null = null;

  if (vista.tipo === 'tecnico') {
    titulo = vista.tecnico.nombre;
    subtitulo = `${vista.tecnico.zona} · ${vista.tecnico.comuna}`;
    badge = vista.tecnico.cumple_meta
      ? { texto: 'Cumple Meta', clase: 'bg-green-500/20 text-green-300' }
      : { texto: 'No Cumple Meta', clase: 'bg-red-500/20 text-red-300' };
  } else if (vista.tipo === 'zona') {
    titulo = vista.zona;
    subtitulo = `${vista.items.length} técnicos · OCA Global · 1F`;
  } else {
    titulo = 'Resumen Global';
    subtitulo = `${vista.items.length} técnicos · Todas las zonas`;
  }

  // Datos para vistas agregadas
  const items = vista.tipo === 'tecnico' ? [vista.tecnico] : vista.items;
  const resumen = useMemo(() => agregar(items), [items]);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header del modal */}
        <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <span className="font-semibold truncate">{titulo}</span>
            <span className="text-xs text-slate-300 truncate">{subtitulo}</span>
            {badge && (
              <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${badge.clase}`}>
                {badge.texto}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!isTecnico && (
              <button
                onClick={() => exportPagoExcel(items, {
                  scope: vista.tipo === 'zona' ? 'zona' : 'global',
                  zonaNombre: vista.tipo === 'zona' ? vista.zona : '',
                  periodo,
                  calendarioMes,
                })}
                className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors flex items-center gap-1.5 border-r border-slate-600 pr-3"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                Excel
              </button>
            )}
            {isTecnico && (
              <div className="flex items-center gap-1 border-r border-slate-600 pr-3">
                <button
                  onClick={() => onNavegar('anterior')}
                  className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => onNavegar('siguiente')}
                  className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)] space-y-4">
          {/* Chips identidad solo para técnico */}
          {vista.tipo === 'tecnico' && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded">EECC: <b>{vista.tecnico.eecc}</b></span>
              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded">{vista.tecnico.ctta_tusan}</span>
              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded">Brigada: <b>{vista.tecnico.tipo_brigada}</b></span>
              {vista.tecnico.regional && (
                <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded">Regional: <b>{vista.tecnico.regional}</b></span>
              )}
              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded">Zona Precios: <b>{vista.tecnico.zona_precios}</b></span>
            </div>
          )}

          {/* KPIs principales */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total a Pago</p>
              <p className="text-xl font-bold text-slate-800">{formatCompact(resumen.totalPago)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{formatMoney(resumen.totalPago)}</p>
            </div>
            <div className={`rounded-lg p-3 ${resumen.brechaTotal > 0 ? 'bg-red-50 border border-red-100' : 'bg-slate-50'}`}>
              <p className="text-[10px] uppercase tracking-wider text-red-500 mb-1">Brecha No Pagada</p>
              <p className={`text-xl font-bold ${resumen.brechaTotal > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                {formatCompact(resumen.brechaTotal)}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">{resumen.pctBrecha.toFixed(1)}% del potencial</p>
            </div>
            {isTecnico ? (
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Precio Base</p>
                <p className="text-xl font-bold text-slate-700">{formatCompact((vista as { tipo: 'tecnico'; tecnico: PagoTecnico }).tecnico.precio_base)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">por {META_EFECTIVAS_MES} efect.</p>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Técnicos</p>
                <p className="text-xl font-bold text-slate-800">{resumen.total}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  <span className="text-green-600">{resumen.cumplen}</span> · <span className="text-red-500">{resumen.noCumplen}</span>
                </p>
              </div>
            )}
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Efectivas Mes</p>
              <p className="text-xl font-bold text-slate-800">{resumen.efectivasMes.toLocaleString('es-CL')}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">meta {META_EFECTIVAS_MES}/téc</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Ef. Faltantes</p>
              <p className="text-xl font-bold text-amber-600">{resumen.efFaltantes.toLocaleString('es-CL')}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">para topear hábil</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% Efectividad</p>
              <p className={`text-xl font-bold ${
                resumen.pctEfectividad >= 70 ? 'text-green-600' :
                resumen.pctEfectividad >= 50 ? 'text-amber-600' : 'text-red-500'
              }`}>
                {resumen.pctEfectividad.toFixed(0)}%
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">de visitas</p>
            </div>
          </div>

          {/* Avance hacia la meta (solo técnico) */}
          {vista.tipo === 'tecnico' && (
            <div className="bg-white border border-slate-200/60 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">Avance a Meta</span>
                <span className="text-[11px] text-slate-500">
                  {vista.tecnico.efectivas_mes} / {META_EFECTIVAS_MES} efectivas
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${vista.tecnico.cumple_meta ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, (vista.tecnico.efectivas_mes / META_EFECTIVAS_MES) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Desglose por categoría */}
          <div className="bg-white border border-slate-200/60 rounded-lg overflow-hidden">
            <div className="bg-slate-800 text-white px-3 py-2">
              <span className="font-semibold text-xs">Desglose por Categoría</span>
            </div>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Categoría</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Mes</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Hábiles</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Sábado</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { label: 'Normales', mes: resumen.normales, sab: resumen.normalesSab },
                  { label: 'CNR Medida', mes: resumen.cnrMedida, sab: resumen.cnrMedidaSab },
                  { label: 'CNR Intervención', mes: resumen.cnrIntervencion, sab: resumen.cnrIntervSab },
                  { label: 'VF CGE', mes: resumen.vfCge, sab: resumen.vfCgeSab },
                ]).map((row) => (
                  <tr key={row.label} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-slate-700">{row.label}</td>
                    <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{row.mes.toLocaleString('es-CL')}</td>
                    <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{(row.mes - row.sab).toLocaleString('es-CL')}</td>
                    <td className="px-3 py-2 text-right text-slate-500 tabular-nums">{row.sab.toLocaleString('es-CL')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <td className="px-3 py-2 font-semibold text-slate-800">Efectivas</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800 tabular-nums">{resumen.efectivasMes.toLocaleString('es-CL')}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800 tabular-nums">{resumen.efectivasHabiles.toLocaleString('es-CL')}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800 tabular-nums">{resumen.efectivasSabado.toLocaleString('es-CL')}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Cálculo de Pago */}
          <div className="bg-white border border-slate-200/60 rounded-lg overflow-hidden">
            <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between">
              <span className="font-semibold text-xs">Cálculo del Pago</span>
              {vista.tipo === 'tecnico' && (
                <span className="text-[10px] text-slate-300">
                  Valor por efectiva: {formatMoney(Math.round(vista.tecnico.precio_base / META_EFECTIVAS_MES))}
                </span>
              )}
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="border border-slate-200/60 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Monto Hábil</p>
                <p className="text-xl font-bold text-slate-800 mt-1">{formatMoney(resumen.montoHabil)}</p>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                  {vista.tipo === 'tecnico'
                    ? <>Base × ({vista.tecnico.efectivas_habiles}/{META_EFECTIVAS_MES})</>
                    : <>Suma de {resumen.total} técnicos</>}
                </p>
              </div>
              <div className="border border-slate-200/60 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Monto Sábado</p>
                <p className="text-xl font-bold text-slate-800 mt-1">{formatMoney(resumen.montoSabado)}</p>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                  {vista.tipo === 'tecnico'
                    ? <>(Base/{META_EFECTIVAS_MES}) × {vista.tecnico.efectivas_sabado}</>
                    : <>Suma de {resumen.total} técnicos</>}
                </p>
              </div>
              <div className="border-2 border-slate-800 rounded-lg p-3 bg-slate-50">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Total a Pago</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(resumen.totalPago)}</p>
                <p className="text-[10px] text-slate-500 mt-1">Hábil + Sábado</p>
              </div>
            </div>
          </div>

          {/* Tabla de técnicos (solo en zona/global) */}
          {!isTecnico && (
            <div className="bg-white border border-slate-200/60 rounded-lg overflow-hidden">
              <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between">
                <span className="font-semibold text-xs">Detalle de Técnicos</span>
                <span className="text-[10px] text-slate-300">{items.length} técnicos · click para ver detalle</span>
              </div>
              <div className="overflow-x-auto max-h-[360px]">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Técnico</th>
                      {vista.tipo === 'global' && (
                        <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Zona</th>
                      )}
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Norm</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">CNR M</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">CNR I</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">VF CGE</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Efect</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Sáb</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">%</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Hábil</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Sábado</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Total</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-red-500">Brecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((t, idx) => {
                      const brecha = computeBrecha(t);
                      return (
                      <tr
                        key={`detail-${t.nombre}-${idx}`}
                        onClick={() => onSeleccionarTecnico(t)}
                        className={`border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer ${
                          !t.cumple_meta ? 'bg-red-50/30' : ''
                        }`}
                      >
                        <td className="px-3 py-1.5 text-slate-800 truncate max-w-[180px]" title={t.nombre}>{t.nombre}</td>
                        {vista.tipo === 'global' && (
                          <td className="px-2 py-1.5 text-slate-600 truncate max-w-[140px]" title={t.zona}>{t.zona}</td>
                        )}
                        <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">{t.normales_mes}</td>
                        <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">{t.cnr_medida_mes}</td>
                        <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">{t.cnr_intervencion_mes}</td>
                        <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">{t.vf_cge_mes}</td>
                        <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${t.cumple_meta ? 'text-green-600' : 'text-slate-700'}`}>
                          {t.efectivas_mes}
                        </td>
                        <td className="px-2 py-1.5 text-right text-slate-500 tabular-nums">{t.efectivas_sabado}</td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${
                          t.pct_efectividad >= 70 ? 'text-green-600' :
                          t.pct_efectividad >= 50 ? 'text-amber-600' : 'text-red-500'
                        }`}>
                          {t.pct_efectividad.toFixed(0)}%
                        </td>
                        <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">{formatCompact(t.monto_habil)}</td>
                        <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">{formatCompact(t.monto_sabado)}</td>
                        <td className="px-2 py-1.5 text-right font-bold text-slate-800 tabular-nums whitespace-nowrap">{formatMoney(t.total_pago)}</td>
                        <td className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${brecha > 0 ? 'font-bold text-red-600' : 'text-slate-300'}`}>
                          {brecha > 0 ? `−${formatCompact(brecha)}` : '—'}
                        </td>
                      </tr>
                    );})}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-300 sticky bottom-0">
                    <tr>
                      <td className="px-3 py-2 font-bold text-slate-800" colSpan={vista.tipo === 'global' ? 6 : 5}>
                        TOTAL ({items.length})
                      </td>
                      <td className="px-2 py-2 text-right font-bold text-slate-800 tabular-nums">{resumen.efectivasMes.toLocaleString('es-CL')}</td>
                      <td className="px-2 py-2 text-right font-bold text-slate-800 tabular-nums">{resumen.efectivasSabado.toLocaleString('es-CL')}</td>
                      <td className="px-2 py-2 text-right font-bold text-slate-800 tabular-nums">{resumen.pctEfectividad.toFixed(0)}%</td>
                      <td className="px-2 py-2 text-right font-bold text-slate-800 tabular-nums">{formatCompact(resumen.montoHabil)}</td>
                      <td className="px-2 py-2 text-right font-bold text-slate-800 tabular-nums">{formatCompact(resumen.montoSabado)}</td>
                      <td className="px-2 py-2 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">{formatMoney(resumen.totalPago)}</td>
                      <td className="px-2 py-2 text-right font-bold text-red-600 tabular-nums whitespace-nowrap">
                        {resumen.brechaTotal > 0 ? `−${formatCompact(resumen.brechaTotal)}` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
