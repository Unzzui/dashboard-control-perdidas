'use client';

import { DetalleTecnicoDiario } from '@/types';

interface Props {
  detalle: DetalleTecnicoDiario;
  diaSeleccionado: string | null;
  onSeleccionarDia: (fecha: string) => void;
}

export default function TablaDetalleDia({
  detalle, diaSeleccionado, onSeleccionarDia,
}: Props) {
  if (detalle.dias.length === 0) {
    return (
      <div className="bg-white border border-slate-200/60 rounded-lg overflow-hidden">
        <div className="bg-slate-800 text-white px-3 py-2">
          <span className="font-semibold text-xs">Detalle por día</span>
        </div>
        <div className="px-4 py-8 text-center">
          <p className="text-slate-400 text-xs">Sin días con producción registrada</p>
        </div>
      </div>
    );
  }

  const totales = detalle.dias.reduce(
    (acc, d) => ({
      visitas_totales: acc.visitas_totales + d.visitas_totales,
      efectivas: acc.efectivas + d.efectivas,
      normal: acc.normal + d.normal,
      mantenimiento: acc.mantenimiento + d.mantenimiento,
      vf_cge_pagable: acc.vf_cge_pagable + d.vf_cge_pagable,
      vf_no_efectiva: acc.vf_no_efectiva + d.vf_no_efectiva,
      cnr: acc.cnr + d.cnr,
      kwh_recuperado: acc.kwh_recuperado + d.kwh_recuperado,
    }),
    {
      visitas_totales: 0, efectivas: 0, normal: 0, mantenimiento: 0,
      vf_cge_pagable: 0, vf_no_efectiva: 0, cnr: 0, kwh_recuperado: 0,
    }
  );

  return (
    <div className="bg-white border border-slate-200/60 rounded-lg overflow-hidden">
      <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between">
        <span className="font-semibold text-xs">Detalle por día</span>
        <span className="text-[10px] uppercase tracking-wider text-slate-300">
          {detalle.total_dias} días trabajados
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Fecha</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Día</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Total</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-emerald-700 bg-emerald-50">Efectivas</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Normal</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Mant.</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">VF CGE</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">VF No Ef.</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">CNR</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">kWh</th>
            </tr>
          </thead>
          <tbody>
            {detalle.dias.map((dia) => {
              const [year, month, day] = dia.fecha.split('-');
              const fechaCorta = `${day}-${month}-${year}`;
              const seleccionado = dia.fecha === diaSeleccionado;
              return (
                <tr
                  key={dia.fecha}
                  onClick={() => onSeleccionarDia(dia.fecha)}
                  className={`border-b border-slate-100 cursor-pointer transition-colors ${
                    seleccionado ? 'bg-slate-100' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <td className="px-3 py-2 text-slate-700">{fechaCorta}</td>
                  <td className="px-3 py-2 text-slate-500 capitalize">{dia.dia_semana}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{dia.visitas_totales}</td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-700 bg-emerald-50/60">
                    {dia.efectivas}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{dia.normal}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{dia.mantenimiento}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{dia.vf_cge_pagable}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{dia.vf_no_efectiva}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">{dia.cnr}</td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {dia.kwh_recuperado.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td className="px-3 py-2 text-[10px] font-semibold uppercase text-slate-500" colSpan={2}>
                Total
              </td>
              <td className="px-3 py-2 text-right font-bold text-slate-800">{totales.visitas_totales}</td>
              <td className="px-3 py-2 text-right font-bold text-emerald-700 bg-emerald-50/60">
                {totales.efectivas}
              </td>
              <td className="px-3 py-2 text-right font-bold text-slate-700">{totales.normal}</td>
              <td className="px-3 py-2 text-right font-bold text-slate-700">{totales.mantenimiento}</td>
              <td className="px-3 py-2 text-right font-bold text-slate-700">{totales.vf_cge_pagable}</td>
              <td className="px-3 py-2 text-right font-bold text-slate-700">{totales.vf_no_efectiva}</td>
              <td className="px-3 py-2 text-right font-bold text-slate-800">{totales.cnr}</td>
              <td className="px-3 py-2 text-right font-bold text-slate-700">
                {totales.kwh_recuperado.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
