'use client';

import { useMemo } from 'react';
import { CampanaStats } from '@/types';
import DataTable from '@/components/ui/DataTable';

interface ResultadosDelegacionProps {
  campanas: CampanaStats[];
}

export default function ResultadosDelegacion({
  campanas,
}: ResultadosDelegacionProps) {
  // Totales de campañas
  const totals = useMemo(() => {
    const totalCNR = campanas.reduce((acc, c) => acc + c.cnr, 0);
    const totalEfectivas = campanas.reduce((acc, c) => acc + c.efectivas, 0);
    const totalVF = campanas.reduce((acc, c) => acc + c.visita_fallida, 0);
    const totalCNRFalla = campanas.reduce((acc, c) => acc + c.cnr_falla, 0);
    const totalCNRHurto = campanas.reduce((acc, c) => acc + c.cnr_hurto, 0);
    const total = totalEfectivas + totalVF;
    const pctCNR = totalEfectivas > 0 ? (totalCNR / totalEfectivas * 100) : 0;
    const pctFalla = totalCNR > 0 ? (totalCNRFalla / totalCNR * 100) : 0;
    return { totalCNR, totalEfectivas, totalVF, totalCNRFalla, totalCNRHurto, total, pctCNR, pctFalla };
  }, [campanas]);

  // Top campañas por CNR
  const topCampanasCNR = useMemo(() => {
    return [...campanas]
      .sort((a, b) => b.cnr - a.cnr)
      .slice(0, 10);
  }, [campanas]);

  // Top campañas por efectividad (con mínimo de registros)
  const topCampanasEfectividad = useMemo(() => {
    return [...campanas]
      .filter(c => c.efectivas + c.visita_fallida >= 10) // Mínimo 10 registros
      .sort((a, b) => b.pct_efectivas - a.pct_efectivas)
      .slice(0, 10);
  }, [campanas]);

  // Campañas con problemas (alta V. Fallida)
  const campanasProblematicas = useMemo(() => {
    return [...campanas]
      .filter(c => c.visita_fallida > 0 && c.efectivas + c.visita_fallida >= 5)
      .map(c => ({
        ...c,
        pct_vf: (c.visita_fallida / (c.efectivas + c.visita_fallida)) * 100,
      }))
      .sort((a, b) => b.pct_vf - a.pct_vf)
      .slice(0, 10);
  }, [campanas]);

  const campanaColumns = useMemo(() => [
    { key: 'descripcion', header: 'Campaña', width: '280px' },
    {
      key: 'cnr',
      header: 'CNR',
      align: 'right' as const,
      render: (row: CampanaStats) => row.cnr > 0 ? (
        <span className="font-medium text-slate-800">{row.cnr.toLocaleString('es-CL')}</span>
      ) : <span className="text-slate-300">-</span>,
    },
    {
      key: 'pct_cnr',
      header: '% CNR',
      align: 'right' as const,
      render: (row: CampanaStats) => row.pct_cnr > 0 ? (
        <span className={row.pct_cnr >= 50 ? 'text-green-600 font-medium' : 'text-slate-500'}>
          {row.pct_cnr.toFixed(1)}%
        </span>
      ) : <span className="text-slate-300">-</span>,
    },
    {
      key: 'efectivas',
      header: 'Efectivas',
      align: 'right' as const,
      render: (row: CampanaStats) => row.efectivas > 0 ? (
        <span className="text-slate-600">{row.efectivas.toLocaleString('es-CL')}</span>
      ) : <span className="text-slate-300">-</span>,
    },
    {
      key: 'visita_fallida',
      header: 'V. Fallida',
      align: 'right' as const,
      render: (row: CampanaStats) => row.visita_fallida > 0 ? (
        <span className="text-amber-600">{row.visita_fallida.toLocaleString('es-CL')}</span>
      ) : <span className="text-slate-300">-</span>,
    },
    {
      key: 'cnr_falla',
      header: 'Falla',
      align: 'right' as const,
      render: (row: CampanaStats) => row.cnr_falla > 0 ? (
        <span className="text-green-600">{row.cnr_falla.toLocaleString('es-CL')}</span>
      ) : <span className="text-slate-300">-</span>,
    },
    {
      key: 'cnr_hurto',
      header: 'Hurto',
      align: 'right' as const,
      render: (row: CampanaStats) => row.cnr_hurto > 0 ? (
        <span className="text-red-600">{row.cnr_hurto.toLocaleString('es-CL')}</span>
      ) : <span className="text-slate-300">-</span>,
    },
  ], []);

  return (
    <div className="space-y-6">
      {/* KPIs específicos de campañas */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total Campañas</p>
          <p className="text-2xl font-bold text-slate-800">{campanas.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">CNR Total</p>
          <p className="text-2xl font-bold text-slate-800">{totals.totalCNR.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">{totals.pctCNR.toFixed(1)}% efectividad</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">CNR Falla</p>
          <p className="text-2xl font-bold text-green-600">{totals.totalCNRFalla.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">{totals.pctFalla.toFixed(1)}% del CNR</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">CNR Hurto</p>
          <p className="text-2xl font-bold text-red-600">{totals.totalCNRHurto.toLocaleString('es-CL')}</p>
          <p className="text-[10px] text-slate-400 mt-1">{(100 - totals.pctFalla).toFixed(1)}% del CNR</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Efectivas</p>
          <p className="text-2xl font-bold text-slate-800">{totals.totalEfectivas.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">V. Fallidas</p>
          <p className="text-2xl font-bold text-amber-600">{totals.totalVF.toLocaleString('es-CL')}</p>
        </div>
      </div>

      {/* Rankings de campañas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top CNR */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Top 10 Campañas por CNR
          </h3>
          <div className="space-y-2">
            {topCampanasCNR.map((c, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold ${
                  idx < 3 ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-700 truncate" title={c.descripcion}>
                    {c.descripcion}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-slate-600"
                        style={{ width: `${Math.min((c.cnr / topCampanasCNR[0].cnr) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-medium text-slate-700 w-10 text-right">
                      {c.cnr.toLocaleString('es-CL')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Efectividad */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Top 10 por Efectividad
          </h3>
          <div className="space-y-2">
            {topCampanasEfectividad.map((c, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold ${
                  idx < 3 ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-700 truncate" title={c.descripcion}>
                    {c.descripcion}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-green-500"
                        style={{ width: `${c.pct_efectivas}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-medium text-green-700 w-10 text-right">
                      {c.pct_efectivas.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-slate-400 mt-3">*Mínimo 10 registros</p>
        </div>

        {/* Campañas problemáticas */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-4">
            Mayor % Visitas Fallidas
          </h3>
          <div className="space-y-2">
            {campanasProblematicas.map((c, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold ${
                  idx < 3 ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-700 truncate" title={c.descripcion}>
                    {c.descripcion}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-red-500"
                        style={{ width: `${c.pct_vf}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-medium text-red-700 w-10 text-right">
                      {c.pct_vf.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-slate-400 mt-3">*Mínimo 5 registros</p>
        </div>
      </div>

      {/* Tabla completa de campañas */}
      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Detalle de Campañas
          </h3>
          <span className="text-[10px] text-slate-400">{campanas.length} campañas</span>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <DataTable columns={campanaColumns} data={campanas} />
        </div>
      </div>
    </div>
  );
}
