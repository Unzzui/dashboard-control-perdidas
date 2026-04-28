'use client';

import { useMemo, useState, useEffect } from 'react';
import { TecnicoRanking, DetalleTecnicoDiario, Filters, InspeccionesDia, CalendarioMes, KPIData } from '@/types';
import { getDetalleTecnicoDiario, getInspeccionesDia } from '@/lib/api';

interface ControlMetasProps {
  tecnicos: TecnicoRanking[];
  filters: Filters;
  calendarioMes?: CalendarioMes | null;
  kpis: KPIData;
}

const META_EFECTIVAS_MES = 160;
const META_EFECTIVAS_DIA = 8;

type EstadoMeta = 'cumplida' | 'en_camino' | 'no_alcanzara';
type FiltroVista = 'todos' | 'cumplida' | 'en_camino' | 'no_alcanzara';

interface BrigadaMeta {
  nombre: string;
  zona: string;
  diasTrabajados: number;
  efectivasTotal: number;
  efectivasDia: number;
  proyeccion: number;
  faltanParaMeta: number;
  estado: EstadoMeta;
  cnrDia: number;
  pctAvance: number;
  kwhRecuperado: number;
  // Campos globales para técnicos multi-zona
  trabajaEnMultiplesZonas: boolean;
  efectivasGlobal: number;
  efectivasDiaGlobal: number;
  diasGlobal: number;
  cumpleMetaGlobal: boolean;
}

export default function ControlMetas({ tecnicos, filters, calendarioMes, kpis }: ControlMetasProps) {
  const [vistaActiva, setVistaActiva] = useState<FiltroVista>('todos');
  const [zonaExpandida, setZonaExpandida] = useState<string | null>(null);
  const [brigadaSeleccionada, setBrigadaSeleccionada] = useState<BrigadaMeta | null>(null);
  const [detalleTecnico, setDetalleTecnico] = useState<DetalleTecnicoDiario | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [inspeccionesDia, setInspeccionesDia] = useState<InspeccionesDia | null>(null);
  const [cargandoInspecciones, setCargandoInspecciones] = useState(false);

  // Función para cerrar el modal y limpiar estado
  const cerrarModal = () => {
    setBrigadaSeleccionada(null);
    setDetalleTecnico(null);
    setMostrarCalendario(false);
    setCargandoDetalle(false);
    setInspeccionesDia(null);
  };

  // Función para cargar inspecciones de un día específico
  const cargarInspeccionesDia = async (fecha: string) => {
    if (!brigadaSeleccionada || !detalleTecnico) return;

    setCargandoInspecciones(true);
    try {
      // IMPORTANTE: Usar detalleTecnico.zona que será "TODAS" si es consolidado
      // Esto asegura que se busquen inspecciones en todas las zonas para técnicos multi-zona
      const data = await getInspeccionesDia(
        brigadaSeleccionada.nombre,
        detalleTecnico.zona,  // "TODAS" si es consolidado, zona específica si no
        fecha,
        filters
      );
      setInspeccionesDia(data);
    } catch (error) {
      console.error('Error cargando inspecciones del día:', error);
      setInspeccionesDia(null);
    } finally {
      setCargandoInspecciones(false);
    }
  };

  // Cargar detalle del técnico cuando se selecciona una brigada
  useEffect(() => {
    if (brigadaSeleccionada) {
      // Limpiar estado anterior inmediatamente
      setDetalleTecnico(null);
      setCargandoDetalle(true);

      // Pequeño delay para asegurar que el estado se limpie
      const timer = setTimeout(() => {
        // Pasar null como zona para obtener el CONSOLIDADO de todas las zonas
        getDetalleTecnicoDiario(brigadaSeleccionada.nombre, null, filters)
          .then((data) => {
            console.log('Datos recibidos del backend:', data);
            console.log('Total días:', data.total_dias);
            console.log('Es consolidado:', data.es_consolidado);
            console.log('Desglose zonas:', data.desglose_zonas);
            setDetalleTecnico(data);
          })
          .catch((error) => {
            console.error('Error cargando detalle del técnico:', error);
          })
          .finally(() => {
            setCargandoDetalle(false);
          });
      }, 100);

      return () => clearTimeout(timer);
    } else {
      // Si no hay brigada seleccionada, limpiar todo
      setDetalleTecnico(null);
      setMostrarCalendario(false);
    }
  }, [brigadaSeleccionada, filters]);

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
      const faltanParaMeta = Math.max(0, META_EFECTIVAS_MES - efectivasTotal);
      const pctAvance = Math.min(100, (efectivasTotal / META_EFECTIVAS_MES) * 100);

      let estado: EstadoMeta;
      if (efectivasTotal >= META_EFECTIVAS_MES) {
        estado = 'cumplida';
      } else if (diasRestantes > 0 && proyeccion >= META_EFECTIVAS_MES) {
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
  }, [tecnicos, diasRestantes, kpis.promedio_efectivas_oficial]);

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
            Meta mensual: {META_EFECTIVAS_MES} efectivas · {diasRestantes} días hábiles restantes
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
          <p className="text-xs text-slate-500 mt-1">brigadas con ≥{META_EFECTIVAS_MES}</p>
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
                        <td className={`px-2 py-1.5 text-[11px] font-semibold text-right ${b.proyeccion >= META_EFECTIVAS_MES ? 'text-green-600' : 'text-red-600'}`}>
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

      {/* Modal Detalle Diario de Brigada */}
      {brigadaSeleccionada && (
        <div
          key={`${brigadaSeleccionada.nombre}-${brigadaSeleccionada.zona}`}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={cerrarModal}
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-semibold">{brigadaSeleccionada.nombre}</span>
                <span className="text-xs text-slate-300">{brigadaSeleccionada.zona}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  brigadaSeleccionada.estado === 'cumplida' ? 'bg-green-500/20 text-green-300' :
                  brigadaSeleccionada.estado === 'en_camino' ? 'bg-amber-500/20 text-amber-300' :
                  'bg-red-500/20 text-red-300'
                }`}>
                  {brigadaSeleccionada.estado === 'cumplida' ? 'Meta Cumplida' :
                   brigadaSeleccionada.estado === 'en_camino' ? 'En Camino' : 'No Alcanzará'}
                </span>
              </div>

              {/* Navegación entre trabajadores */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 border-r border-slate-600 pr-3">
                  <button
                    onClick={() => navegarTrabajador('anterior')}
                    className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                    title="Trabajador anterior"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => navegarTrabajador('siguiente')}
                    className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                    title="Siguiente trabajador"
                  >
                    Siguiente →
                  </button>
                </div>
                <button onClick={cerrarModal} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
              {/* KPIs de la brigada */}
              <div className="grid grid-cols-6 gap-3 mb-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Días Trabajados</p>
                  <p className="text-2xl font-bold text-slate-800">{brigadaSeleccionada.diasTrabajados}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total Efectivas</p>
                  <p className="text-2xl font-bold text-slate-800">{brigadaSeleccionada.efectivasTotal}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Efectivas/Día</p>
                  <p className={`text-2xl font-bold ${brigadaSeleccionada.efectivasDia >= META_EFECTIVAS_DIA ? 'text-green-600' : 'text-red-600'}`}>
                    {brigadaSeleccionada.efectivasDia.toFixed(1)}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">kWh Recuperado</p>
                  <p className="text-2xl font-bold text-amber-600">{brigadaSeleccionada.kwhRecuperado.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Proyección</p>
                  <p className={`text-2xl font-bold ${brigadaSeleccionada.proyeccion >= META_EFECTIVAS_MES ? 'text-green-600' : 'text-red-600'}`}>
                    {brigadaSeleccionada.proyeccion}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Avance</p>
                  <p className="text-2xl font-bold text-slate-800">{brigadaSeleccionada.pctAvance.toFixed(0)}%</p>
                </div>
              </div>

              {/* Desglose por zonas trabajadas */}
              {detalleTecnico && detalleTecnico.desglose_zonas && detalleTecnico.desglose_zonas.length > 0 && (
                <div className="mb-3">
                  <div className="bg-white border border-slate-200/60 rounded-lg overflow-hidden">
                    <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs">Desglose por Zonas Trabajadas</span>
                        {detalleTecnico.trabajo_en_otras_zonas && (
                          <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            Trabaja en {detalleTecnico.zonas_trabajadas.length} zonas
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Zona</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Días</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Tot Visit</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500 bg-green-50 text-green-700">Efectivas</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Normal</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Mant</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">VF CGE</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">VF No Ef</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">CNR</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">kWh</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalleTecnico.desglose_zonas.map((zona, idx) => (
                            <tr
                              key={idx}
                              className={`border-b border-slate-50 ${
                                zona.zona === detalleTecnico.zona_origen ? 'bg-blue-50' : 'hover:bg-slate-50/50'
                              }`}
                            >
                              <td className="px-3 py-2 text-slate-800 font-medium flex items-center gap-1">
                                {zona.zona}
                                {zona.zona === detalleTecnico.zona_origen && (
                                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500 text-white">ORIGEN</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-700">{zona.dias_trabajados}</td>
                              <td className="px-3 py-2 text-right text-slate-700">{zona.visitas_totales}</td>
                              <td className="px-3 py-2 text-right font-semibold text-green-700 bg-green-50">{zona.efectivas}</td>
                              <td className="px-3 py-2 text-right text-slate-700">{zona.normal}</td>
                              <td className="px-3 py-2 text-right text-blue-600">{zona.mantenimiento}</td>
                              <td className="px-3 py-2 text-right text-green-600">{zona.vf_cge_pagable}</td>
                              <td className="px-3 py-2 text-right text-red-600">{zona.vf_no_efectiva}</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-800">{zona.cnr}</td>
                              <td className="px-3 py-2 text-right text-slate-700">{zona.kwh_recuperado.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                          <tr>
                            <td className="px-3 py-2 font-semibold text-slate-800">TOTAL</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-800">
                              {detalleTecnico.desglose_zonas.reduce((acc, z) => acc + z.dias_trabajados, 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-slate-800">
                              {detalleTecnico.desglose_zonas.reduce((acc, z) => acc + z.visitas_totales, 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-green-700 bg-green-50">
                              {detalleTecnico.desglose_zonas.reduce((acc, z) => acc + z.efectivas, 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-slate-700">
                              {detalleTecnico.desglose_zonas.reduce((acc, z) => acc + z.normal, 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-blue-600">
                              {detalleTecnico.desglose_zonas.reduce((acc, z) => acc + z.mantenimiento, 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-green-600">
                              {detalleTecnico.desglose_zonas.reduce((acc, z) => acc + z.vf_cge_pagable, 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-red-600">
                              {detalleTecnico.desglose_zonas.reduce((acc, z) => acc + z.vf_no_efectiva, 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-slate-800">
                              {detalleTecnico.desglose_zonas.reduce((acc, z) => acc + z.cnr, 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-slate-800">
                              {detalleTecnico.desglose_zonas.reduce((acc, z) => acc + z.kwh_recuperado, 0).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Vista de asistencia por semana */}
              {detalleTecnico && detalleTecnico.calendario.length > 0 && (
                <div className="mb-3">
                  <button
                    onClick={() => setMostrarCalendario(!mostrarCalendario)}
                    className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-left">
                        <p className="text-xs font-semibold text-slate-800">Calendario de Asistencia</p>
                        <p className="text-[10px] text-slate-500">
                          {detalleTecnico.total_dias} de {detalleTecnico.calendario.filter(d => d.es_habil).length} días hábiles trabajados
                        </p>
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${mostrarCalendario ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Calendario Mensual */}
                  {mostrarCalendario && (
                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 animate-fade-in max-w-md mx-auto">
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs font-semibold text-slate-800 mb-2 text-center">
                          {detalleTecnico.calendario.length > 0 && (() => {
                            const [year, month] = detalleTecnico.calendario[0].fecha.split('-');
                            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                            const mesNombre = meses[parseInt(month) - 1];
                            return `${mesNombre} ${year}`;
                          })()}
                        </p>

                        {/* Días de la semana */}
                        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia) => (
                            <div key={dia} className="text-center text-[9px] font-bold text-slate-600 py-1 bg-slate-100 rounded">
                              {dia}
                            </div>
                          ))}
                        </div>

                        {/* Grilla de días */}
                        <div className="grid grid-cols-7 gap-1.5">
                        {(() => {
                          // Obtener primer día del mes
                          const primerDia = detalleTecnico.calendario[0];
                          const [year, month] = primerDia.fecha.split('-');
                          const fechaPrimerDia = new Date(parseInt(year), parseInt(month) - 1, 1);
                          let diaSemanaInicio = fechaPrimerDia.getDay(); // 0=Dom, 1=Lun,...

                          // Ajustar para que Lunes sea 0
                          diaSemanaInicio = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1;

                          // Agregar celdas vacías al inicio
                          const celdas: JSX.Element[] = [];
                          for (let i = 0; i < diaSemanaInicio; i++) {
                            celdas.push(<div key={`empty-${i}`} className="h-9 bg-slate-50/50 rounded"></div>);
                          }

                          // Agregar días del mes
                          detalleTecnico.calendario.forEach((dia, idx) => {
                            const diaData = detalleTecnico.dias.find(d => d.fecha === dia.fecha);
                            let colorClass = '';
                            let textClass = '';

                            if (dia.trabajo) {
                              colorClass = 'bg-green-500 shadow-sm';
                              textClass = 'text-white';
                            } else if (dia.es_futuro) {
                              colorClass = 'bg-white border border-slate-200';
                              textClass = 'text-slate-300';
                            } else if (dia.es_habil) {
                              colorClass = 'bg-red-50 border border-red-300';
                              textClass = 'text-red-600';
                            } else if (dia.es_feriado) {
                              colorClass = 'bg-blue-50 border border-blue-200';
                              textClass = 'text-blue-600';
                            } else {
                              colorClass = 'bg-slate-100 border border-slate-200';
                              textClass = 'text-slate-400';
                            }

                            celdas.push(
                              <div
                                key={idx}
                                className={`h-9 rounded ${colorClass} flex flex-col items-center justify-center text-center group relative ${dia.trabajo ? 'cursor-pointer' : 'cursor-default'} transition-all hover:scale-105 hover:shadow-md`}
                                title={`${dia.dia_semana} ${dia.dia}${dia.trabajo ? ` - ${diaData?.efectivas} efectivas - Click para ver detalle` : dia.es_futuro ? ' - Futuro' : ''}`}
                                onClick={() => dia.trabajo && cargarInspeccionesDia(dia.fecha)}
                              >
                                <span className={`text-[10px] font-bold ${textClass} leading-none`}>{dia.dia}</span>
                                {dia.trabajo && diaData && (
                                  <span className="text-[8px] text-white font-semibold bg-white/20 px-0.5 rounded leading-none mt-0.5">
                                    {diaData.efectivas}
                                  </span>
                                )}

                                {/* Tooltip al hover */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 pointer-events-none">
                                  <div className="bg-slate-900 text-white text-[9px] rounded px-2 py-1.5 whitespace-nowrap shadow-xl">
                                    <div className="font-bold text-[10px] mb-1 border-b border-slate-700 pb-0.5">{dia.dia_semana} {dia.dia}</div>
                                    {dia.trabajo && diaData ? (
                                      <div className="space-y-0.5">
                                        <div className="flex justify-between gap-2">
                                          <span className="text-slate-400">Efectivas:</span>
                                          <span className="font-semibold text-green-400">{diaData.efectivas}</span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                          <span className="text-slate-400">CNR:</span>
                                          <span className="font-semibold">{diaData.cnr}</span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                          <span className="text-slate-400">Normal:</span>
                                          <span className="font-semibold">{diaData.normal}</span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                          <span className="text-slate-400">VF:</span>
                                          <span className="font-semibold text-red-400">{diaData.visita_fallida}</span>
                                        </div>
                                      </div>
                                    ) : dia.es_futuro ? (
                                      <div className="text-slate-400 italic text-[8px]">Día futuro</div>
                                    ) : dia.es_habil ? (
                                      <div className="text-red-400 italic text-[8px]">Sin trabajo</div>
                                    ) : dia.es_feriado ? (
                                      <div className="text-blue-400 italic text-[8px]">Feriado</div>
                                    ) : (
                                      <div className="text-slate-400 italic text-[8px]">Fin de semana</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          });

                          return celdas;
                        })()}
                        </div>

                        {/* Leyenda */}
                        <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap justify-center items-center gap-2 text-[9px]">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-green-500 shadow-sm"></div>
                            <span className="text-slate-600">Trabajado</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-red-50 border border-red-300"></div>
                            <span className="text-slate-600">Sin trabajo</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-blue-50 border border-blue-200"></div>
                            <span className="text-slate-600">Feriado</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-white border border-slate-200"></div>
                            <span className="text-slate-600">Futuro</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-slate-100 border border-slate-200"></div>
                            <span className="text-slate-600">Fin de sem.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Detalle por día */}
              <div className="bg-white border border-slate-200/60 rounded-lg overflow-hidden">
                <div className="bg-slate-800 text-white px-3 py-2">
                  <span className="font-semibold text-xs">Detalle por Día</span>
                </div>
                <div className="overflow-x-auto">
                  {cargandoDetalle ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-oca-blue"></div>
                    </div>
                  ) : detalleTecnico && detalleTecnico.dias.length > 0 ? (
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Fecha</th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Día</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Tot Visit</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500 bg-green-50 text-green-700">Efectivas</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Normal</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Mant</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">VF CGE</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">VF No Ef</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">CNR</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">kWh</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalleTecnico.dias.map((dia, idx) => {
                          // Formatear fecha sin conversión de zona horaria
                          const [year, month, day] = dia.fecha.split('-');
                          const fechaFormateada = `${day}-${month}-${year}`;

                          return (
                            <tr
                              key={idx}
                              className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                              onClick={() => cargarInspeccionesDia(dia.fecha)}
                              title="Click para ver detalle de inspecciones"
                            >
                              <td className="px-3 py-2 text-slate-700">{fechaFormateada}</td>
                              <td className="px-3 py-2 text-slate-600">{dia.dia_semana}</td>
                              <td className="px-3 py-2 text-right text-slate-700">{dia.visitas_totales}</td>
                              <td className="px-3 py-2 text-right font-semibold text-green-700 bg-green-50">{dia.efectivas}</td>
                              <td className="px-3 py-2 text-right text-slate-700">{dia.normal}</td>
                              <td className="px-3 py-2 text-right text-blue-600">{dia.mantenimiento}</td>
                              <td className="px-3 py-2 text-right text-green-600">{dia.vf_cge_pagable}</td>
                              <td className="px-3 py-2 text-right text-red-600">{dia.vf_no_efectiva}</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-800">{dia.cnr}</td>
                              <td className="px-3 py-2 text-right text-slate-700">{dia.kwh_recuperado.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                        <tr>
                          <td className="px-3 py-2 font-semibold text-slate-800" colSpan={2}>TOTAL ({detalleTecnico.total_dias} días)</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-800">
                            {detalleTecnico.dias.reduce((acc, d) => acc + d.visitas_totales, 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-green-700 bg-green-50">
                            {detalleTecnico.dias.reduce((acc, d) => acc + d.efectivas, 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-700">
                            {detalleTecnico.dias.reduce((acc, d) => acc + d.normal, 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-blue-600">
                            {detalleTecnico.dias.reduce((acc, d) => acc + d.mantenimiento, 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-green-600">
                            {detalleTecnico.dias.reduce((acc, d) => acc + d.vf_cge_pagable, 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-red-600">
                            {detalleTecnico.dias.reduce((acc, d) => acc + d.vf_no_efectiva, 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-800">
                            {detalleTecnico.dias.reduce((acc, d) => acc + d.cnr, 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-800">
                            {detalleTecnico.dias.reduce((acc, d) => acc + d.kwh_recuperado, 0).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <p className="text-slate-400">No hay datos disponibles para este técnico</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
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
                    <td className={`px-2 py-2 text-right font-semibold ${b.proyeccion >= META_EFECTIVAS_MES ? 'text-green-600' : 'text-red-600'}`}>
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

      {/* Modal Inspecciones del Día */}
      {inspeccionesDia && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setInspeccionesDia(null)}>
          <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-slate-800 text-white px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <span className="font-semibold">{inspeccionesDia.nombre}</span>
                  <span className="text-xs text-slate-300">{inspeccionesDia.zona}</span>
                  <span className="text-xs text-slate-300">
                    {(() => {
                      const [year, month, day] = inspeccionesDia.fecha.split('-');
                      return `${day}-${month}-${year}`;
                    })()}
                  </span>
                </div>
                <button onClick={() => setInspeccionesDia(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              {/* Métricas del día */}
              <div className="grid grid-cols-7 gap-2 text-xs">
                <div className="bg-white/10 rounded px-2 py-1">
                  <div className="text-[9px] text-slate-400 uppercase">Total</div>
                  <div className="font-semibold">{inspeccionesDia.total_inspecciones}</div>
                </div>
                <div className="bg-green-600/20 rounded px-2 py-1">
                  <div className="text-[9px] text-green-300 uppercase">Efectivas</div>
                  <div className="font-semibold text-green-100">{inspeccionesDia.efectivas}</div>
                </div>
                <div className="bg-white/10 rounded px-2 py-1">
                  <div className="text-[9px] text-slate-400 uppercase">Normal</div>
                  <div className="font-semibold">{inspeccionesDia.normal}</div>
                </div>
                <div className="bg-blue-500/20 rounded px-2 py-1">
                  <div className="text-[9px] text-blue-300 uppercase">Mant</div>
                  <div className="font-semibold text-blue-100">{inspeccionesDia.mantenimiento}</div>
                </div>
                <div className="bg-green-500/20 rounded px-2 py-1">
                  <div className="text-[9px] text-green-300 uppercase">VF CGE</div>
                  <div className="font-semibold text-green-100">{inspeccionesDia.vf_cge_pagable}</div>
                </div>
                <div className="bg-red-600/20 rounded px-2 py-1">
                  <div className="text-[9px] text-red-300 uppercase">VF No Ef</div>
                  <div className="font-semibold text-red-100">{inspeccionesDia.vf_no_efectiva}</div>
                </div>
                <div className="bg-green-700/20 rounded px-2 py-1">
                  <div className="text-[9px] text-green-300 uppercase">CNR</div>
                  <div className="font-semibold text-green-100">{inspeccionesDia.cnr}</div>
                </div>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
              {cargandoInspecciones ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-slate-400">Cargando inspecciones...</p>
                </div>
              ) : inspeccionesDia.inspecciones.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-slate-400">No hay inspecciones para este día</p>
                </div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {/* Solo mostrar columna Zona si es consolidado (TODAS) */}
                      {inspeccionesDia.zona === "TODAS" && (
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Zona</th>
                      )}
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
                        {/* Solo mostrar zona si es consolidado */}
                        {inspeccionesDia.zona === "TODAS" && (
                          <td className="px-3 py-2 text-xs text-slate-600">{(insp as any)['zona_inspeccion'] || '-'}</td>
                        )}
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
