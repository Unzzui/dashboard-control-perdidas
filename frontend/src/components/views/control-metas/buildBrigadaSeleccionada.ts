import { TecnicoRanking } from '@/types';
import { BrigadaSeleccionada } from './PersonaModal';

export type EstadoMeta = 'cumplida' | 'en_camino' | 'no_alcanzara';

/**
 * Extensión de BrigadaSeleccionada con campos que solo ControlMetas necesita
 * (ranking, faltan, globales). Está en este módulo para que ambos consumidores
 * (ControlMetas y otros futuros) puedan reusarlo.
 */
export interface BrigadaMeta extends BrigadaSeleccionada {
  faltanParaMeta: number;
  cnrDia: number;
  efectivasGlobal: number;
  efectivasDiaGlobal: number;
  diasGlobal: number;
  cumpleMetaGlobal: boolean;
}

/**
 * Convierte un TecnicoRanking en BrigadaMeta calculando estado de meta,
 * proyección, % avance y faltantes.
 *
 * Para técnicos multi-zona usa los totales globales (la meta es global, no por zona).
 */
export function buildBrigadaSeleccionada(
  t: TecnicoRanking,
  metaEfectivasMes: number,
  diasRestantes: number,
): BrigadaMeta {
  const trabajaEnMultiplesZonas = t.cantidad_zonas > 1;

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

  return {
    nombre: t.nombre,
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
    trabajaEnMultiplesZonas,
    efectivasGlobal: t.efectivas_global,
    efectivasDiaGlobal: t.promedio_efectivas_global,
    diasGlobal: t.dias_global,
    cumpleMetaGlobal: t.cumple_meta_global,
  };
}
