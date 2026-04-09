'use client';

import { memo, useMemo } from 'react';
import { TecnicoRanking } from '@/types';
import KPICard from '@/components/ui/KPICard';

interface RankingTecnicosProps {
  tecnicos: TecnicoRanking[];
}

// Componente de barra de progreso memoizado
const ProgressBar = memo(function ProgressBar({ value, max, color = 'blue' }: { value: number; max: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const colorClasses: Record<string, string> = {
    blue: 'bg-oca-blue',
    green: 'bg-green-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
  };
  return (
    <div className="w-full bg-slate-200 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full ${colorClasses[color]}`} style={{ width: `${pct}%` }} />
    </div>
  );
});

export default function RankingTecnicos({ tecnicos }: RankingTecnicosProps) {
  // Memoizar agrupación por zona
  const byZona = useMemo(() => {
    return tecnicos.reduce((acc, t) => {
      if (!acc[t.zona]) acc[t.zona] = [];
      acc[t.zona].push(t);
      return acc;
    }, {} as Record<string, TecnicoRanking[]>);
  }, [tecnicos]);

  // Memoizar cálculos de totales
  const { totalTecnicos, totalCNR, totalEfectivas, totalKWH, cumplenCNR, cumplenEfectivas } = useMemo(() => {
    const total = tecnicos.length;
    const cnr = tecnicos.reduce((acc, t) => acc + t.cnr, 0);
    const efectivas = tecnicos.reduce((acc, t) => acc + t.efectivas, 0);
    const kwh = tecnicos.reduce((acc, t) => acc + t.kwh_estimado, 0);
    const cumpleCNR = tecnicos.filter(t => (t.promedio_cnr ?? 0) >= 2).length;
    const cumpleEfectivas = tecnicos.filter(t => (t.promedio_efectivas ?? 0) >= 8).length;
    return { totalTecnicos: total, totalCNR: cnr, totalEfectivas: efectivas, totalKWH: kwh, cumplenCNR: cumpleCNR, cumplenEfectivas: cumpleEfectivas };
  }, [tecnicos]);

  // Memoizar rankings
  const { topCNR, topEfectivas, maxCNR, maxEfectivas } = useMemo(() => {
    const sortedCNR = [...tecnicos].sort((a, b) => b.cnr - a.cnr).slice(0, 10);
    const sortedEfectivas = [...tecnicos].sort((a, b) => b.efectivas - a.efectivas).slice(0, 10);
    const maxC = tecnicos.length > 0 ? Math.max(...tecnicos.map(t => t.cnr)) : 1;
    const maxE = tecnicos.length > 0 ? Math.max(...tecnicos.map(t => t.efectivas)) : 1;
    return { topCNR: sortedCNR, topEfectivas: sortedEfectivas, maxCNR: maxC || 1, maxEfectivas: maxE || 1 };
  }, [tecnicos]);

  return (
    <div className="space-y-6">
      {/* KPIs Generales */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPICard title="Total Técnicos" value={totalTecnicos} color="gray" />
        <KPICard title="Total CNR" value={totalCNR} color="blue" />
        <KPICard title="Total Efectivas" value={totalEfectivas} color="green" />
        <KPICard title="kWh Estimado" value={`${(totalKWH / 1000).toFixed(1)}k`} color="orange" />
        <KPICard
          title="Cumplen Meta CNR"
          value={`${cumplenCNR}/${totalTecnicos}`}
          subtitle={`${totalTecnicos > 0 ? Math.round((cumplenCNR/totalTecnicos)*100) : 0}%`}
          color="blue"
        />
        <KPICard
          title="Cumplen Meta Efect."
          value={`${cumplenEfectivas}/${totalTecnicos}`}
          subtitle={`${totalTecnicos > 0 ? Math.round((cumplenEfectivas/totalTecnicos)*100) : 0}%`}
          color="green"
        />
      </div>

      {/* Rankings Top 10 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top CNR */}
        <div className="card">
          <h3 className="section-title mb-4">Top 10 CNR</h3>
          <div className="space-y-2">
            {topCNR.map((t, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold ${
                  idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                  idx === 1 ? 'bg-slate-300 text-slate-700' :
                  idx === 2 ? 'bg-orange-300 text-orange-900' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-700 truncate">{t.nombre}</p>
                  <ProgressBar value={t.cnr} max={maxCNR} color="blue" />
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-oca-blue">{t.cnr}</span>
                  <p className="text-[9px] text-slate-400">CNR</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Efectivas */}
        <div className="card">
          <h3 className="section-title mb-4">Top 10 Efectivas</h3>
          <div className="space-y-2">
            {topEfectivas.map((t, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold ${
                  idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                  idx === 1 ? 'bg-slate-300 text-slate-700' :
                  idx === 2 ? 'bg-orange-300 text-orange-900' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-700 truncate">{t.nombre}</p>
                  <ProgressBar value={t.efectivas} max={maxEfectivas} color="green" />
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-green-600">{t.efectivas}</span>
                  <p className="text-[9px] text-slate-400">Efectivas</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla Detallada por Zona */}
      <div className="card">
        <h3 className="section-title mb-4">Detalle por Zona</h3>
        <p className="text-[10px] text-slate-400 mb-4">
          Metas: CNR/día {'>='} 2 | Efectivas/día {'>='} 8
        </p>

        <div className="overflow-x-auto">
          {Object.entries(byZona).map(([zona, tecnicosZona]) => (
            <div key={zona} className="mb-6">
              <div className="bg-oca-blue text-white text-xs font-bold px-3 py-2 rounded-t flex justify-between items-center">
                <span>{zona}</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">
                  {tecnicosZona.length} técnicos
                </span>
              </div>

              <div className="border border-t-0 border-slate-200 rounded-b overflow-x-auto">
                <table className="w-full min-w-[1200px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-2 py-2 text-[9px] font-semibold text-slate-500 text-left sticky left-0 bg-slate-50 z-10" style={{ minWidth: '180px' }}>NOMBRE</th>
                      <th className="px-2 py-2 text-[9px] font-semibold text-slate-500 text-right" style={{ width: '60px' }}>DÍAS TRAB.</th>
                      <th className="px-2 py-2 text-[9px] font-semibold text-slate-500 text-right" style={{ width: '70px' }}>ACC. DIARIAS</th>
                      <th className="px-2 py-2 text-[9px] font-semibold text-slate-500 text-right" style={{ width: '70px' }}>VIS. TOTALES</th>
                      <th className="px-2 py-2 text-[9px] font-semibold text-slate-500 text-right" style={{ width: '70px' }}>VIS. EFECT.</th>
                      <th className="px-2 py-2 text-[9px] font-semibold text-slate-500 text-right" style={{ width: '60px' }}>% EFECT.</th>
                      <th className="px-2 py-2 text-[9px] font-semibold text-slate-500 text-right" style={{ width: '60px' }}>% V.FALL.</th>
                      <th className="px-2 py-2 text-[9px] font-semibold text-slate-500 text-right" style={{ width: '50px' }}>CNR</th>
                      <th className="px-2 py-2 text-[9px] font-semibold text-slate-500 text-right" style={{ width: '60px' }}>CNR/DÍA</th>
                      <th className="px-2 py-2 text-[9px] font-semibold text-slate-500 text-right" style={{ width: '60px' }}>EFECT.</th>
                      <th className="px-2 py-2 text-[9px] font-semibold text-slate-500 text-right" style={{ width: '60px' }}>EFECT/DÍA</th>
                      <th className="px-2 py-2 text-[9px] font-semibold text-slate-500 text-right" style={{ width: '55px' }}>% HURTO</th>
                      <th className="px-2 py-2 text-[9px] font-semibold text-slate-500 text-right" style={{ width: '55px' }}>% FALLA</th>
                      <th className="px-2 py-2 text-[9px] font-semibold text-slate-500 text-right" style={{ width: '70px' }}>kWh EST.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tecnicosZona.map((t, idx) => {
                      const cumpleCNR = (t.promedio_cnr ?? 0) >= 2;
                      const cumpleEfectivas = (t.promedio_efectivas ?? 0) >= 8;

                      return (
                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-2 py-2 text-[11px] text-slate-700 sticky left-0 bg-white z-10">{t.nombre}</td>
                          <td className="px-2 py-2 text-[11px] text-right">{t.dias_trabajados ?? 0}</td>
                          <td className="px-2 py-2 text-[11px] text-right">{(t.acciones_diarias ?? 0).toFixed(1)}</td>
                          <td className="px-2 py-2 text-[11px] text-right">{t.visitas_totales ?? 0}</td>
                          <td className="px-2 py-2 text-[11px] text-right">{t.visitas_efectivas ?? 0}</td>
                          <td className="px-2 py-2 text-[11px] text-right">
                            <span className={(t.pct_efectivas ?? 0) >= 70 ? 'text-green-600 font-medium' : 'text-slate-600'}>
                              {(t.pct_efectivas ?? 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-2 py-2 text-[11px] text-right">
                            <span className={(t.pct_visitas_fallidas ?? 0) <= 25 ? 'text-green-600' : 'text-red-600 font-medium'}>
                              {(t.pct_visitas_fallidas ?? 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-2 py-2 text-[11px] text-right font-bold text-oca-blue">{t.cnr}</td>
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-block min-w-[35px] px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              cumpleCNR ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {(t.promedio_cnr ?? 0).toFixed(1)}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-[11px] text-right font-medium">{t.efectivas}</td>
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-block min-w-[35px] px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              cumpleEfectivas ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {(t.promedio_efectivas ?? 0).toFixed(1)}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-[11px] text-right">
                            <span className={(t.pct_hurto ?? 0) > 50 ? 'text-red-600 font-medium' : ''}>
                              {(t.pct_hurto ?? 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-2 py-2 text-[11px] text-right">
                            <span className={(t.pct_falla ?? 0) > 50 ? 'text-orange-600 font-medium' : ''}>
                              {(t.pct_falla ?? 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-2 py-2 text-[11px] text-right font-medium text-orange-600">
                            {(t.kwh_estimado ?? 0).toLocaleString('es-CL')}
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
