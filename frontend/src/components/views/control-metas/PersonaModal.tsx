'use client';

import { Filters } from '@/types';

export interface BrigadaSeleccionada {
  nombre: string;
  zona: string;
  diasTrabajados: number;
  efectivasTotal: number;
  efectivasDia: number;
  proyeccion: number;
  pctAvance: number;
  estado: 'cumplida' | 'en_camino' | 'no_alcanzara';
  kwhRecuperado: number;
  trabajaEnMultiplesZonas: boolean;
}

interface Props {
  brigada: BrigadaSeleccionada;
  filters: Filters;
  metaEfectivasMes: number;
  todasLasBrigadas: BrigadaSeleccionada[];
  onClose: () => void;
  onNavegar: (direccion: 'anterior' | 'siguiente') => void;
}

// Stub: implementación real en Task 17.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function PersonaModal(_props: Props) {
  return null;
}
