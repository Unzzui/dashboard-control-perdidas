'use client';

import { ResumenMesPersona } from '@/types';

interface Props {
  resumen: ResumenMesPersona | null;
  cargando: boolean;
  diasTrabajados: number;
  efectivasDia: number;
  metaDiaria: number;
}

export default function ResumenMes({
  resumen, cargando, diasTrabajados, efectivasDia, metaDiaria,
}: Props) {
  if (cargando) {
    return <Skeleton />;
  }
  if (!resumen) {
    return <p className="text-slate-400 text-sm">Sin datos del mes.</p>;
  }

  const cumplimientoOk = resumen.cumplimiento_real >= 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <KPI label="Días trabajados" value={diasTrabajados.toString()} />
        <KPI label="Total efectivas" value={resumen.efectivas_totales.toString()} />
        <KPI
          label="Ef/día"
          value={efectivasDia.toFixed(1)}
          tone={efectivasDia >= metaDiaria ? 'success' : 'warning'}
        />
        <KPI
          label="% Avance real"
          value={`${(resumen.cumplimiento_real * 100).toFixed(0)}%`}
          tone={cumplimientoOk ? 'success' : 'warning'}
        />
      </div>

      {resumen.cumplimiento_ajustado !== resumen.cumplimiento_real && (
        <div className="rounded border border-slate-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">
            % Avance ajustado
          </p>
          <p className="text-lg font-bold text-slate-800">
            {(resumen.cumplimiento_ajustado * 100).toFixed(0)}%
          </p>
          <p className="text-[10px] text-slate-500">excluye días justificados</p>
        </div>
      )}

      <div className="border-t border-slate-200 pt-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
          Estado del mes
        </p>
        <Linea
          label="Sin trabajo"
          total={resumen.dias_no_trabajados_total}
          justificados={resumen.dias_no_trabajados_justificados}
          color="bg-red-400"
        />
        <Linea
          label="Baja producción"
          total={resumen.dias_baja_produccion_total}
          justificados={resumen.dias_baja_produccion_justificados}
          color="bg-amber-400"
        />

        {resumen.dias_pendientes_justificar > 0 && (
          <div className="mt-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
            <span className="font-semibold">{resumen.dias_pendientes_justificar}</span>{' '}
            día{resumen.dias_pendientes_justificar > 1 ? 's' : ''} sin justificar
          </div>
        )}
      </div>
    </div>
  );
}

function KPI({
  label, value, tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const text =
    tone === 'success' ? 'text-emerald-600' :
    tone === 'warning' ? 'text-red-600' : 'text-slate-800';
  return (
    <div className="bg-slate-50 rounded p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-xl font-bold ${text}`}>{value}</p>
    </div>
  );
}

function Linea({
  label, total, justificados, color,
}: {
  label: string;
  total: number;
  justificados: number;
  color: string;
}) {
  if (total === 0) return null;
  const pct = (justificados / total) * 100;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[11px] text-slate-700 mb-0.5">
        <span>{label}</span>
        <span>{justificados}/{total} justificados</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-14 bg-slate-100 rounded" />
        ))}
      </div>
      <div className="h-20 bg-slate-100 rounded" />
    </div>
  );
}
