'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { TecnicoRanking, DailyStats } from '@/types';

interface ControlMetasProps {
  tecnicos: TecnicoRanking[];
  daily: DailyStats[];
  mesesSeleccionados: string[];
}

// Meta principal para pago
const META_EFECTIVAS_DIA = 8;

type FiltroVista = 'todos' | 'cumplen' | 'no_cumplen';

export default function ControlMetas({ tecnicos, mesesSeleccionados }: ControlMetasProps) {
  const [filtroVista, setFiltroVista] = useState<FiltroVista>('todos');
  const [filtroZona, setFiltroZona] = useState<string>('todas');

  // Información del período
  const periodoInfo = useMemo(() => {
    const hoy = new Date();
    const mesActualNum = hoy.getMonth() + 1;
    const añoActual = hoy.getFullYear();
    const diaActual = hoy.getDate();

    if (!mesesSeleccionados || mesesSeleccionados.length === 0) {
      const diasMes = new Date(añoActual, mesActualNum, 0).getDate();
      return {
        diasPeriodo: diasMes,
        diasTranscurridos: diaActual,
        periodoTexto: `${mesActualNum}/${añoActual}`,
        esPeriodoActual: true
      };
    }

    let totalDias = 0;
    let esMesActual = false;
    let diasTranscurridosTotal = 0;

    mesesSeleccionados.forEach(mes => {
      const partes = mes.split('/');
      if (partes.length === 2) {
        const mesNum = parseInt(partes[0]);
        const año = parseInt(partes[1]);
        const diasDelMes = new Date(año, mesNum, 0).getDate();
        totalDias += diasDelMes;

        if (año === añoActual && mesNum === mesActualNum) {
          esMesActual = true;
          diasTranscurridosTotal += diaActual;
        } else if (año < añoActual || (año === añoActual && mesNum < mesActualNum)) {
          diasTranscurridosTotal += diasDelMes;
        }
      }
    });

    return {
      diasPeriodo: totalDias || 30,
      diasTranscurridos: diasTranscurridosTotal,
      periodoTexto: mesesSeleccionados.length === 1 ? mesesSeleccionados[0] : `${mesesSeleccionados.length} meses`,
      esPeriodoActual: esMesActual && mesesSeleccionados.length === 1
    };
  }, [mesesSeleccionados]);

  // Análisis de brigadas
  const brigadas = useMemo(() => {
    return tecnicos.map(t => {
      const efectivasDia = t.promedio_efectivas;
      const cumpleMeta = efectivasDia >= META_EFECTIVAS_DIA;
      const diferencia = efectivasDia - META_EFECTIVAS_DIA;

      return {
        zona: t.zona,
        nombre: t.nombre,
        diasTrabajados: t.dias_trabajados || 1,
        efectivasDia,
        efectivasTotal: t.efectivas,
        cumpleMeta,
        diferencia,
        cnrDia: t.promedio_cnr,
        kwhTotal: t.kwh_estimado
      };
    }).sort((a, b) => {
      if (a.cumpleMeta && !b.cumpleMeta) return 1;
      if (!a.cumpleMeta && b.cumpleMeta) return -1;
      return a.efectivasDia - b.efectivasDia;
    });
  }, [tecnicos]);

  // Zonas disponibles
  const zonas = useMemo(() => {
    return Array.from(new Set(brigadas.map(b => b.zona))).sort();
  }, [brigadas]);

  // Filtrar brigadas
  const brigadasFiltradas = useMemo(() => {
    return brigadas.filter(b => {
      if (filtroVista === 'cumplen' && !b.cumpleMeta) return false;
      if (filtroVista === 'no_cumplen' && b.cumpleMeta) return false;
      if (filtroZona !== 'todas' && b.zona !== filtroZona) return false;
      return true;
    });
  }, [brigadas, filtroVista, filtroZona]);

  // Agrupar por zona
  const brigadasPorZona = useMemo(() => {
    const grupos: Record<string, typeof brigadasFiltradas> = {};
    brigadasFiltradas.forEach(b => {
      if (!grupos[b.zona]) grupos[b.zona] = [];
      grupos[b.zona].push(b);
    });
    return grupos;
  }, [brigadasFiltradas]);

  // Estadísticas
  const stats = useMemo(() => {
    const total = brigadas.length;
    if (total === 0) return null;

    const cumplen = brigadas.filter(b => b.cumpleMeta).length;
    const noCumplen = total - cumplen;
    const promedioGeneral = brigadas.reduce((a, b) => a + b.efectivasDia, 0) / total;
    const promedioCNR = brigadas.reduce((a, b) => a + b.cnrDia, 0) / total;
    const totalKwh = brigadas.reduce((a, b) => a + b.kwhTotal, 0);

    // Por zona
    const porZona = zonas.map(zona => {
      const brigadasZona = brigadas.filter(b => b.zona === zona);
      const cumplenZona = brigadasZona.filter(b => b.cumpleMeta).length;
      return {
        zona,
        total: brigadasZona.length,
        cumplen: cumplenZona,
        pct: (cumplenZona / brigadasZona.length) * 100
      };
    });

    return {
      total,
      cumplen,
      noCumplen,
      pctCumplen: (cumplen / total) * 100,
      promedioGeneral,
      promedioCNR,
      totalKwh,
      porZona
    };
  }, [brigadas, zonas]);

  if (!stats || brigadas.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">No hay datos disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Control de Metas</h2>
          <p className="text-sm text-slate-500">
            Período: <span className="font-medium text-slate-700">{periodoInfo.periodoTexto}</span>
            {periodoInfo.esPeriodoActual && ` · Día ${periodoInfo.diasTranscurridos} de ${periodoInfo.diasPeriodo}`}
          </p>
        </div>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Meta de Pago</p>
          <p className="text-2xl font-bold text-slate-800">≥{META_EFECTIVAS_DIA}</p>
          <p className="text-[10px] text-slate-400 mt-1">Efectivas/día</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Promedio Efectivas</p>
          <p className={`text-2xl font-bold ${stats.promedioGeneral >= META_EFECTIVAS_DIA ? 'text-green-600' : 'text-red-600'}`}>
            {stats.promedioGeneral.toFixed(1)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">por día</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% Cumplimiento</p>
          <p className={`text-2xl font-bold ${stats.pctCumplen >= 70 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.pctCumplen.toFixed(0)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-1">{stats.cumplen}/{stats.total} brigadas</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Promedio CNR</p>
          <p className="text-2xl font-bold text-slate-800">
            {stats.promedioCNR.toFixed(1)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">por día</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">kWh Total</p>
          <p className="text-2xl font-bold text-slate-800">
            {(stats.totalKwh / 1000).toFixed(0)}k
          </p>
          <p className="text-[10px] text-slate-400 mt-1">recuperados</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Sin Meta</p>
          <p className={`text-2xl font-bold ${stats.noCumplen > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stats.noCumplen}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">brigadas</p>
        </div>
      </div>

      {/* Panel de Control */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cumplimiento de Meta */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Cumplimiento de Meta</h3>
          <p className="text-[9px] text-slate-400 mb-3">Click para filtrar brigadas</p>
          <div className="space-y-3">
            <button
              onClick={() => setFiltroVista(filtroVista === 'cumplen' ? 'todos' : 'cumplen')}
              className={`w-full flex items-center justify-between p-2 rounded transition-colors cursor-pointer group ${
                filtroVista === 'cumplen'
                  ? 'bg-green-100 border border-green-400'
                  : 'bg-green-50 border border-green-200 hover:bg-green-100'
              }`}
            >
              <div className="text-left">
                <p className="text-[10px] text-green-700 uppercase font-medium">Cumplen Meta (≥{META_EFECTIVAS_DIA})</p>
                <p className="text-lg font-bold text-green-700">{stats.cumplen} / {stats.total}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-green-600">
                  {stats.pctCumplen.toFixed(0)}%
                </span>
                <ChevronRight className="w-4 h-4 text-green-500 group-hover:text-green-700" />
              </div>
            </button>

            <button
              onClick={() => setFiltroVista(filtroVista === 'no_cumplen' ? 'todos' : 'no_cumplen')}
              className={`w-full flex items-center justify-between p-2 rounded transition-colors cursor-pointer group ${
                filtroVista === 'no_cumplen'
                  ? 'bg-red-100 border border-red-400'
                  : 'bg-red-50 border border-red-200 hover:bg-red-100'
              }`}
            >
              <div className="text-left">
                <p className="text-[10px] text-red-700 uppercase font-medium">No Cumplen ({'<'}{META_EFECTIVAS_DIA})</p>
                <p className="text-lg font-bold text-red-700">{stats.noCumplen} / {stats.total}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-red-600">
                  {(100 - stats.pctCumplen).toFixed(0)}%
                </span>
                <ChevronRight className="w-4 h-4 text-red-500 group-hover:text-red-700" />
              </div>
            </button>
          </div>
        </div>

        {/* Cumplimiento por Zona */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4 lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Cumplimiento por Zona</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {stats.porZona.map((z) => (
              <button
                key={z.zona}
                onClick={() => setFiltroZona(filtroZona === z.zona ? 'todas' : z.zona)}
                className={`p-3 rounded-lg border transition-all text-left ${
                  filtroZona === z.zona
                    ? 'bg-slate-800 border-slate-800 text-white'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-400'
                }`}
              >
                <p className={`text-[10px] font-medium truncate ${filtroZona === z.zona ? 'text-white/70' : 'text-slate-500'}`}>
                  {z.zona}
                </p>
                <p className={`text-lg font-bold ${
                  filtroZona === z.zona
                    ? 'text-white'
                    : z.pct >= 70 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {z.pct.toFixed(0)}%
                </p>
                <p className={`text-[10px] ${filtroZona === z.zona ? 'text-white/60' : 'text-slate-400'}`}>
                  {z.cumplen}/{z.total}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filtros activos */}
      {(filtroVista !== 'todos' || filtroZona !== 'todas') && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Filtros:</span>
          {filtroVista !== 'todos' && (
            <span className={`text-xs px-2 py-1 rounded ${filtroVista === 'cumplen' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {filtroVista === 'cumplen' ? 'Cumplen meta' : 'No cumplen'}
            </span>
          )}
          {filtroZona !== 'todas' && (
            <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
              {filtroZona}
            </span>
          )}
          <button
            onClick={() => { setFiltroVista('todos'); setFiltroZona('todas'); }}
            className="text-xs text-oca-blue hover:underline"
          >
            Limpiar
          </button>
          <span className="text-xs text-slate-400 ml-auto">
            {brigadasFiltradas.length} de {stats.total} brigadas
          </span>
        </div>
      )}

      {/* Detalle por Zona */}
      <div className="space-y-4">
        {Object.entries(brigadasPorZona).map(([zona, brigadasZona]) => {
          const cumplenZona = brigadasZona.filter(b => b.cumpleMeta).length;
          const pctZona = (cumplenZona / brigadasZona.length) * 100;

          return (
            <div key={zona} className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
              {/* Header de zona */}
              <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between">
                <span className="font-semibold text-sm">{zona}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${pctZona >= 70 ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'}`}>
                  {cumplenZona}/{brigadasZona.length} cumplen ({pctZona.toFixed(0)}%)
                </span>
              </div>

              {/* Tabla */}
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-[9px] font-semibold uppercase text-slate-500">Brigada</th>
                    <th className="px-2 py-2 text-center text-[9px] font-semibold uppercase text-slate-500 w-12">Días</th>
                    <th className="px-2 py-2 text-center text-[9px] font-semibold uppercase text-slate-500 w-16">Q Efect</th>
                    <th className="px-2 py-2 text-center text-[9px] font-semibold uppercase text-slate-500 w-24">
                      Efect/día
                      <span className="block text-[8px] font-normal text-slate-400">Meta ≥8</span>
                    </th>
                    <th className="px-2 py-2 text-center text-[9px] font-semibold uppercase text-slate-500 w-14">CNR/día</th>
                    <th className="px-2 py-2 text-center text-[9px] font-semibold uppercase text-slate-500 w-14">kWh</th>
                    <th className="px-3 py-2 text-center text-[9px] font-semibold uppercase text-slate-500 w-20">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {brigadasZona.map((b, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-slate-50 hover:bg-slate-50 ${!b.cumpleMeta ? 'bg-red-50/40' : ''}`}
                    >
                      <td className="px-3 py-2 text-slate-700 font-medium truncate max-w-[180px]" title={b.nombre}>
                        {b.nombre}
                      </td>
                      <td className="px-2 py-2 text-center text-slate-500">{b.diasTrabajados}</td>
                      <td className="px-2 py-2 text-center font-semibold text-slate-700">{b.efectivasTotal}</td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-sm font-bold ${b.cumpleMeta ? 'text-green-600' : 'text-red-600'}`}>
                            {b.efectivasDia.toFixed(1)}
                          </span>
                          {!b.cumpleMeta && (
                            <span className="text-[9px] text-red-500">falta {Math.abs(b.diferencia).toFixed(1)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center text-slate-600">{b.cnrDia.toFixed(1)}</td>
                      <td className="px-2 py-2 text-center text-slate-600">{(b.kwhTotal / 1000).toFixed(1)}k</td>
                      <td className="px-3 py-2 text-center">
                        {b.cumpleMeta ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-green-600 text-white">
                            CUMPLE
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">
                            NO CUMPLE
                          </span>
                        )}
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
  );
}
