'use client';

import React, { useMemo } from 'react';
import { PagoTecnico, CalendarioMes } from '@/types';

interface CalendarioBrigadasProps {
  pagoTecnicos: PagoTecnico[];
  calendario: CalendarioMes;
}

type TipoDia = 'habil' | 'sabado' | 'domingo' | 'feriado';

const INICIAL_DIA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']; // lunes=0 ... domingo=6

function dayOfWeekMon0(año: number, mes: number, dia: number): number {
  // JS Date: 0=Dom..6=Sáb. Convertimos a 0=Lun..6=Dom.
  const js = new Date(año, mes - 1, dia).getDay();
  return (js + 6) % 7;
}

function tipoDia(
  dia: number,
  sabados: Set<number>,
  domingos: Set<number>,
  feriados: Set<number>
): TipoDia {
  if (feriados.has(dia)) return 'feriado';
  if (sabados.has(dia)) return 'sabado';
  if (domingos.has(dia)) return 'domingo';
  return 'habil';
}

export default function CalendarioBrigadas({
  pagoTecnicos,
  calendario,
}: CalendarioBrigadasProps) {
  const sabadosSet = useMemo(() => new Set(calendario.sabados), [calendario.sabados]);
  const domingosSet = useMemo(() => new Set(calendario.domingos), [calendario.domingos]);
  const feriadosSet = useMemo(() => new Set(calendario.feriados), [calendario.feriados]);
  const dias = useMemo(
    () => Array.from({ length: calendario.dias_en_mes }, (_, i) => i + 1),
    [calendario.dias_en_mes]
  );

  const brigadasOperativas = useMemo(
    () => pagoTecnicos.filter((t) => t.dias_trabajados_count > 0),
    [pagoTecnicos]
  );

  // Días hábiles y sábados TRANSCURRIDOS (no futuros): si el mes visualizado
  // es el actual, cortamos en "hoy". Si es pasado, usamos todos.
  const { diasHabilesTranscurridos, sabadosTranscurridos } = useMemo(() => {
    const hoy = new Date();
    const esMesActual =
      calendario.año === hoy.getFullYear() &&
      calendario.numero_mes === hoy.getMonth() + 1;
    const esMesPasado =
      calendario.año < hoy.getFullYear() ||
      (calendario.año === hoy.getFullYear() && calendario.numero_mes < hoy.getMonth() + 1);
    if (!esMesActual && !esMesPasado) return { diasHabilesTranscurridos: 0, sabadosTranscurridos: 0 };
    const ultimoDia = esMesActual ? hoy.getDate() : calendario.dias_en_mes;
    const sabSet = new Set(calendario.sabados);
    const domSet = new Set(calendario.domingos);
    const ferSet = new Set(calendario.feriados);
    let hab = 0;
    let sab = 0;
    for (let d = 1; d <= ultimoDia; d++) {
      if (sabSet.has(d)) sab += 1;
      else if (!domSet.has(d) && !ferSet.has(d)) hab += 1;
    }
    return { diasHabilesTranscurridos: hab, sabadosTranscurridos: sab };
  }, [calendario]);

  const kpis = useMemo(() => {
    const operativas = brigadasOperativas.length;
    const totalDias = brigadasOperativas.reduce((a, t) => a + t.dias_trabajados_count, 0);
    const totalSabados = brigadasOperativas.reduce((a, t) => a + t.sabados_trabajados_count, 0);
    return {
      operativas,
      diasHabiles: calendario.total_habiles,
      diasHabilesTranscurridos,
      promedioDias: operativas > 0 ? totalDias / operativas : 0,
      promedioSabados: operativas > 0 ? totalSabados / operativas : 0,
    };
  }, [brigadasOperativas, calendario.total_habiles, diasHabilesTranscurridos]);

  // Agrupar por zona
  const porZona = useMemo(() => {
    const map: Record<string, PagoTecnico[]> = {};
    pagoTecnicos.forEach((t) => {
      const k = t.zona || '(sin zona)';
      if (!map[k]) map[k] = [];
      map[k].push(t);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => b.dias_trabajados_count - a.dias_trabajados_count)
    );
    const zonasOrdenadas = Object.keys(map).sort();
    return { map, zonasOrdenadas };
  }, [pagoTecnicos]);

  // Conteo operativas por día (fila de totales)
  const operativasPorDia = useMemo(() => {
    const arr = new Array(calendario.dias_en_mes + 1).fill(0);
    pagoTecnicos.forEach((t) => {
      t.dias_trabajados.forEach((d) => {
        if (d >= 1 && d <= calendario.dias_en_mes) arr[d] += 1;
      });
    });
    return arr;
  }, [pagoTecnicos, calendario.dias_en_mes]);

  // Estilos por tipo de día (columna)
  const bgCol: Record<TipoDia, string> = {
    habil: 'bg-white',
    sabado: 'bg-amber-50',
    domingo: 'bg-slate-50',
    feriado: 'bg-violet-50',
  };

  // Marca trabajada según tipo
  const dotClass = (trabajo: boolean, tipo: TipoDia): string => {
    if (!trabajo) {
      if (tipo === 'sabado') return 'bg-amber-100';
      if (tipo === 'feriado') return 'bg-violet-100';
      if (tipo === 'domingo') return 'bg-slate-100';
      return 'bg-slate-200';
    }
    switch (tipo) {
      case 'sabado':
        return 'bg-amber-500';
      case 'feriado':
        return 'bg-violet-500';
      case 'domingo':
        return 'bg-slate-400';
      default:
        return 'bg-oca-blue';
    }
  };

  const ausenciaColor = (aus: number): string => {
    if (aus <= 0) return 'text-slate-400';
    if (aus <= 3) return 'text-amber-600';
    return 'text-red-600 font-semibold';
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Calendario Operativo · {calendario.mes} {calendario.año}
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {kpis.operativas} brigadas operativas · {calendario.dias_en_mes} días del mes · {calendario.total_habiles} hábiles
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Brigadas Operativas</p>
          <p className="text-2xl font-bold text-slate-800">{kpis.operativas}</p>
          <p className="text-[10px] text-slate-400 mt-1">de {pagoTecnicos.length} técnicos</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Días Hábiles del Mes</p>
          <p className="text-2xl font-bold text-slate-800">
            {kpis.diasHabilesTranscurridos}
            <span className="text-slate-400 font-normal">/{kpis.diasHabiles}</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            transcurridos · {calendario.mes}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Promedio Días/Brigada</p>
          <p className="text-2xl font-bold text-slate-800">{kpis.promedioDias.toFixed(1)}</p>
          <p className="text-[10px] text-slate-400 mt-1">de {calendario.dias_en_mes} posibles</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Sábados Operados</p>
          <p className="text-2xl font-bold text-slate-800">{kpis.promedioSabados.toFixed(1)}</p>
          <p className="text-[10px] text-slate-400 mt-1">
            prom. por brigada · {calendario.sabados.length} sábados
          </p>
        </div>
      </div>

      {/* Matriz */}
      <div className="bg-white rounded-lg border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-[10px] border-collapse min-w-[880px]">
            <colgroup>
              <col className="w-[180px]" />
              {dias.map((d) => (
                <col key={`col-${d}`} />
              ))}
              <col className="w-[88px]" />
              <col className="w-[84px]" />
              <col className="w-[60px]" />
            </colgroup>
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">
                  Brigada
                </th>
                {dias.map((d) => {
                  const tipo = tipoDia(d, sabadosSet, domingosSet, feriadosSet);
                  return (
                    <th
                      key={`num-${d}`}
                      className={`px-0 py-1 text-center text-[10px] font-semibold text-slate-500 ${bgCol[tipo]}`}
                    >
                      {d}
                    </th>
                  );
                })}
                <th className="px-1 py-2 text-right text-[10px] font-semibold uppercase text-slate-500 bg-slate-50">Trab</th>
                <th className="px-1 py-2 text-right text-[10px] font-semibold uppercase text-slate-500 bg-slate-50">Sáb</th>
                <th className="px-1 py-2 text-right text-[10px] font-semibold uppercase text-slate-500 bg-slate-50">Aus.H</th>
              </tr>
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 px-3 pb-1 text-left text-[9px] uppercase text-slate-400">
                  L/M/M/J/V/S/D
                </th>
                {dias.map((d) => {
                  const tipo = tipoDia(d, sabadosSet, domingosSet, feriadosSet);
                  const dow = dayOfWeekMon0(calendario.año, calendario.numero_mes, d);
                  return (
                    <th
                      key={`ini-${d}`}
                      className={`px-0 pb-1 text-center text-[9px] text-slate-400 ${bgCol[tipo]}`}
                    >
                      {INICIAL_DIA[dow]}
                    </th>
                  );
                })}
                <th className="bg-slate-50" />
                <th className="bg-slate-50" />
                <th className="bg-slate-50" />
              </tr>
            </thead>
            <tbody>
              {porZona.zonasOrdenadas.map((zona) => {
                const items = porZona.map[zona];
                const operZona = items.filter((t) => t.dias_trabajados_count > 0).length;
                // Días OPERADOS: días distintos donde al menos una brigada de la zona trabajó
                const diasOperadosSet = new Set<number>();
                items.forEach((t) => t.dias_trabajados.forEach((d) => diasOperadosSet.add(d)));
                const diasOperadosZona = diasOperadosSet.size;
                const totDiasBrigZona = items.reduce((a, t) => a + t.dias_trabajados_count, 0);
                const promZona = operZona > 0 ? totDiasBrigZona / operZona : 0;
                return (
                  <React.Fragment key={zona}>
                    <tr className="bg-slate-800 text-white">
                      <td
                        className="sticky left-0 z-10 bg-slate-800 px-3 py-1.5 text-xs font-semibold"
                      >
                        {zona}
                      </td>
                      <td
                        className="px-2 py-1.5 text-[10px] text-slate-200"
                        colSpan={calendario.dias_en_mes + 3}
                      >
                        {operZona} brigadas activas · {diasOperadosZona} días operados · prom {promZona.toFixed(1)} d/brigada
                      </td>
                    </tr>
                    {items.map((t, idx) => {
                      const trabSet = new Set(t.dias_trabajados);
                      const diasHabilesTrabajados = t.dias_trabajados.filter(
                        (d) =>
                          !sabadosSet.has(d) &&
                          !domingosSet.has(d) &&
                          !feriadosSet.has(d)
                      ).length;
                      const ausenciasHabiles = Math.max(
                        0,
                        diasHabilesTranscurridos - diasHabilesTrabajados
                      );
                      return (
                        <tr
                          key={`${zona}-${t.nombre}-${idx}`}
                          className="border-b border-slate-50 hover:bg-slate-50/50"
                        >
                          <td
                            className="sticky left-0 z-10 bg-white px-3 py-1 text-[11px] text-slate-700 truncate max-w-[180px]"
                            title={t.nombre}
                          >
                            {t.nombre}
                          </td>
                          {dias.map((d) => {
                            const tipo = tipoDia(d, sabadosSet, domingosSet, feriadosSet);
                            const trabajo = trabSet.has(d);
                            const dotCls = dotClass(trabajo, tipo);
                            return (
                              <td
                                key={`c-${t.nombre}-${d}`}
                                className={`px-0 py-1 text-center ${bgCol[tipo]}`}
                                title={`Día ${d}${trabajo ? ' · trabajado' : ''}`}
                              >
                                <span
                                  className={`inline-block w-2 h-2 rounded-full ${dotCls}`}
                                />
                              </td>
                            );
                          })}
                          <td className="px-1 py-1 text-right tabular-nums text-[11px] text-slate-700 font-semibold">
                            {t.dias_trabajados_count}
                          </td>
                          <td className="px-1 py-1 text-right tabular-nums text-[11px] text-amber-600">
                            {t.sabados_trabajados_count}
                          </td>
                          <td className={`px-1 py-1 text-right tabular-nums text-[11px] ${ausenciaColor(ausenciasHabiles)}`}>
                            {Math.max(0, ausenciasHabiles)}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300">
              {(() => {
                const totalTrab = pagoTecnicos.reduce((a, t) => a + t.dias_trabajados_count, 0);
                const totalSab = pagoTecnicos.reduce((a, t) => a + t.sabados_trabajados_count, 0);
                const totalAus = pagoTecnicos.reduce((a, t) => {
                  const habTrab = t.dias_trabajados.filter(
                    (d) => !sabadosSet.has(d) && !domingosSet.has(d) && !feriadosSet.has(d)
                  ).length;
                  return a + Math.max(0, diasHabilesTranscurridos - habTrab);
                }, 0);
                const op = brigadasOperativas.length;
                // "Días laborables posibles" por brigada = hábiles transcurridos + sábados transcurridos
                const laborablesPosiblesPorBrigada = diasHabilesTranscurridos + sabadosTranscurridos;
                const totalPosibleTrab = op * laborablesPosiblesPorBrigada;
                const totalPosibleSab = op * sabadosTranscurridos;
                const totalPosibleAus = op * diasHabilesTranscurridos;
                const pctTrab = totalPosibleTrab > 0 ? (totalTrab / totalPosibleTrab) * 100 : 0;
                const pctSab = totalPosibleSab > 0 ? (totalSab / totalPosibleSab) * 100 : 0;
                const pctAus = totalPosibleAus > 0 ? (totalAus / totalPosibleAus) * 100 : 0;
                const promTrab = op > 0 ? totalTrab / op : 0;
                const promSab = op > 0 ? totalSab / op : 0;
                const promAus = op > 0 ? totalAus / op : 0;

                return (
                  <>
                    <tr className="border-t border-slate-200">
                      <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase text-slate-500">
                        Brigadas operativas/día
                      </td>
                      {dias.map((d) => {
                        const tipo = tipoDia(d, sabadosSet, domingosSet, feriadosSet);
                        return (
                          <td
                            key={`tot-${d}`}
                            className={`px-0 py-1 text-center text-[10px] tabular-nums text-slate-600 ${bgCol[tipo]}`}
                          >
                            {operativasPorDia[d] || ''}
                          </td>
                        );
                      })}
                      <td
                        className="px-2 py-2 text-right text-[11px] tabular-nums font-bold text-slate-800 whitespace-nowrap"
                        title={`${totalTrab} de ${totalPosibleTrab} días-brigada laborables transcurridos`}
                      >
                        {totalTrab}
                        <span className="text-slate-400 font-normal"> / {totalPosibleTrab}</span>
                      </td>
                      <td
                        className="px-2 py-2 text-right text-[11px] tabular-nums font-bold text-amber-600 whitespace-nowrap"
                        title={`${totalSab} de ${totalPosibleSab} sábados-brigada transcurridos`}
                      >
                        {totalSab}
                        <span className="text-amber-400/80 font-normal"> / {totalPosibleSab}</span>
                      </td>
                      <td
                        className="px-2 py-2 text-right text-[11px] tabular-nums font-bold text-red-600"
                        title="Total de días hábiles no trabajados (excluye futuros)"
                      >
                        {totalAus}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="sticky left-0 z-10 bg-slate-50 px-3 py-1.5 text-[10px] uppercase text-slate-400">
                        Cobertura / Prom. por brigada
                      </td>
                      <td className="px-0 py-1.5" colSpan={calendario.dias_en_mes} />
                      <td className="px-2 py-1.5 text-right text-[10px] tabular-nums whitespace-nowrap">
                        <span className="font-semibold text-slate-700">{pctTrab.toFixed(0)}%</span>
                        <span className="text-slate-300 mx-1">·</span>
                        <span className="text-slate-500">{promTrab.toFixed(1)}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-[10px] tabular-nums whitespace-nowrap">
                        <span className="font-semibold text-amber-600">{pctSab.toFixed(0)}%</span>
                        <span className="text-amber-300 mx-1">·</span>
                        <span className="text-amber-500">{promSab.toFixed(1)}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-[10px] tabular-nums whitespace-nowrap">
                        <span className="font-semibold text-red-600">{pctAus.toFixed(0)}%</span>
                        <span className="text-red-300 mx-1">·</span>
                        <span className="text-red-500">{promAus.toFixed(1)}</span>
                      </td>
                    </tr>
                  </>
                );
              })()}
            </tfoot>
          </table>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-oca-blue" /> Trabajado hábil
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500" /> Sábado trabajado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-violet-500" /> Feriado trabajado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-50 border border-amber-200" /> Columna sábado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-slate-50 border border-slate-200" /> Columna domingo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-violet-50 border border-violet-200" /> Columna feriado
        </span>
      </div>
    </div>
  );
}
