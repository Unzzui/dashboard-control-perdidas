'use client';

import { useState } from 'react';
import { Justificacion, Analista, CatalogosJustificacion } from '@/types';
import { DiaCalendario } from './CalendarioMes';
import JustificacionForm from './JustificacionForm';
import JustificacionFicha from './JustificacionFicha';
import {
  createJustificacion,
  updateJustificacion,
  deleteJustificacion,
  APIError,
} from '@/lib/api/justificaciones';

interface Props {
  dia: DiaCalendario;
  tecnicoNombre: string;
  zonaOrigen: string;
  catalogos: CatalogosJustificacion;
  analistas: Analista[];
  motivosLabel: Record<string, string>;
  onCambioJustificacion: () => void;     // refetch justificaciones+resumen
}

type Modo = 'ficha' | 'crear' | 'editar';

export default function DiaPanel({
  dia, tecnicoNombre, zonaOrigen, catalogos, analistas, motivosLabel,
  onCambioJustificacion,
}: Props) {
  const [modo, setModo] = useState<Modo>(
    dia.justificacion ? 'ficha' : 'crear'
  );

  const tipoEvento = dia.estado === 'sin_trabajo' ? 'dia_no_trabajado' : 'baja_produccion';
  const motivosCatalogo = tipoEvento === 'dia_no_trabajado'
    ? catalogos.motivos_no_trabajado
    : catalogos.motivos_baja_produccion;

  const handleCrear = async (data: {
    motivo: string;
    comentario: string | null;
    usuarioRegistro: string;
  }) => {
    try {
      await createJustificacion({
        fecha: dia.fecha,
        tecnico_nombre: tecnicoNombre,
        zona_origen: zonaOrigen,
        motivo: data.motivo,
        comentario: data.comentario,
        produccion_real: dia.efectivas ?? 0,
        meta_diaria: dia.metaDiaria,
        es_futuro: estaEnFuturo(dia.fecha),
        usuario_registro: data.usuarioRegistro,
      });
      onCambioJustificacion();
    } catch (e: unknown) {
      if (e instanceof APIError && e.status === 409) {
        // ya existe → cambiar a modo editar
        setModo('editar');
        onCambioJustificacion();
        return;
      }
      throw e;
    }
  };

  const handleEditar = async (data: {
    motivo: string;
    comentario: string | null;
    usuarioRegistro: string;
  }) => {
    if (!dia.justificacion) return;
    await updateJustificacion(dia.justificacion.id, {
      motivo: data.motivo,
      comentario: data.comentario,
      usuario_registro: data.usuarioRegistro,
    });
    setModo('ficha');
    onCambioJustificacion();
  };

  const handleEliminar = async (usuarioRegistro: string) => {
    if (!dia.justificacion) return;
    await deleteJustificacion(dia.justificacion.id, usuarioRegistro);
    onCambioJustificacion();
  };

  return (
    <div className="space-y-3">
      <Encabezado dia={dia} />
      <ResumenDelDia dia={dia} />

      {modo === 'ficha' && dia.justificacion && (
        <Seccion titulo="Justificacion">
          <JustificacionFicha
            justificacion={dia.justificacion}
            motivosLabel={motivosLabel}
            onEditar={() => setModo('editar')}
            onEliminar={handleEliminar}
            analistasParaEliminar={analistas.map(a => a.nombre)}
          />
        </Seccion>
      )}

      {(modo === 'crear' || modo === 'editar') && (
        <Seccion titulo={modo === 'editar' ? 'Editar justificacion' : 'Justificar'}>
          <JustificacionForm
            fecha={dia.fecha}
            tipoEvento={tipoEvento}
            produccionReal={dia.efectivas ?? 0}
            metaDiaria={dia.metaDiaria}
            zonaOrigen={zonaOrigen}
            esFuturo={estaEnFuturo(dia.fecha)}
            motivosCatalogo={motivosCatalogo}
            analistas={analistas}
            initial={modo === 'editar' ? dia.justificacion ?? undefined : undefined}
            onSubmit={modo === 'editar' ? handleEditar : handleCrear}
            onCancel={() => setModo(dia.justificacion ? 'ficha' : 'crear')}
          />
        </Seccion>
      )}
    </div>
  );
}

function Encabezado({ dia }: { dia: DiaCalendario }) {
  const [y, m, d] = dia.fecha.split('-');
  const estadoLabel = labelEstado(dia.estado);
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-400">
        {dia.diaSemana} {parseInt(d, 10)} de mes
      </p>
      <p className="text-sm font-semibold text-slate-800">
        {d}-{m}-{y} · <span className="text-slate-500">{estadoLabel}</span>
        {dia.justificacion && (
          <span className="ml-2 text-emerald-600">Justificado</span>
        )}
      </p>
    </div>
  );
}

function ResumenDelDia({ dia }: { dia: DiaCalendario }) {
  const cumplimiento = dia.efectivas !== null
    ? Math.round((dia.efectivas / dia.metaDiaria) * 100)
    : 0;
  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Produccion</p>
        <p className="text-slate-800 font-semibold">{dia.efectivas ?? 0}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Meta</p>
        <p className="text-slate-800 font-semibold">{dia.metaDiaria}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Cumplimiento</p>
        <p className="text-slate-800 font-semibold">{cumplimiento}%</p>
      </div>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-200 pt-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
        {titulo}
      </p>
      {children}
    </div>
  );
}

function labelEstado(estado: DiaCalendario['estado']): string {
  switch (estado) {
    case 'trabajado_ok': return 'Trabajado';
    case 'baja_produccion': return 'Baja produccion';
    case 'sin_trabajo': return 'Sin trabajo';
    case 'feriado': return 'Feriado';
    case 'fin_semana': return 'Fin de semana';
    case 'futuro': return 'Dia futuro';
  }
}

function estaEnFuturo(fecha: string): boolean {
  const hoy = new Date();
  const f = new Date(fecha);
  hoy.setHours(0, 0, 0, 0);
  f.setHours(0, 0, 0, 0);
  return f.getTime() > hoy.getTime();
}
