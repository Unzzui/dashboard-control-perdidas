'use client';

import { ReactNode, useEffect, useState } from 'react';
import { Filters, DetalleTecnicoDiario, InspeccionesDia } from '@/types';
import { getDetalleTecnicoDiario, getInspeccionesDia } from '@/lib/api';

interface DetalleTecnicoDiarioModalProps {
  nombre: string;
  zona: string;
  filters: Filters;
  onClose: () => void;
  titulo?: string;
  badge?: { texto: string; clase: string };
  kpisTop?: ReactNode;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function DetalleTecnicoDiarioModal({
  nombre,
  zona,
  filters,
  onClose,
  titulo,
  badge,
  kpisTop,
}: DetalleTecnicoDiarioModalProps) {
  const [detalleTecnico, setDetalleTecnico] = useState<DetalleTecnicoDiario | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [mostrarCalendario, setMostrarCalendario] = useState(true);
  const [inspeccionesDia, setInspeccionesDia] = useState<InspeccionesDia | null>(null);
  const [cargandoInspecciones, setCargandoInspecciones] = useState(false);

  useEffect(() => {
    setDetalleTecnico(null);
    setCargandoDetalle(true);
    const timer = setTimeout(() => {
      getDetalleTecnicoDiario(nombre, null, filters)
        .then((data) => setDetalleTecnico(data))
        .catch((err) => console.error('Error cargando detalle del técnico:', err))
        .finally(() => setCargandoDetalle(false));
    }, 100);
    return () => clearTimeout(timer);
  }, [nombre, filters]);

  const cargarInspeccionesDia = async (fecha: string) => {
    if (!detalleTecnico) return;
    setCargandoInspecciones(true);
    try {
      const data = await getInspeccionesDia(nombre, detalleTecnico.zona, fecha, filters);
      setInspeccionesDia(data);
    } catch (err) {
      console.error('Error cargando inspecciones:', err);
      setInspeccionesDia(null);
    } finally {
      setCargandoInspecciones(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-wrap">
              <span className="font-semibold truncate">{nombre}</span>
              <span className="text-xs text-slate-300 truncate">{zona}</span>
              {titulo && <span className="text-xs text-slate-400">{titulo}</span>}
              {badge && (
                <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${badge.clase}`}>
                  {badge.texto}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl leading-none"
            >
              ✕
            </button>
          </div>

          <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)] space-y-3">
            {/* KPIs específicos del caso */}
            {kpisTop && <div>{kpisTop}</div>}

            {/* Calendario */}
            {cargandoDetalle && !detalleTecnico && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-oca-blue" />
              </div>
            )}

            {detalleTecnico && detalleTecnico.calendario.length > 0 && (
              <CalendarioMensual
                detalle={detalleTecnico}
                mostrar={mostrarCalendario}
                onToggle={() => setMostrarCalendario(!mostrarCalendario)}
                onClickDia={cargarInspeccionesDia}
              />
            )}

            {/* Tabla Detalle por Día */}
            <div className="bg-white border border-slate-200/60 rounded-lg overflow-hidden">
              <div className="bg-slate-800 text-white px-3 py-2">
                <span className="font-semibold text-xs">Detalle por Día</span>
              </div>
              <div className="overflow-x-auto">
                {cargandoDetalle ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-oca-blue" />
                  </div>
                ) : detalleTecnico && detalleTecnico.dias.length > 0 ? (
                  <TablaDetalleDia detalle={detalleTecnico} onClickDia={cargarInspeccionesDia} />
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

      {/* Sub-modal: Inspecciones del Día */}
      {inspeccionesDia && (
        <InspeccionesDiaModalView
          inspecciones={inspeccionesDia}
          cargando={cargandoInspecciones}
          onClose={() => setInspeccionesDia(null)}
        />
      )}
    </>
  );
}

// =============================================================================
// Sub-componentes internos
// =============================================================================

function CalendarioMensual({
  detalle,
  mostrar,
  onToggle,
  onClickDia,
}: {
  detalle: DetalleTecnicoDiario;
  mostrar: boolean;
  onToggle: () => void;
  onClickDia: (fecha: string) => void;
}) {
  const habiles = detalle.calendario.filter((d) => d.es_habil).length;
  const primerDia = detalle.calendario[0];
  const [year, month] = primerDia.fecha.split('-');
  const mesNombre = MESES[parseInt(month, 10) - 1];

  const fechaPrimerDia = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  let diaSemanaInicio = fechaPrimerDia.getDay();
  diaSemanaInicio = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between transition-all"
      >
        <div className="text-left">
          <p className="text-xs font-semibold text-slate-800">Calendario de Asistencia</p>
          <p className="text-[10px] text-slate-500">
            {detalle.total_dias} de {habiles} días hábiles trabajados · {mesNombre} {year}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${mostrar ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {mostrar && (
        <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 max-w-md mx-auto">
          <div className="bg-white rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-800 mb-2 text-center">
              {mesNombre} {year}
            </p>
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia) => (
                <div
                  key={dia}
                  className="text-center text-[9px] font-bold text-slate-600 py-1 bg-slate-100 rounded"
                >
                  {dia}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: diaSemanaInicio }).map((_, i) => (
                <div key={`empty-${i}`} className="h-9 bg-slate-50/50 rounded" />
              ))}
              {detalle.calendario.map((dia, idx) => {
                const diaData = detalle.dias.find((d) => d.fecha === dia.fecha);
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

                return (
                  <div
                    key={idx}
                    className={`h-9 rounded ${colorClass} flex flex-col items-center justify-center text-center group relative ${dia.trabajo ? 'cursor-pointer' : 'cursor-default'} transition-all hover:scale-105 hover:shadow-md`}
                    title={`${dia.dia_semana} ${dia.dia}${dia.trabajo ? ` · ${diaData?.efectivas} efectivas · Click para detalle` : dia.es_futuro ? ' · Futuro' : ''}`}
                    onClick={() => dia.trabajo && onClickDia(dia.fecha)}
                  >
                    <span className={`text-[10px] font-bold ${textClass} leading-none`}>{dia.dia}</span>
                    {dia.trabajo && diaData && (
                      <span className="text-[8px] text-white font-semibold bg-white/20 px-0.5 rounded leading-none mt-0.5">
                        {diaData.efectivas}
                      </span>
                    )}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 pointer-events-none">
                      <div className="bg-slate-900 text-white text-[9px] rounded px-2 py-1.5 whitespace-nowrap shadow-xl">
                        <div className="font-bold text-[10px] mb-1 border-b border-slate-700 pb-0.5">
                          {dia.dia_semana} {dia.dia}
                        </div>
                        {dia.trabajo && diaData ? (
                          <div className="space-y-0.5">
                            <Row label="Efectivas" value={diaData.efectivas} color="text-green-400" />
                            <Row label="CNR" value={diaData.cnr} />
                            <Row label="Normal" value={diaData.normal} />
                            <Row label="VF" value={diaData.visita_fallida} color="text-red-400" />
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
              })}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap justify-center items-center gap-2 text-[9px]">
              <LegendItem color="bg-green-500 shadow-sm" label="Trabajado" />
              <LegendItem color="bg-red-50 border border-red-300" label="Sin trabajo" />
              <LegendItem color="bg-blue-50 border border-blue-200" label="Feriado" />
              <LegendItem color="bg-white border border-slate-200" label="Futuro" />
              <LegendItem color="bg-slate-100 border border-slate-200" label="Fin de sem." />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400">{label}:</span>
      <span className={`font-semibold ${color ?? ''}`}>{value}</span>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className={`w-3 h-3 rounded ${color}`} />
      <span className="text-slate-600">{label}</span>
    </div>
  );
}

function TablaDetalleDia({
  detalle,
  onClickDia,
}: {
  detalle: DetalleTecnicoDiario;
  onClickDia: (fecha: string) => void;
}) {
  const totales = detalle.dias.reduce(
    (acc, d) => ({
      visitas_totales: acc.visitas_totales + d.visitas_totales,
      efectivas: acc.efectivas + d.efectivas,
      normal: acc.normal + d.normal,
      mantenimiento: acc.mantenimiento + d.mantenimiento,
      vf_cge_pagable: acc.vf_cge_pagable + d.vf_cge_pagable,
      vf_no_efectiva: acc.vf_no_efectiva + d.vf_no_efectiva,
      cnr: acc.cnr + d.cnr,
      kwh_recuperado: acc.kwh_recuperado + d.kwh_recuperado,
    }),
    { visitas_totales: 0, efectivas: 0, normal: 0, mantenimiento: 0, vf_cge_pagable: 0, vf_no_efectiva: 0, cnr: 0, kwh_recuperado: 0 }
  );

  return (
    <table className="w-full text-[11px]">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Fecha</th>
          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Día</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Tot Visit</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-green-700 bg-green-50">Efectivas</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Normal</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Mant</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">VF CGE</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">VF No Ef</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">CNR</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">kWh</th>
        </tr>
      </thead>
      <tbody>
        {detalle.dias.map((dia, idx) => {
          const [year, month, day] = dia.fecha.split('-');
          const fechaFormateada = `${day}-${month}-${year}`;
          return (
            <tr
              key={idx}
              className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
              onClick={() => onClickDia(dia.fecha)}
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
          <td className="px-3 py-2 font-semibold text-slate-800" colSpan={2}>
            TOTAL ({detalle.total_dias} días)
          </td>
          <td className="px-3 py-2 text-right font-bold text-slate-800">{totales.visitas_totales}</td>
          <td className="px-3 py-2 text-right font-bold text-green-700 bg-green-50">{totales.efectivas}</td>
          <td className="px-3 py-2 text-right font-bold text-slate-700">{totales.normal}</td>
          <td className="px-3 py-2 text-right font-bold text-blue-600">{totales.mantenimiento}</td>
          <td className="px-3 py-2 text-right font-bold text-green-600">{totales.vf_cge_pagable}</td>
          <td className="px-3 py-2 text-right font-bold text-red-600">{totales.vf_no_efectiva}</td>
          <td className="px-3 py-2 text-right font-bold text-slate-800">{totales.cnr}</td>
          <td className="px-3 py-2 text-right font-bold text-slate-800">{totales.kwh_recuperado.toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function InspeccionesDiaModalView({
  inspecciones,
  cargando,
  onClose,
}: {
  inspecciones: InspeccionesDia;
  cargando: boolean;
  onClose: () => void;
}) {
  const [year, month, day] = inspecciones.fecha.split('-');
  const fechaFormateada = `${day}-${month}-${year}`;
  const isConsolidado = inspecciones.zona === 'TODAS';

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-800 text-white px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 min-w-0">
              <span className="font-semibold truncate">{inspecciones.nombre}</span>
              <span className="text-xs text-slate-300 truncate">{inspecciones.zona}</span>
              <span className="text-xs text-slate-300">{fechaFormateada}</span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-xs">
            <Metric label="Total" value={inspecciones.total_inspecciones} />
            <Metric label="Efectivas" value={inspecciones.efectivas} tone="green-strong" />
            <Metric label="Normal" value={inspecciones.normal} />
            <Metric label="Mant" value={inspecciones.mantenimiento} tone="blue" />
            <Metric label="VF CGE" value={inspecciones.vf_cge_pagable} tone="green" />
            <Metric label="VF No Ef" value={inspecciones.vf_no_efectiva} tone="red" />
            <Metric label="CNR" value={inspecciones.cnr} tone="green-strong" />
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
          {cargando ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-400">Cargando inspecciones...</p>
            </div>
          ) : inspecciones.inspecciones.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-400">No hay inspecciones para este día</p>
            </div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {isConsolidado && (
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
                {inspecciones.inspecciones.map((insp, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/80">
                    {isConsolidado && (
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {(insp as unknown as { zona_inspeccion?: string })['zona_inspeccion'] || '-'}
                      </td>
                    )}
                    <td className="px-3 py-2 text-slate-800 font-medium">{insp['ID Medida'] || '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{insp['Aviso'] || '-'}</td>
                    <td
                      className={`px-3 py-2 font-semibold ${
                        insp['Resultado visita'] === 'CNR'
                          ? 'text-green-600'
                          : insp['Resultado visita'] === 'Visita fallida'
                          ? 'text-red-600'
                          : 'text-slate-800'
                      }`}
                    >
                      {insp['Resultado visita'] || '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-[180px] truncate" title={insp['Resultado final'] || '-'}>
                      {insp['Resultado visita'] === 'Visita fallida' ? insp['Resultado final'] || '-' : '-'}
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
  );
}

function Metric({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'green' | 'green-strong' | 'red' | 'blue' }) {
  const bg = {
    'default': 'bg-white/10',
    'green': 'bg-green-500/20',
    'green-strong': 'bg-green-600/20',
    'red': 'bg-red-600/20',
    'blue': 'bg-blue-500/20',
  }[tone];
  const label_color = {
    'default': 'text-slate-400',
    'green': 'text-green-300',
    'green-strong': 'text-green-300',
    'red': 'text-red-300',
    'blue': 'text-blue-300',
  }[tone];
  const val_color = {
    'default': '',
    'green': 'text-green-100',
    'green-strong': 'text-green-100',
    'red': 'text-red-100',
    'blue': 'text-blue-100',
  }[tone];
  return (
    <div className={`rounded px-2 py-1 ${bg}`}>
      <div className={`text-[9px] uppercase ${label_color}`}>{label}</div>
      <div className={`font-semibold ${val_color}`}>{value}</div>
    </div>
  );
}
