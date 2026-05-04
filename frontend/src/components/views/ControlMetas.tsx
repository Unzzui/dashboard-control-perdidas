'use client';

import { useMemo, useState } from 'react';
import { TecnicoRanking, Filters, CalendarioMes, KPIData } from '@/types';
import PersonaModal, { BrigadaSeleccionada } from './control-metas/PersonaModal';

interface ControlMetasProps {
  tecnicos: TecnicoRanking[];
  filters: Filters;
  calendarioMes?: CalendarioMes | null;
  kpis: KPIData;
}

// Fallback estático. La meta real es dinámica (8 ef/día × días hábiles del mes)
// y viene del backend en `calendarioMes.meta_efectivas`.
const META_EFECTIVAS_FALLBACK = 160;
const META_EFECTIVAS_DIA = 8;

type EstadoMeta = 'cumplida' | 'en_camino' | 'no_alcanzara';
type FiltroVista = 'todos' | 'cumplida' | 'en_camino' | 'no_alcanzara';

interface BrigadaMeta extends BrigadaSeleccionada {
  faltanParaMeta: number;
  cnrDia: number;
  // Campos globales para técnicos multi-zona
  efectivasGlobal: number;
  efectivasDiaGlobal: number;
  diasGlobal: number;
  cumpleMetaGlobal: boolean;
}

export default function ControlMetas({ tecnicos, filters, calendarioMes, kpis }: ControlMetasProps) {
  const metaEfectivasMes = calendarioMes?.meta_efectivas ?? META_EFECTIVAS_FALLBACK;
  const [vistaActiva, setVistaActiva] = useState<FiltroVista>('todos');
  const [zonaExpandida, setZonaExpandida] = useState<string | null>(null);
  const [brigadaSeleccionada, setBrigadaSeleccionada] = useState<BrigadaMeta | null>(null);

  // Función para cerrar el modal y limpiar estado
  const cerrarModal = () => {
    setBrigadaSeleccionada(null);
  };

  // Días hábiles restantes contados sobre el calendario real (excluye sáb/dom/feriados CL).
  const diasRestantes = useMemo(() => {
    if (!calendarioMes) return 0;
    const hoy = new Date();
    const esMesActualCal =
      calendarioMes.año === hoy.getFullYear() &&
      calendarioMes.numero_mes === hoy.getMonth() + 1;
    const esMesPasado =
      calendarioMes.año < hoy.getFullYear() ||
      (calendarioMes.año === hoy.getFullYear() && calendarioMes.numero_mes < hoy.getMonth() + 1);

    if (esMesPasado) return 0;

    const sabados = new Set(calendarioMes.sabados);
    const domingos = new Set(calendarioMes.domingos);
    const feriados = new Set(calendarioMes.feriados);
    const desde = esMesActualCal ? hoy.getDate() + 1 : 1;

    let restantes = 0;
    for (let d = desde; d <= calendarioMes.dias_en_mes; d++) {
      if (!sabados.has(d) && !domingos.has(d) && !feriados.has(d)) {
        restantes += 1;
      }
    }
    return restantes;
  }, [calendarioMes]);

  // Procesar brigadas agrupadas por zona
  const { brigadasPorZona, stats, zonasStats, todasLasBrigadas } = useMemo(() => {
    const porZona: Record<string, BrigadaMeta[]> = {};
    const zonasStats: Record<string, { total: number; cumpliran: number; noAlcanzara: number; pctAvancePromedio: number }> = {};

    tecnicos.forEach(t => {
      const trabajaEnMultiplesZonas = t.cantidad_zonas > 1;

      // IMPORTANTE: Para técnicos que trabajan en múltiples zonas,
      // usar los totales GLOBALES para evaluar meta (la meta es global, no por zona)
      const efectivasTotal = trabajaEnMultiplesZonas ? t.efectivas_global : t.efectivas;
      const efectivasDia = trabajaEnMultiplesZonas ? t.promedio_efectivas_global : t.promedio_efectivas;
      const diasTrabajados = trabajaEnMultiplesZonas ? t.dias_global : (t.dias_trabajados || 1);

      const proyeccion = Math.round(efectivasTotal + (efectivasDia * diasRestantes));
      const faltanParaMeta = Math.max(0, metaEfectivasMes - efectivasTotal);
      const pctAvance = Math.min(100, (efectivasTotal / metaEfectivasMes) * 100);

      let estado: EstadoMeta;
      if (efectivasTotal >= metaEfectivasMes) {
        estado = 'cumplida';
      } else if (diasRestantes > 0 && proyeccion >= metaEfectivasMes) {
        estado = 'en_camino';
      } else {
        estado = 'no_alcanzara';
      }

      const brigada: BrigadaMeta = {
        nombre: t.nombre,  // Mantener nombre original para API
        zona: t.zona,
        diasTrabajados,
        efectivasTotal,
        efectivasDia,
        proyeccion,
        faltanParaMeta,
        estado,
        cnrDia: t.promedio_cnr,
        pctAvance,
        kwhRecuperado: trabajaEnMultiplesZonas ? t.kwh_global : t.kwh_recuperado,
        // Campos globales
        trabajaEnMultiplesZonas,
        efectivasGlobal: t.efectivas_global,
        efectivasDiaGlobal: t.promedio_efectivas_global,
        diasGlobal: t.dias_global,
        cumpleMetaGlobal: t.cumple_meta_global,
      };

      if (!porZona[t.zona]) {
        porZona[t.zona] = [];
        zonasStats[t.zona] = { total: 0, cumpliran: 0, noAlcanzara: 0, pctAvancePromedio: 0 };
      }

      porZona[t.zona].push(brigada);
      zonasStats[t.zona].total++;
      if (estado === 'cumplida' || estado === 'en_camino') zonasStats[t.zona].cumpliran++;
      if (estado === 'no_alcanzara') zonasStats[t.zona].noAlcanzara++;
    });

    // Calcular promedio de avance por zona y ordenar brigadas
    const orden = { no_alcanzara: 0, en_camino: 1, cumplida: 2 };
    Object.entries(porZona).forEach(([zona, brigadas]) => {
      zonasStats[zona].pctAvancePromedio = brigadas.reduce((a, b) => a + b.pctAvance, 0) / brigadas.length;
      brigadas.sort((a, b) => {
        if (orden[a.estado] !== orden[b.estado]) {
          return orden[a.estado] - orden[b.estado];
        }
        return a.proyeccion - b.proyeccion;
      });
    });

    // Stats globales: deduplicar por técnico para que quien apoya otra zona no cuente dos veces.
    // Las métricas de cada brigada ya son globales cuando trabajaEnMultiplesZonas, así que cualquier
    // fila del técnico representa los mismos totales.
    const allBrigadas = Object.values(porZona).flat();
    const brigadasUnicas = Array.from(new Map(allBrigadas.map(b => [b.nombre, b])).values());
    const total = brigadasUnicas.length;
    const cumplidas = brigadasUnicas.filter(b => b.estado === 'cumplida').length;
    const enCamino = brigadasUnicas.filter(b => b.estado === 'en_camino').length;
    const noAlcanzara = brigadasUnicas.filter(b => b.estado === 'no_alcanzara').length;
    // Métrica oficial calculada en el backend (single source of truth para todas las vistas).
    const promedioEfectivas = kpis.promedio_efectivas_oficial;

    return {
      brigadasPorZona: porZona,
      stats: { total, cumplidas, enCamino, noAlcanzara, promedioEfectivas },
      zonasStats,
      todasLasBrigadas: allBrigadas
    };
  }, [tecnicos, diasRestantes, kpis.promedio_efectivas_oficial, metaEfectivasMes]);

  // Funciones de navegación entre trabajadores
  const navegarTrabajador = (direccion: 'anterior' | 'siguiente') => {
    if (!brigadaSeleccionada || !todasLasBrigadas) return;

    const indiceActual = todasLasBrigadas.findIndex(
      b => b.nombre === brigadaSeleccionada.nombre && b.zona === brigadaSeleccionada.zona
    );

    if (indiceActual === -1) return;

    let nuevoIndice: number;
    if (direccion === 'anterior') {
      nuevoIndice = indiceActual === 0 ? todasLasBrigadas.length - 1 : indiceActual - 1;
    } else {
      nuevoIndice = indiceActual === todasLasBrigadas.length - 1 ? 0 : indiceActual + 1;
    }

    setBrigadaSeleccionada(todasLasBrigadas[nuevoIndice]);
    // Mantener el estado del calendario (abierto/cerrado)
  };

  // Filtrar según vista
  const brigadasFiltradosPorZona = useMemo(() => {
    if (vistaActiva === 'todos') return brigadasPorZona;

    const filtrados: Record<string, BrigadaMeta[]> = {};
    Object.entries(brigadasPorZona).forEach(([zona, brigadas]) => {
      const brigadasFiltradas = brigadas.filter(b => b.estado === vistaActiva);
      if (brigadasFiltradas.length > 0) {
        filtrados[zona] = brigadasFiltradas;
      }
    });
    return filtrados;
  }, [brigadasPorZona, vistaActiva]);

  const totalFiltrados = Object.values(brigadasFiltradosPorZona).flat().length;

  if (Object.keys(brigadasPorZona).length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">No hay datos disponibles</p>
      </div>
    );
  }

  const pctCumpliran = stats.total > 0 ? ((stats.cumplidas + stats.enCamino) / stats.total) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Control de Metas</h2>
          <p className="text-sm text-slate-500">
            Meta mensual: {metaEfectivasMes} efectivas · {diasRestantes} días hábiles restantes
          </p>
        </div>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Cumplirán Meta</p>
          <p className={`text-3xl font-bold ${pctCumpliran >= 70 ? 'text-green-600' : 'text-red-600'}`}>
            {pctCumpliran.toFixed(0)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">{stats.cumplidas + stats.enCamino} de {stats.total}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Prom. Efectivas/día</p>
          <p className={`text-3xl font-bold ${stats.promedioEfectivas >= META_EFECTIVAS_DIA ? 'text-green-600' : 'text-red-600'}`}>
            {stats.promedioEfectivas.toFixed(1)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Meta: {META_EFECTIVAS_DIA}/día</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Ya Cumplieron</p>
          <p className="text-3xl font-bold text-green-600">{stats.cumplidas}</p>
          <p className="text-xs text-slate-500 mt-1">brigadas con ≥{metaEfectivasMes}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Estado Brigadas</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setVistaActiva(vistaActiva === 'no_alcanzara' ? 'todos' : 'no_alcanzara')}
              className={`text-center cursor-pointer transition-opacity ${vistaActiva === 'no_alcanzara' ? '' : 'opacity-60 hover:opacity-100'}`}
            >
              <p className="text-2xl font-bold text-red-600">{stats.noAlcanzara}</p>
              <p className="text-[10px] text-slate-500">No alcanza</p>
            </button>
            <button
              onClick={() => setVistaActiva(vistaActiva === 'en_camino' ? 'todos' : 'en_camino')}
              className={`text-center cursor-pointer transition-opacity ${vistaActiva === 'en_camino' ? '' : 'opacity-60 hover:opacity-100'}`}
            >
              <p className="text-2xl font-bold text-amber-500">{stats.enCamino}</p>
              <p className="text-[10px] text-slate-500">En camino</p>
            </button>
            <button
              onClick={() => setVistaActiva(vistaActiva === 'cumplida' ? 'todos' : 'cumplida')}
              className={`text-center cursor-pointer transition-opacity ${vistaActiva === 'cumplida' ? '' : 'opacity-60 hover:opacity-100'}`}
            >
              <p className="text-2xl font-bold text-green-600">{stats.cumplidas}</p>
              <p className="text-[10px] text-slate-500">Cumplida</p>
            </button>
          </div>
        </div>
      </div>

      {/* Filtro activo */}
      {vistaActiva !== 'todos' && (
        <div className="flex items-center gap-3">
          <span className={`text-sm px-3 py-1 rounded font-medium ${
            vistaActiva === 'no_alcanzara' ? 'bg-red-100 text-red-700' :
            vistaActiva === 'en_camino' ? 'bg-amber-100 text-amber-700' :
            'bg-green-100 text-green-700'
          }`}>
            {vistaActiva === 'no_alcanzara' ? 'No Alcanzarán' : vistaActiva === 'en_camino' ? 'En Camino' : 'Ya Cumplieron'}
          </span>
          <span className="text-sm text-slate-500">{totalFiltrados} brigadas</span>
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
        {Object.entries(brigadasFiltradosPorZona).map(([zona, brigadas]) => {
          const zonaData = zonasStats[zona] || { total: 0, cumpliran: 0, noAlcanzara: 0, pctAvancePromedio: 0 };
          const pctZonaCumpliran = zonaData.total > 0 ? (zonaData.cumpliran / zonaData.total) * 100 : 0;

          return (
            <div key={zona} className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
              <div
                className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors"
                onClick={() => setZonaExpandida(zona)}
              >
                <span className="font-semibold text-xs">{zona}</span>
                <div className="flex items-center gap-2 text-[10px]">
                  {zonaData.noAlcanzara > 0 && <span className="text-red-300">{zonaData.noAlcanzara}</span>}
                  <span className={pctZonaCumpliran >= 70 ? 'text-green-300' : 'text-red-300'}>{pctZonaCumpliran.toFixed(0)}%</span>
                  <span className="text-slate-400 ml-1">↗</span>
                </div>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-[180px]">
                <table className="w-full min-w-[340px]">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Brigada</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Acum</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Ef/d</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Proy</th>
                      <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase text-slate-500">Avance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brigadas.map((b, idx) => (
                      <tr
                        key={idx}
                        onClick={() => setBrigadaSeleccionada(b)}
                        className={`border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer ${
                          b.estado === 'no_alcanzara' ? 'bg-red-50/40' :
                          b.estado === 'en_camino' ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="px-3 py-1.5 text-[11px] text-slate-800 truncate max-w-[80px]">
                          <div className="flex items-center gap-1">
                            <span className="truncate">{b.nombre}</span>
                            {b.trabajaEnMultiplesZonas && (
                              <span className="text-[7px] bg-blue-100 text-blue-700 px-1 rounded font-semibold" title={`Trabaja en ${tecnicos.find(t => t.nombre === b.nombre)?.cantidad_zonas} zonas - Meta evaluada globalmente`}>
                                GLOBAL
                              </span>
                            )}
                            {tecnicos.find(t => t.nombre === b.nombre && t.zona === b.zona)?.esta_apoyando && (
                              <span className="text-[8px] text-amber-600" title="Apoyando desde otra zona">🔄</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-[11px] text-right font-semibold text-slate-700">{b.efectivasTotal}</td>
                        <td className={`px-2 py-1.5 text-[11px] font-semibold text-right ${b.efectivasDia >= META_EFECTIVAS_DIA ? 'text-green-600' : 'text-red-600'}`}>
                          {b.efectivasDia.toFixed(1)}
                        </td>
                        <td className={`px-2 py-1.5 text-[11px] font-semibold text-right ${b.proyeccion >= metaEfectivasMes ? 'text-green-600' : 'text-red-600'}`}>
                          {b.proyeccion}
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                b.estado === 'cumplida' ? 'bg-green-500' :
                                b.estado === 'en_camino' ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${b.pctAvance}%` }}
                            />
                          </div>
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

      {brigadaSeleccionada && (
        <PersonaModal
          brigada={brigadaSeleccionada}
          filters={filters}
          metaEfectivasMes={metaEfectivasMes}
          todasLasBrigadas={todasLasBrigadas}
          onClose={cerrarModal}
          onNavegar={navegarTrabajador}
        />
      )}

      {/* Modal Tabla Expandida - Minimalista */}
      {zonaExpandida && brigadasFiltradosPorZona[zonaExpandida] && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setZonaExpandida(null)}>
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl" onClick={e => e.stopPropagation()}>
            {/* Header compacto */}
            <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between rounded-t-lg">
              <div className="flex items-center gap-4">
                <span className="font-semibold">{zonaExpandida}</span>
                <span className="text-xs text-slate-300">{zonasStats[zonaExpandida]?.total} brigadas</span>
                <span className="text-xs text-green-400">{zonasStats[zonaExpandida]?.cumpliran} cumplirán</span>
                <span className="text-xs text-red-400">{zonasStats[zonaExpandida]?.noAlcanzara} no alcanzarán</span>
              </div>
              <button onClick={() => setZonaExpandida(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Tabla compacta */}
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Brigada</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Días</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Acum.</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Ef/día</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Proy.</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Faltan</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase text-slate-500 w-24">Avance</th>
                </tr>
              </thead>
              <tbody>
                {brigadasFiltradosPorZona[zonaExpandida].map((b, idx) => (
                  <tr
                    key={idx}
                    onClick={() => {
                      setZonaExpandida(null);
                      setBrigadaSeleccionada(b);
                    }}
                    className={`border-b border-slate-100 cursor-pointer hover:bg-slate-100/50 ${
                      b.estado === 'no_alcanzara' ? 'bg-red-50/50' :
                      b.estado === 'en_camino' ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span>{b.nombre}</span>
                        {b.trabajaEnMultiplesZonas && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold" title={`Trabaja en ${tecnicos.find(t => t.nombre === b.nombre)?.cantidad_zonas} zonas - Meta evaluada globalmente`}>
                            META GLOBAL
                          </span>
                        )}
                        {tecnicos.find(t => t.nombre === b.nombre && t.zona === b.zona)?.esta_apoyando && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700" title="Apoyando desde otra zona">
                            Apoyo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right text-slate-600">{b.diasTrabajados}</td>
                    <td className="px-2 py-2 text-right font-semibold text-slate-800">{b.efectivasTotal}</td>
                    <td className={`px-2 py-2 text-right font-semibold ${b.efectivasDia >= META_EFECTIVAS_DIA ? 'text-green-600' : 'text-red-600'}`}>
                      {b.efectivasDia.toFixed(1)}
                    </td>
                    <td className={`px-2 py-2 text-right font-semibold ${b.proyeccion >= metaEfectivasMes ? 'text-green-600' : 'text-red-600'}`}>
                      {b.proyeccion}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-500">{b.faltanParaMeta > 0 ? b.faltanParaMeta : '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              b.estado === 'cumplida' ? 'bg-green-500' :
                              b.estado === 'en_camino' ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${b.pctAvance}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 w-8">{b.pctAvance.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
