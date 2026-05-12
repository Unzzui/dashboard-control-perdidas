'use client';

import { InspeccionesDia } from '@/types';

interface Props {
  inspecciones: InspeccionesDia;
  cargando: boolean;
  onClose: () => void;
}

export default function InspeccionesDiaModal({
  inspecciones,
  cargando,
  onClose,
}: Props) {
  const [year, month, day] = inspecciones.fecha.split('-');
  const fechaFormateada = `${day}-${month}-${year}`;
  const isConsolidado = inspecciones.zona === 'TODAS';

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-800 text-white px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 min-w-0">
              <span className="font-semibold truncate">{inspecciones.nombre}</span>
              <span className="text-xs text-slate-300 truncate">{inspecciones.zona}</span>
              <span className="text-xs text-slate-300">{fechaFormateada}</span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-xs">
            <Metric label="Total" value={inspecciones.total_inspecciones} />
            <Metric label="Efectivas" value={inspecciones.efectivas} tone="green-strong" />
            <Metric label="Normal" value={inspecciones.normal} />
            <Metric label="Mant" value={inspecciones.mantenimiento} tone="blue" />
            <Metric label="VF CGE" value={inspecciones.vf_cge_pagable} tone="green" />
            <Metric label="VF No Ef" value={inspecciones.vf_no_efectiva} tone="red" />
            <Metric label="CNR" value={inspecciones.cnr} tone="green-strong" />
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
          {cargando ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-400">Cargando inspecciones...</p>
            </div>
          ) : inspecciones.inspecciones.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-400">No hay inspecciones para este día</p>
            </div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {isConsolidado && (
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Zona</th>
                  )}
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">ID Medida</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Aviso</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Resultado</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Causa VF</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Tipo CNR</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Comuna</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Dirección</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Horario</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">kWh</th>
                </tr>
              </thead>
              <tbody>
                {inspecciones.inspecciones.map((insp, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/80">
                    {isConsolidado && (
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {(insp as unknown as { zona_inspeccion?: string })['zona_inspeccion'] || '-'}
                      </td>
                    )}
                    <td className="px-3 py-2 text-slate-800 font-medium">{insp['ID Medida'] || '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{insp['Aviso'] || '-'}</td>
                    <td
                      className={`px-3 py-2 font-semibold ${
                        insp['Resultado visita'] === 'CNR'
                          ? 'text-green-600'
                          : insp['Resultado visita'] === 'Visita fallida'
                          ? 'text-red-600'
                          : 'text-slate-800'
                      }`}
                    >
                      {insp['Resultado visita'] || '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-[180px] truncate" title={insp['Resultado final'] || '-'}>
                      {insp['Resultado visita'] === 'Visita fallida' ? insp['Resultado final'] || '-' : '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{insp['Tipo_CNR.Tipo de CNR'] || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{insp['Comuna'] || '-'}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={insp['Dirección Servicio'] || '-'}>
                      {insp['Dirección Servicio'] || '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {insp['Hora inicio'] && insp['Hora fin']
                        ? `${insp['Hora inicio']} - ${insp['Hora fin']}`
                        : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700 font-medium">
                      {insp['kWh CNR'] ? insp['kWh CNR'].toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'green' | 'green-strong' | 'red' | 'blue';
}) {
  const bg = {
    'default': 'bg-white/10',
    'green': 'bg-green-500/20',
    'green-strong': 'bg-green-600/20',
    'red': 'bg-red-600/20',
    'blue': 'bg-blue-500/20',
  }[tone];
  const label_color = {
    'default': 'text-slate-400',
    'green': 'text-green-300',
    'green-strong': 'text-green-300',
    'red': 'text-red-300',
    'blue': 'text-blue-300',
  }[tone];
  const val_color = {
    'default': '',
    'green': 'text-green-100',
    'green-strong': 'text-green-100',
    'red': 'text-red-100',
    'blue': 'text-blue-100',
  }[tone];
  return (
    <div className={`rounded px-2 py-1 ${bg}`}>
      <div className={`text-[9px] uppercase ${label_color}`}>{label}</div>
      <div className={`font-semibold ${val_color}`}>{value}</div>
    </div>
  );
}
