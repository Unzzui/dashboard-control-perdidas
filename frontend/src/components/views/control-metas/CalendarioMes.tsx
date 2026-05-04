'use client';

import { DetalleTecnicoDiario, Justificacion } from '@/types';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export type EstadoDia =
  | 'trabajado_ok'
  | 'baja_produccion'
  | 'sin_trabajo'
  | 'feriado'
  | 'fin_semana'
  | 'futuro';

export interface DiaCalendario {
  fecha: string;
  dia: number;
  diaSemana: string;
  estado: EstadoDia;
  efectivas: number | null;
  metaDiaria: number;
  justificacion: Justificacion | null;
  esJustificable: boolean;       // true si es candidato a justificar (rojo o amarillo, no futuro)
}

interface Props {
  detalle: DetalleTecnicoDiario;
  justificaciones: Justificacion[];
  metaDiaria: number;
  umbralBajaProduccion: number;   // 0.5
  diaSeleccionado: string | null;
  onSeleccionarDia: (fecha: string) => void;
}

export default function CalendarioMes({
  detalle, justificaciones, metaDiaria, umbralBajaProduccion,
  diaSeleccionado, onSeleccionarDia,
}: Props) {
  if (detalle.calendario.length === 0) return null;

  const dias = construirDias(
    detalle, justificaciones, metaDiaria, umbralBajaProduccion
  );
  const primero = dias[0];
  const [year, month] = primero.fecha.split('-');
  const mesNombre = MESES[parseInt(month, 10) - 1];

  const fechaPrimerDiaMes = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  let offsetSemana = fechaPrimerDiaMes.getDay();
  offsetSemana = offsetSemana === 0 ? 6 : offsetSemana - 1;

  return (
    <div className="bg-white border border-slate-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-800">{mesNombre} {year}</p>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">
          {detalle.total_dias} días trabajados
        </p>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-slate-500 py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: offsetSemana }).map((_, i) => (
          <div key={`empty-${i}`} className="h-16" />
        ))}
        {dias.map(d => (
          <CeldaDia
            key={d.fecha}
            dia={d}
            seleccionado={d.fecha === diaSeleccionado}
            onClick={() => d.esJustificable || d.justificacion ? onSeleccionarDia(d.fecha) : undefined}
          />
        ))}
      </div>

      <Leyenda />
    </div>
  );
}

function CeldaDia({
  dia, seleccionado, onClick,
}: {
  dia: DiaCalendario;
  seleccionado: boolean;
  onClick: () => void;
}) {
  const styles = estiloPorEstado(dia.estado);
  const cursor = (dia.esJustificable || dia.justificacion) ? 'cursor-pointer' : 'cursor-default';
  const ring = seleccionado ? 'ring-2 ring-slate-800' : '';
  const justifBorde = dia.justificacion ? 'border-dashed' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-16 rounded ${styles.bg} ${styles.border} ${justifBorde} ${ring} ${cursor} flex flex-col items-center justify-center gap-0.5 transition hover:scale-[1.02]`}
      title={tooltipDia(dia)}
    >
      <span className={`absolute top-1 left-1.5 text-[10px] font-bold ${styles.text}`}>
        {dia.dia}
      </span>
      {dia.efectivas !== null && (
        <span className={`text-base font-bold ${styles.text}`}>{dia.efectivas}</span>
      )}
      {dia.estado === 'trabajado_ok' || dia.estado === 'baja_produccion' ? (
        <BarraCumplimiento valor={dia.efectivas ?? 0} meta={dia.metaDiaria} />
      ) : null}
      {dia.justificacion && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-700" />
      )}
    </button>
  );
}

function BarraCumplimiento({ valor, meta }: { valor: number; meta: number }) {
  const pct = Math.min(100, (valor / meta) * 100);
  return (
    <div className="absolute bottom-1 left-1 right-1 h-0.5 bg-white/40 rounded-full overflow-hidden">
      <div className="h-full bg-white/80" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Leyenda() {
  return (
    <div className="mt-3 pt-2 border-t border-slate-200 flex flex-wrap gap-3 text-[10px] text-slate-600">
      <Item color="bg-emerald-500" label="Cumplió" />
      <Item color="bg-amber-200 border border-amber-300" label="Baja" />
      <Item color="bg-red-50 border border-red-300" label="Sin trabajo" />
      <Item color="bg-blue-50 border border-blue-200" label="Feriado" />
      <Item color="bg-slate-100" label="Fin sem." />
      <Item color="bg-white border border-slate-200" label="Futuro" />
      <Item color="bg-slate-700 rounded-full w-1.5 h-1.5" label="Justificado" />
    </div>
  );
}

function Item({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded ${color}`} />
      {label}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function construirDias(
  detalle: DetalleTecnicoDiario,
  justificaciones: Justificacion[],
  metaDiaria: number,
  umbralBajaProduccion: number,
): DiaCalendario[] {
  const dataDia = new Map<string, number>();
  detalle.dias.forEach(d => { dataDia.set(d.fecha, d.efectivas); });
  const justifMap = new Map<string, Justificacion>();
  justificaciones.forEach(j => { justifMap.set(j.fecha, j); });

  const umbral = umbralBajaProduccion * metaDiaria;

  return detalle.calendario.map(c => {
    const efectivas = dataDia.has(c.fecha) ? dataDia.get(c.fecha)! : null;
    const justificacion = justifMap.get(c.fecha) ?? null;

    let estado: EstadoDia;
    if (c.es_futuro) estado = 'futuro';
    else if (c.es_feriado) estado = 'feriado';
    else if (!c.es_habil) estado = 'fin_semana';
    else if (!c.trabajo) estado = 'sin_trabajo';
    else if ((efectivas ?? 0) < umbral) estado = 'baja_produccion';
    else estado = 'trabajado_ok';

    const esJustificable =
      (estado === 'sin_trabajo' || estado === 'baja_produccion') && !c.es_futuro;

    return {
      fecha: c.fecha,
      dia: c.dia,
      diaSemana: c.dia_semana,
      estado,
      efectivas,
      metaDiaria,
      justificacion,
      esJustificable,
    };
  });
}

function estiloPorEstado(estado: EstadoDia) {
  switch (estado) {
    case 'trabajado_ok':
      return { bg: 'bg-emerald-500', text: 'text-white', border: '' };
    case 'baja_produccion':
      return { bg: 'bg-amber-200', text: 'text-amber-900', border: 'border border-amber-300' };
    case 'sin_trabajo':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border border-red-300' };
    case 'feriado':
      return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border border-blue-200' };
    case 'fin_semana':
      return { bg: 'bg-slate-100', text: 'text-slate-400', border: '' };
    case 'futuro':
      return { bg: 'bg-white', text: 'text-slate-300', border: 'border border-slate-200' };
  }
}

function tooltipDia(d: DiaCalendario): string {
  const partes = [`${d.diaSemana} ${d.dia}`];
  if (d.efectivas !== null) partes.push(`Efectivas: ${d.efectivas}`);
  if (d.justificacion) partes.push(`Justificado: ${d.justificacion.motivo}`);
  return partes.join(' · ');
}
