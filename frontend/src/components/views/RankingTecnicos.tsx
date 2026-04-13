'use client';

import { memo, useMemo } from 'react';
import { TecnicoRanking } from '@/types';

interface RankingTecnicosProps {
  tecnicos: TecnicoRanking[];
}

const ProgressBar = memo(function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5">
      <div className="h-1.5 rounded-full bg-slate-600" style={{ width: `${pct}%` }} />
    </div>
  );
});

export default function RankingTecnicos({ tecnicos }: RankingTecnicosProps) {
  const byZona = useMemo(() => {
    return tecnicos.reduce((acc, t) => {
      if (!acc[t.zona]) acc[t.zona] = [];
      acc[t.zona].push(t);
      return acc;
    }, {} as Record<string, TecnicoRanking[]>);
  }, [tecnicos]);

  const stats = useMemo(() => {
    const total = tecnicos.length;
    const cnr = tecnicos.reduce((acc, t) => acc + t.cnr, 0);
    const efectivas = tecnicos.reduce((acc, t) => acc + t.efectivas, 0);
    const kwh = tecnicos.reduce((acc, t) => acc + t.kwh_estimado, 0);
    const cumpleCNR = tecnicos.filter(t => (t.promedio_cnr ?? 0) >= 2).length;
    const cumpleEfectivas = tecnicos.filter(t => (t.promedio_efectivas ?? 0) >= 8).length;
    return { total, cnr, efectivas, kwh, cumpleCNR, cumpleEfectivas };
  }, [tecnicos]);

  const { topCNR, topEfectivas, maxCNR, maxEfectivas } = useMemo(() => {
    const sortedCNR = [...tecnicos].sort((a, b) => b.cnr - a.cnr).slice(0, 10);
    const sortedEfectivas = [...tecnicos].sort((a, b) => b.efectivas - a.efectivas).slice(0, 10);
    const maxC = tecnicos.length > 0 ? Math.max(...tecnicos.map(t => t.cnr)) : 1;
    const maxE = tecnicos.length > 0 ? Math.max(...tecnicos.map(t => t.efectivas)) : 1;
    return { topCNR: sortedCNR, topEfectivas: sortedEfectivas, maxCNR: maxC || 1, maxEfectivas: maxE || 1 };
  }, [tecnicos]);

  const formatKWH = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toLocaleString('es-CL');
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total Técnicos</p>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total CNR</p>
          <p className="text-2xl font-bold text-slate-800">{stats.cnr.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total Efectivas</p>
          <p className="text-2xl font-bold text-slate-800">{stats.efectivas.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">KWH Estimado</p>
          <p className="text-2xl font-bold text-slate-800">{formatKWH(stats.kwh)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Cumplen Meta CNR</p>
          <p className="text-2xl font-bold text-slate-800">{stats.cumpleCNR}/{stats.total}</p>
          <p className="text-[10px] text-slate-400 mt-1">{stats.total > 0 ? Math.round((stats.cumpleCNR/stats.total)*100) : 0}%</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Cumplen Meta Efect.</p>
          <p className="text-2xl font-bold text-slate-800">{stats.cumpleEfectivas}/{stats.total}</p>
          <p className="text-[10px] text-slate-400 mt-1">{stats.total > 0 ? Math.round((stats.cumpleEfectivas/stats.total)*100) : 0}%</p>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Top 10 CNR</h3>
          <div className="space-y-3">
            {topCNR.map((t, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="w-5 text-[11px] text-slate-400 text-right">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-700 truncate">{t.nombre}</span>
                    <span className="text-[11px] font-semibold text-slate-800 ml-2">{t.cnr}</span>
                  </div>
                  <ProgressBar value={t.cnr} max={maxCNR} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Top 10 Efectivas</h3>
          <div className="space-y-3">
            {topEfectivas.map((t, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="w-5 text-[11px] text-slate-400 text-right">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-700 truncate">{t.nombre}</span>
                    <span className="text-[11px] font-semibold text-slate-800 ml-2">{t.efectivas}</span>
                  </div>
                  <ProgressBar value={t.efectivas} max={maxEfectivas} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla por Zona */}
      <div className="bg-white rounded-lg border border-slate-200/60 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle por Zona</h3>
          <p className="text-[10px] text-slate-400">Metas: CNR/día ≥ 2 | Efectivas/día ≥ 8</p>
        </div>

        <div className="space-y-4">
          {Object.entries(byZona).map(([zona, tecnicosZona]) => (
            <div key={zona}>
              <div className="bg-slate-800 text-white text-[11px] font-medium px-3 py-2 rounded-t flex justify-between items-center">
                <span>{zona}</span>
                <span className="text-[10px] text-slate-300">{tecnicosZona.length} técnicos</span>
              </div>

              <div className="border border-t-0 border-slate-200 rounded-b overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase text-slate-500 text-left" style={{ minWidth: '160px' }}>Nombre</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase text-slate-500 text-right w-14">Días</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase text-slate-500 text-right w-16">Visitas</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase text-slate-500 text-right w-14">% Ef.</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase text-slate-500 text-right w-14">% VF</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase text-slate-500 text-right w-12">CNR</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase text-slate-500 text-center w-16">CNR/día</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase text-slate-500 text-right w-14">Efect.</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase text-slate-500 text-center w-16">Ef./día</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase text-slate-500 text-right w-14">% Hurto</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase text-slate-500 text-right w-14">% Falla</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase text-slate-500 text-right w-16">KWH</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px]">
                    {tecnicosZona.map((t, idx) => {
                      const cumpleCNR = (t.promedio_cnr ?? 0) >= 2;
                      const cumpleEfectivas = (t.promedio_efectivas ?? 0) >= 8;

                      return (
                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/80">
                          <td className="px-2 py-2 text-slate-700">{t.nombre}</td>
                          <td className="px-2 py-2 text-right text-slate-600">{t.dias_trabajados ?? 0}</td>
                          <td className="px-2 py-2 text-right text-slate-600">{t.visitas_totales ?? 0}</td>
                          <td className="px-2 py-2 text-right">
                            <span className={(t.pct_efectivas ?? 0) >= 70 ? 'text-green-600' : 'text-slate-600'}>
                              {(t.pct_efectivas ?? 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <span className={(t.pct_visitas_fallidas ?? 0) > 30 ? 'text-red-600' : 'text-slate-600'}>
                              {(t.pct_visitas_fallidas ?? 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right font-medium text-slate-800">{t.cnr}</td>
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              cumpleCNR ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}>
                              {(t.promedio_cnr ?? 0).toFixed(1)}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right font-medium text-slate-800">{t.efectivas}</td>
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              cumpleEfectivas ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}>
                              {(t.promedio_efectivas ?? 0).toFixed(1)}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <span className={(t.pct_hurto ?? 0) > 50 ? 'text-red-600' : 'text-slate-600'}>
                              {(t.pct_hurto ?? 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <span className={(t.pct_falla ?? 0) > 50 ? 'text-amber-600' : 'text-slate-600'}>
                              {(t.pct_falla ?? 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right font-medium text-slate-800">
                            {formatKWH(t.kwh_estimado ?? 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
