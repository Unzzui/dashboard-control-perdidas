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

  const kpis = useMemo(() => {
    const operativas = brigadasOperativas.length;
    const totalDias = brigadasOperativas.reduce((a, t) => a + t.dias_trabajados_count, 0);
    const totalSabados = brigadasOperativas.reduce((a, t) => a + t.sabados_trabajados_count, 0);
    return {
      operativas,
      diasHabiles: calendario.total_habiles,
      promedioDias: operativas > 0 ? totalDias / operativas : 0,
      promedioSabados: operativas > 0 ? totalSabados / operativas : 0,
    };
  }, [brigadasOperativas, calendario.total_habiles]);

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
          <p className="text-2xl font-bold text-slate-800">{kpis.diasHabiles}</p>
          <p className="text-[10px] text-slate-400 mt-1">Lun–Vie en {calendario.mes}</p>
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
          <table className="text-[10px] border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500 min-w-[180px]">
                  Brigada
                </th>
                {dias.map((d) => {
                  const tipo = tipoDia(d, sabadosSet, domingosSet, feriadosSet);
                  return (
                    <th
                      key={`num-${d}`}
                      className={`px-0 py-1 text-center text-[10px] font-semibold text-slate-500 w-6 ${bgCol[tipo]}`}
                    >
                      {d}
                    </th>
                  );
                })}
                <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500 bg-slate-50 w-12">Trab</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500 bg-slate-50 w-12">Sáb</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500 bg-slate-50 w-14">Aus.H</th>
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
                const totDiasZona = items.reduce((a, t) => a + t.dias_trabajados_count, 0);
                const promZona = operZona > 0 ? totDiasZona / operZona : 0;
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
                        {operZona} brigadas activas · {totDiasZona} días trab · prom {promZona.toFixed(1)} d/brigada
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
                      const ausenciasHabiles = calendario.total_habiles - diasHabilesTrabajados;
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
                                  className={`inline-block w-1.5 h-1.5 rounded-full ${dotCls}`}
                                />
                              </td>
                            );
                          })}
                          <td className="px-2 py-1 text-right tabular-nums text-[11px] text-slate-700 font-semibold">
                            {t.dias_trabajados_count}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums text-[11px] text-amber-600">
                            {t.sabados_trabajados_count}
                          </td>
                          <td className={`px-2 py-1 text-right tabular-nums text-[11px] ${ausenciaColor(ausenciasHabiles)}`}>
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
              <tr>
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
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
              </tr>
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
