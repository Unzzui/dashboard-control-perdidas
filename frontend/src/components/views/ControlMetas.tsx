'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { TecnicoRanking, DailyStats } from '@/types';

interface ControlMetasProps {
  tecnicos: TecnicoRanking[];
  daily: DailyStats[];
  mesesSeleccionados: string[];
}

// Metas de pago
const META_EFECTIVAS_MES = 160;  // Meta mensual
const META_EFECTIVAS_DIA = 8;    // 160/20 días hábiles = 8 efectivas/día
const DIAS_HABILES_MES = 20;     // Días hábiles estimados por mes

type FiltroVista = 'todos' | 'cumplen' | 'no_cumplen' | 'en_camino' | 'no_alcanzara';
type EstadoMeta = 'cumplida' | 'en_camino' | 'no_alcanzara';

export default function ControlMetas({ tecnicos, mesesSeleccionados }: ControlMetasProps) {
  const [filtroVista, setFiltroVista] = useState<FiltroVista>('todos');
  const [filtroZona, setFiltroZona] = useState<string>('todas');

  // Información del período
  const periodoInfo = useMemo(() => {
    const hoy = new Date();
    const mesActualNum = hoy.getMonth(); // 0-indexed
    const añoActual = hoy.getFullYear();
    const diaActual = hoy.getDate();
    const diasDelMesActual = new Date(añoActual, mesActualNum + 1, 0).getDate();

    // Nombres de meses para comparar
    const MESES_NOMBRES = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const mesActualNombre = MESES_NOMBRES[mesActualNum];

    // Calcular días hábiles transcurridos y restantes del mes actual
    // Aproximación: ~70% de los días son hábiles (5/7)
    const diasHabilesTranscurridos = Math.round(diaActual * 0.7);
    const diasHabilesRestantesMes = Math.max(0, DIAS_HABILES_MES - diasHabilesTranscurridos);

    if (!mesesSeleccionados || mesesSeleccionados.length === 0) {
      return {
        diasPeriodo: diasDelMesActual,
        diasTranscurridos: diaActual,
        diasHabilesTranscurridos,
        diasHabilesRestantes: diasHabilesRestantesMes,
        periodoTexto: `${mesActualNombre}`,
        esPeriodoActual: true
      };
    }

    // Verificar si el mes seleccionado es el mes actual
    const mesSeleccionado = mesesSeleccionados[0]?.toLowerCase();
    const esMesActual = mesesSeleccionados.length === 1 && mesSeleccionado === mesActualNombre;

    // Si es el mes actual, usar días restantes calculados
    // Si es un mes pasado, no quedan días
    const diasHabilesRestantes = esMesActual ? diasHabilesRestantesMes : 0;

    return {
      diasPeriodo: diasDelMesActual,
      diasTranscurridos: esMesActual ? diaActual : diasDelMesActual,
      diasHabilesTranscurridos: esMesActual ? diasHabilesTranscurridos : DIAS_HABILES_MES,
      diasHabilesRestantes,
      periodoTexto: mesesSeleccionados.length === 1 ? mesesSeleccionados[0] : `${mesesSeleccionados.length} meses`,
      esPeriodoActual: esMesActual
    };
  }, [mesesSeleccionados]);

  // Análisis de brigadas con proyección
  const brigadas = useMemo(() => {
    // Días hábiles restantes del mes (del calendario, no de la brigada)
    const diasRestantesMes = periodoInfo.diasHabilesRestantes;

    return tecnicos.map(t => {
      const efectivasDia = t.promedio_efectivas;
      const efectivasTotal = t.efectivas;
      const diasTrabajados = t.dias_trabajados || 1;

      // Proyección a fin de mes: acumulado actual + (promedio diario * días hábiles restantes del mes)
      const proyeccion = Math.round(efectivasTotal + (efectivasDia * diasRestantesMes));

      // Determinar estado de meta
      let estadoMeta: EstadoMeta;
      if (efectivasTotal >= META_EFECTIVAS_MES) {
        // Ya alcanzó las 160
        estadoMeta = 'cumplida';
      } else if (diasRestantesMes > 0 && proyeccion >= META_EFECTIVAS_MES) {
        // Aún hay días en el mes y la proyección alcanza la meta
        estadoMeta = 'en_camino';
      } else {
        // No hay días restantes o la proyección no alcanza
        estadoMeta = 'no_alcanzara';
      }

      // Cumple promedio diario (para referencia)
      const cumplePromedio = efectivasDia >= META_EFECTIVAS_DIA;
      const diferencia = efectivasDia - META_EFECTIVAS_DIA;

      // Cuántas faltan para la meta
      const faltanParaMeta = Math.max(0, META_EFECTIVAS_MES - efectivasTotal);

      return {
        zona: t.zona,
        nombre: t.nombre,
        diasTrabajados,
        efectivasDia,
        efectivasTotal,
        proyeccion,
        estadoMeta,
        cumplePromedio,
        diferencia,
        faltanParaMeta,
        cnrDia: t.promedio_cnr,
        kwhTotal: t.kwh_estimado
      };
    }).sort((a, b) => {
      // Ordenar: cumplidas > en_camino > no_alcanzara, luego por efectivas
      const orden = { cumplida: 0, en_camino: 1, no_alcanzara: 2 };
      if (orden[a.estadoMeta] !== orden[b.estadoMeta]) {
        return orden[a.estadoMeta] - orden[b.estadoMeta];
      }
      return b.efectivasTotal - a.efectivasTotal;
    });
  }, [tecnicos, periodoInfo.diasHabilesRestantes]);

  // Zonas disponibles
  const zonas = useMemo(() => {
    return Array.from(new Set(brigadas.map(b => b.zona))).sort();
  }, [brigadas]);

  // Filtrar brigadas
  const brigadasFiltradas = useMemo(() => {
    return brigadas.filter(b => {
      if (filtroVista === 'cumplen' && b.estadoMeta !== 'cumplida') return false;
      if (filtroVista === 'en_camino' && b.estadoMeta !== 'en_camino') return false;
      if (filtroVista === 'no_alcanzara' && b.estadoMeta !== 'no_alcanzara') return false;
      if (filtroVista === 'no_cumplen' && b.estadoMeta === 'cumplida') return false;
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

    const cumplidas = brigadas.filter(b => b.estadoMeta === 'cumplida').length;
    const enCamino = brigadas.filter(b => b.estadoMeta === 'en_camino').length;
    const noAlcanzara = brigadas.filter(b => b.estadoMeta === 'no_alcanzara').length;

    const promedioGeneral = brigadas.reduce((a, b) => a + b.efectivasDia, 0) / total;
    const promedioCNR = brigadas.reduce((a, b) => a + b.cnrDia, 0) / total;
    const totalKwh = brigadas.reduce((a, b) => a + b.kwhTotal, 0);
    const totalEfectivas = brigadas.reduce((a, b) => a + b.efectivasTotal, 0);
    const promedioProyeccion = brigadas.reduce((a, b) => a + b.proyeccion, 0) / total;

    // Promedio de días trabajados
    const promedioDiasTrabajados = brigadas.reduce((a, b) => a + b.diasTrabajados, 0) / total;

    // Brigadas que cumplen o están en camino a cumplir
    const cumpliranMeta = cumplidas + enCamino;

    // Por zona
    const porZona = zonas.map(zona => {
      const brigadasZona = brigadas.filter(b => b.zona === zona);
      const cumplidasZona = brigadasZona.filter(b => b.estadoMeta === 'cumplida').length;
      const enCaminoZona = brigadasZona.filter(b => b.estadoMeta === 'en_camino').length;
      return {
        zona,
        total: brigadasZona.length,
        cumplidas: cumplidasZona,
        enCamino: enCaminoZona,
        cumpliranMeta: cumplidasZona + enCaminoZona,
        pct: ((cumplidasZona + enCaminoZona) / brigadasZona.length) * 100
      };
    });

    return {
      total,
      cumplidas,
      enCamino,
      noAlcanzara,
      cumpliranMeta,
      pctCumpliran: (cumpliranMeta / total) * 100,
      promedioGeneral,
      promedioProyeccion,
      promedioCNR,
      promedioDiasTrabajados,
      totalKwh,
      totalEfectivas,
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white rounded-lg border border-slate-200/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Meta Mensual</p>
          <p className="text-2xl font-bold text-slate-800">{META_EFECTIVAS_MES}</p>
          <p className="text-[10px] text-slate-400 mt-1">{META_EFECTIVAS_DIA} efect/día</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Prom Efect/día</p>
          <p className={`text-2xl font-bold ${stats.promedioGeneral >= META_EFECTIVAS_DIA ? 'text-green-600' : 'text-red-600'}`}>
            {stats.promedioGeneral.toFixed(1)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">efectivas</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Prom CNR/día</p>
          <p className="text-2xl font-bold text-slate-800">
            {stats.promedioCNR.toFixed(1)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">por brigada</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Ya Cumplieron</p>
          <p className="text-2xl font-bold text-green-600">{stats.cumplidas}</p>
          <p className="text-[10px] text-slate-400 mt-1">≥{META_EFECTIVAS_MES} efectivas</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">En Camino</p>
          <p className="text-2xl font-bold text-amber-500">{stats.enCamino}</p>
          <p className="text-[10px] text-slate-400 mt-1">alcanzarán meta</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">No Alcanzarán</p>
          <p className={`text-2xl font-bold ${stats.noAlcanzara > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stats.noAlcanzara}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">brigadas</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">% Cumplirán</p>
          <p className={`text-2xl font-bold ${stats.pctCumpliran >= 70 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.pctCumpliran.toFixed(0)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-1">{stats.cumpliranMeta}/{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Días Hábiles</p>
          <p className="text-2xl font-bold text-slate-800">
            {periodoInfo.diasHabilesTranscurridos}/{DIAS_HABILES_MES}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">quedan {periodoInfo.diasHabilesRestantes}</p>
        </div>
      </div>

      {/* Panel de Control */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Estado de Meta Mensual */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Estado Meta {META_EFECTIVAS_MES}</h3>
          <p className="text-[9px] text-slate-400 mb-3">Click para filtrar brigadas</p>
          <div className="space-y-2">
            {/* Ya cumplieron */}
            <button
              onClick={() => setFiltroVista(filtroVista === 'cumplen' ? 'todos' : 'cumplen')}
              className={`w-full flex items-center justify-between p-2 rounded transition-colors cursor-pointer group ${
                filtroVista === 'cumplen'
                  ? 'bg-green-100 border border-green-400'
                  : 'bg-green-50 border border-green-200 hover:bg-green-100'
              }`}
            >
              <div className="text-left">
                <p className="text-[10px] text-green-700 uppercase font-medium">Ya Cumplieron</p>
                <p className="text-sm font-bold text-green-700">{stats.cumplidas} brigadas</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-green-600">
                  {((stats.cumplidas / stats.total) * 100).toFixed(0)}%
                </span>
                <ChevronRight className="w-4 h-4 text-green-500 group-hover:text-green-700" />
              </div>
            </button>

            {/* En camino */}
            <button
              onClick={() => setFiltroVista(filtroVista === 'en_camino' ? 'todos' : 'en_camino')}
              className={`w-full flex items-center justify-between p-2 rounded transition-colors cursor-pointer group ${
                filtroVista === 'en_camino'
                  ? 'bg-amber-100 border border-amber-400'
                  : 'bg-amber-50 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <div className="text-left">
                <p className="text-[10px] text-amber-700 uppercase font-medium">En Camino</p>
                <p className="text-sm font-bold text-amber-700">{stats.enCamino} brigadas</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-amber-600">
                  {((stats.enCamino / stats.total) * 100).toFixed(0)}%
                </span>
                <ChevronRight className="w-4 h-4 text-amber-500 group-hover:text-amber-700" />
              </div>
            </button>

            {/* No alcanzarán */}
            <button
              onClick={() => setFiltroVista(filtroVista === 'no_alcanzara' ? 'todos' : 'no_alcanzara')}
              className={`w-full flex items-center justify-between p-2 rounded transition-colors cursor-pointer group ${
                filtroVista === 'no_alcanzara'
                  ? 'bg-red-100 border border-red-400'
                  : 'bg-red-50 border border-red-200 hover:bg-red-100'
              }`}
            >
              <div className="text-left">
                <p className="text-[10px] text-red-700 uppercase font-medium">No Alcanzarán</p>
                <p className="text-sm font-bold text-red-700">{stats.noAlcanzara} brigadas</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-red-600">
                  {((stats.noAlcanzara / stats.total) * 100).toFixed(0)}%
                </span>
                <ChevronRight className="w-4 h-4 text-red-500 group-hover:text-red-700" />
              </div>
            </button>
          </div>
        </div>

        {/* Cumplimiento por Zona */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4 lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Proyección por Zona</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {stats.porZona.map((z) => (
              <button
                key={z.zona}
                onClick={() => setFiltroZona(filtroZona === z.zona ? 'todas' : z.zona)}
                className={`p-2 rounded-lg border transition-all text-left ${
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
                  {z.cumpliranMeta} de {z.total}
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
            <span className={`text-xs px-2 py-1 rounded ${
              filtroVista === 'cumplen' ? 'bg-green-100 text-green-700' :
              filtroVista === 'en_camino' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {filtroVista === 'cumplen' ? 'Ya cumplieron' :
               filtroVista === 'en_camino' ? 'En camino' :
               filtroVista === 'no_alcanzara' ? 'No alcanzarán' : 'No cumplen'}
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

      {/* Detalle por Zona - Grid de 2 columnas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {Object.entries(brigadasPorZona).map(([zona, brigadasZona]) => {
          const cumplidasZona = brigadasZona.filter(b => b.estadoMeta === 'cumplida').length;
          const enCaminoZona = brigadasZona.filter(b => b.estadoMeta === 'en_camino').length;
          const cumpliranZona = cumplidasZona + enCaminoZona;
          const pctZona = (cumpliranZona / brigadasZona.length) * 100;

          return (
            <div key={zona} className="bg-white rounded-lg border border-slate-200/60 overflow-hidden flex flex-col">
              {/* Header de zona */}
              <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between">
                <span className="font-semibold text-xs">{zona}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/30 text-green-300">
                    {cumplidasZona}
                  </span>
                  {enCaminoZona > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300">
                      +{enCaminoZona}
                    </span>
                  )}
                  <span className={`text-[10px] ${pctZona >= 70 ? 'text-green-300' : 'text-red-300'}`}>
                    ({pctZona.toFixed(0)}%)
                  </span>
                </div>
              </div>

              {/* Tabla compacta */}
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase text-slate-500">Brigada</th>
                      <th className="px-1 py-1.5 text-center text-[9px] font-semibold uppercase text-slate-500 w-8">Días</th>
                      <th className="px-1 py-1.5 text-center text-[9px] font-semibold uppercase text-slate-500 w-10">Acum</th>
                      <th className="px-1 py-1.5 text-center text-[9px] font-semibold uppercase text-slate-500 w-10">E/día</th>
                      <th className="px-1 py-1.5 text-center text-[9px] font-semibold uppercase text-slate-500 w-10">CNR</th>
                      <th className="px-1 py-1.5 text-center text-[9px] font-semibold uppercase text-slate-500 w-10">Proy</th>
                      <th className="px-1 py-1.5 text-center text-[9px] font-semibold uppercase text-slate-500 w-16">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brigadasZona.map((b, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-slate-50 hover:bg-slate-50 ${
                          b.estadoMeta === 'no_alcanzara' ? 'bg-red-50/40' :
                          b.estadoMeta === 'en_camino' ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="px-2 py-1.5 text-slate-700 font-medium truncate max-w-[120px]" title={b.nombre}>
                          {b.nombre}
                        </td>
                        <td className="px-1 py-1.5 text-center text-slate-500">{b.diasTrabajados}</td>
                        <td className="px-1 py-1.5 text-center font-semibold text-slate-700">
                          {b.efectivasTotal}
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          <span className={`font-bold ${b.cumplePromedio ? 'text-green-600' : 'text-red-600'}`}>
                            {b.efectivasDia.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-1 py-1.5 text-center text-slate-600">
                          {b.cnrDia.toFixed(1)}
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          {b.estadoMeta === 'cumplida' ? (
                            <span className="font-semibold text-green-600">{b.efectivasTotal}</span>
                          ) : (
                            <span className={`font-semibold ${b.proyeccion >= META_EFECTIVAS_MES ? 'text-green-600' : 'text-red-600'}`}>
                              {b.proyeccion}
                            </span>
                          )}
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          {b.estadoMeta === 'cumplida' ? (
                            <span className="inline-block px-1 py-0.5 rounded text-[8px] font-bold bg-green-600 text-white">
                              CUMPLIDA
                            </span>
                          ) : b.estadoMeta === 'en_camino' ? (
                            <span className="inline-block px-1 py-0.5 rounded text-[8px] font-bold bg-amber-500 text-white">
                              EN CAMINO
                            </span>
                          ) : (
                            <span className="inline-block px-1 py-0.5 rounded text-[8px] font-bold bg-red-600 text-white">
                              NO ALCANZA
                            </span>
                          )}
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
    </div>
  );
}
