'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Filters,
  DetalleTecnicoDiario,
  Justificacion,
  Analista,
  CatalogosJustificacion,
  ResumenMesPersona,
} from '@/types';
import { getDetalleTecnicoDiario } from '@/lib/api';
import {
  getCatalogos,
  getJustificacionesPersona,
  getResumenPersona,
} from '@/lib/api/justificaciones';
import { listAnalistas } from '@/lib/api/analistas';
import CalendarioMes, { DiaCalendario } from './CalendarioMes';
import ResumenMes from './ResumenMes';
import DiaPanel from './DiaPanel';
import TablaDetalleDia from './TablaDetalleDia';

export interface BrigadaSeleccionada {
  nombre: string;
  zona: string;
  diasTrabajados: number;
  efectivasTotal: number;
  efectivasDia: number;
  proyeccion: number;
  pctAvance: number;
  estado: 'cumplida' | 'en_camino' | 'no_alcanzara';
  kwhRecuperado: number;
  trabajaEnMultiplesZonas: boolean;
}

interface Props {
  brigada: BrigadaSeleccionada;
  filters: Filters;
  metaEfectivasMes: number;
  todasLasBrigadas: BrigadaSeleccionada[];
  onClose: () => void;
  onNavegar: (direccion: 'anterior' | 'siguiente') => void;
}

export default function PersonaModal({
  brigada, filters, metaEfectivasMes, todasLasBrigadas, onClose, onNavegar,
}: Props) {
  const [detalle, setDetalle] = useState<DetalleTecnicoDiario | null>(null);
  const [justificaciones, setJustificaciones] = useState<Justificacion[]>([]);
  const [resumen, setResumen] = useState<ResumenMesPersona | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosJustificacion | null>(null);
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  // Suppress unused variable warnings for props used only in child usage patterns
  void metaEfectivasMes;
  void todasLasBrigadas;

  const mes = useMemo(() => deducirMes(detalle), [detalle]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [det, cat, ans] = await Promise.all([
        getDetalleTecnicoDiario(brigada.nombre, null, filters),
        catalogos ? Promise.resolve(catalogos) : getCatalogos(),
        analistas.length ? Promise.resolve(analistas) : listAnalistas(true),
      ]);
      setDetalle(det);
      if (!catalogos) setCatalogos(cat);
      if (!analistas.length) setAnalistas(ans);

      const mesDeducido = deducirMesFromDetalle(det);
      if (mesDeducido) {
        const [j, r] = await Promise.all([
          getJustificacionesPersona(brigada.nombre, mesDeducido),
          getResumenPersona(brigada.nombre, mesDeducido, filters),
        ]);
        setJustificaciones(j.justificaciones);
        setResumen(r);
      }
    } finally {
      setCargando(false);
    }
  }, [brigada.nombre, filters, catalogos, analistas]);

  useEffect(() => {
    setDiaSeleccionado(null);
    cargar();
  }, [brigada.nombre]);  // eslint-disable-line react-hooks/exhaustive-deps

  const refetchJustificaciones = useCallback(async () => {
    if (!mes) return;
    const [j, r] = await Promise.all([
      getJustificacionesPersona(brigada.nombre, mes),
      getResumenPersona(brigada.nombre, mes, filters),
    ]);
    setJustificaciones(j.justificaciones);
    setResumen(r);
  }, [brigada.nombre, filters, mes]);

  const motivosLabel: Record<string, string> = useMemo(() => {
    if (!catalogos) return {};
    const map: Record<string, string> = {};
    [...catalogos.motivos_no_trabajado, ...catalogos.motivos_baja_produccion]
      .forEach(m => { map[m.value] = m.label; });
    return map;
  }, [catalogos]);

  const diaCalData = useMemo<DiaCalendario | null>(() => {
    if (!diaSeleccionado || !detalle || !catalogos) return null;
    const c = detalle.calendario.find(x => x.fecha === diaSeleccionado);
    if (!c) return null;
    const dat = detalle.dias.find(x => x.fecha === diaSeleccionado);
    const efectivas = dat ? dat.efectivas : null;
    const justificacion = justificaciones.find(j => j.fecha === diaSeleccionado) ?? null;
    const umbral = catalogos.umbral_baja_produccion * catalogos.meta_diaria;
    let estado: DiaCalendario['estado'];
    if (c.es_futuro) estado = 'futuro';
    else if (c.es_feriado) estado = 'feriado';
    else if (!c.es_habil) estado = 'fin_semana';
    else if (!c.trabajo) estado = 'sin_trabajo';
    else if ((efectivas ?? 0) < umbral) estado = 'baja_produccion';
    else estado = 'trabajado_ok';
    return {
      fecha: c.fecha,
      dia: c.dia,
      diaSemana: c.dia_semana,
      estado,
      efectivas,
      metaDiaria: catalogos.meta_diaria,
      justificacion,
      esJustificable:
        (estado === 'sin_trabajo' || estado === 'baja_produccion') && !c.es_futuro,
    };
  }, [diaSeleccionado, detalle, catalogos, justificaciones]);

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
          <div className="flex items-center gap-4 min-w-0">
            <span className="font-semibold truncate">{brigada.nombre}</span>
            <span className="text-xs text-slate-300 truncate">{brigada.zona}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              brigada.estado === 'cumplida' ? 'bg-emerald-500/20 text-emerald-200' :
              brigada.estado === 'en_camino' ? 'bg-amber-500/20 text-amber-200' :
              'bg-red-500/20 text-red-200'
            }`}>
              {labelEstadoMeta(brigada.estado)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavegar('anterior')}
              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
            >Anterior</button>
            <button
              onClick={() => onNavegar('siguiente')}
              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
            >Siguiente</button>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">x</button>
          </div>
        </div>

        {/* Body con scroll vertical único */}
        <div className="flex-1 overflow-y-auto">
          {/* Grid 2 columnas: calendario + panel */}
          <div className="grid grid-cols-[60%_40%]">
            {/* Calendario */}
            <div className="p-4 border-r border-slate-200">
              {cargando && !detalle ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-oca-blue" />
                </div>
              ) : detalle && catalogos ? (
                <CalendarioMes
                  detalle={detalle}
                  justificaciones={justificaciones}
                  metaDiaria={catalogos.meta_diaria}
                  umbralBajaProduccion={catalogos.umbral_baja_produccion}
                  diaSeleccionado={diaSeleccionado}
                  onSeleccionarDia={setDiaSeleccionado}
                />
              ) : (
                <p className="text-slate-400 text-sm">Sin datos</p>
              )}
            </div>

            {/* Panel derecho */}
            <div className="p-4">
              {diaCalData && catalogos ? (
                <DiaPanel
                  dia={diaCalData}
                  tecnicoNombre={brigada.nombre}
                  zonaOrigen={brigada.zona}
                  catalogos={catalogos}
                  analistas={analistas}
                  motivosLabel={motivosLabel}
                  onCambioJustificacion={refetchJustificaciones}
                />
              ) : (
                <ResumenMes
                  resumen={resumen}
                  cargando={cargando}
                  diasTrabajados={brigada.diasTrabajados}
                  efectivasDia={brigada.efectivasDia}
                  metaDiaria={catalogos?.meta_diaria ?? 8}
                />
              )}
            </div>
          </div>

          {/* Tabla detalle por día (full width) */}
          {detalle && (
            <div className="border-t border-slate-200 p-4 bg-slate-50/40">
              <TablaDetalleDia
                detalle={detalle}
                diaSeleccionado={diaSeleccionado}
                onSeleccionarDia={setDiaSeleccionado}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function deducirMesFromDetalle(d: DetalleTecnicoDiario): string | null {
  if (d.calendario.length === 0) return null;
  const f = d.calendario[0].fecha;
  return f.slice(0, 7);
}

function deducirMes(d: DetalleTecnicoDiario | null): string | null {
  return d ? deducirMesFromDetalle(d) : null;
}

function labelEstadoMeta(s: BrigadaSeleccionada['estado']): string {
  switch (s) {
    case 'cumplida': return 'Meta Cumplida';
    case 'en_camino': return 'En Camino';
    case 'no_alcanzara': return 'No Alcanzara';
  }
}
