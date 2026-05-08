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
  if (cargando) return <Skeleton />;
  if (!resumen) return <p className="text-slate-400 text-sm">Sin datos del mes.</p>;

  const pctReal = Math.min(100, Math.round(resumen.cumplimiento_real * 100));
  const pctAjustado = Math.min(100, Math.round(resumen.cumplimiento_ajustado * 100));
  const tieneAjuste =
    resumen.dias_no_trabajados_justificados > 0 &&
    Math.abs(resumen.cumplimiento_ajustado - resumen.cumplimiento_real) > 0.001;

  const colorBarra =
    pctReal >= 100 ? 'bg-emerald-500' :
    pctReal >= 70 ? 'bg-oca-blue' :
    pctReal >= 40 ? 'bg-amber-400' : 'bg-red-400';

  const efectivasOk = efectivasDia >= metaDiaria;

  return (
    <div className="space-y-4">
      {/* Hero: avance del mes */}
      <div className="bg-white border border-slate-200/60 rounded-lg px-4 py-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">
            Avance del mes
          </p>
          <p className="text-3xl font-bold text-slate-800">
            {pctReal}<span className="text-lg text-slate-400 font-semibold">%</span>
          </p>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${colorBarra} transition-all`}
            style={{ width: `${pctReal}%` }}
          />
        </div>
        <div className="flex items-baseline justify-between mt-2">
          <p className="text-[11px] text-slate-500">
            <span className="font-semibold text-slate-800">{resumen.efectivas_totales}</span>
            {' / '}
            <span>{resumen.meta_total}</span>{' efectivas'}
          </p>
          {tieneAjuste && (
            <p className="text-[10px] text-slate-500">
              Ajustado: <span className="font-semibold text-slate-700">{pctAjustado}%</span>
            </p>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <KPI
          label="Días trabajados"
          value={diasTrabajados.toString()}
          sub={`de ${resumen.dias_habiles_mes} hábiles`}
        />
        <KPI
          label="Promedio Ef/día"
          value={efectivasDia.toFixed(1)}
          sub={`meta ${metaDiaria}`}
          tone={efectivasOk ? 'success' : 'warning'}
        />
      </div>

      {/* Estado del mes */}
      {(resumen.dias_no_trabajados_total > 0 || resumen.dias_baja_produccion_total > 0) && (
        <div className="bg-white border border-slate-200/60 rounded-lg px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-3">
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
        </div>
      )}

      {/* Pendientes */}
      {resumen.dias_pendientes_justificar > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-baseline justify-between">
          <span className="text-xs text-red-700">
            <span className="font-bold">{resumen.dias_pendientes_justificar}</span>
            {' '}día{resumen.dias_pendientes_justificar > 1 ? 's' : ''} sin justificar
          </span>
          <span className="text-[10px] text-red-500 uppercase tracking-wider">Acción</span>
        </div>
      )}

      {/* Mes ok */}
      {resumen.dias_pendientes_justificar === 0 &&
       resumen.dias_no_trabajados_total === 0 &&
       resumen.dias_baja_produccion_total === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
          <span className="text-xs text-emerald-700">
            Todos los días hábiles trabajados sobre el umbral.
          </span>
        </div>
      )}
    </div>
  );
}

function KPI({
  label, value, sub, tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const valueColor =
    tone === 'success' ? 'text-emerald-600' :
    tone === 'warning' ? 'text-amber-600' : 'text-slate-800';
  return (
    <div className="bg-white border border-slate-200/60 rounded-lg px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${valueColor}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
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
    <div className="mb-2.5 last:mb-0">
      <div className="flex justify-between text-[11px] text-slate-700 mb-1">
        <span>{label}</span>
        <span className="text-slate-500">
          <span className="font-semibold text-slate-800">{justificados}</span>/{total} justificados
        </span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-24 bg-slate-100 rounded-lg" />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map(i => (
          <div key={i} className="h-16 bg-slate-100 rounded-lg" />
        ))}
      </div>
      <div className="h-24 bg-slate-100 rounded-lg" />
    </div>
  );
}
