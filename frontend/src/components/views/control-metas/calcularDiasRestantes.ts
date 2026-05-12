import { CalendarioMes } from '@/types';

/**
 * Días hábiles restantes contados sobre el calendario real (excluye sáb/dom/feriados CL).
 * - Mes pasado → 0.
 * - Mes actual → desde mañana hasta fin de mes, sin sáb/dom/feriados.
 * - Mes futuro → todos los hábiles del mes.
 */
export function calcularDiasRestantes(calendarioMes: CalendarioMes | null | undefined): number {
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
}
