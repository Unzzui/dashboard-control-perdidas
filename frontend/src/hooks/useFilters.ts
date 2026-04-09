import { useState, useEffect, useCallback } from 'react';
import { Filters, FilterOptions } from '@/types';
import { getFilterOptions } from '@/lib/api';

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function getCurrentMonthName(): string {
  return MESES_NOMBRES[new Date().getMonth()];
}

function findMonthInOptions(monthName: string, options: string[]): string | null {
  // Buscar coincidencia exacta (case insensitive)
  const found = options.find(opt =>
    opt.toLowerCase() === monthName.toLowerCase()
  );
  if (found) return found;

  // Buscar si el mes está contenido en alguna opción
  const partial = options.find(opt =>
    opt.toLowerCase().includes(monthName.toLowerCase()) ||
    monthName.toLowerCase().includes(opt.toLowerCase())
  );
  if (partial) return partial;

  return null;
}

// Filtros iniciales con año y mes actuales para evitar cargar todos los datos
const currentYear = new Date().getFullYear();
const currentMonthIdx = new Date().getMonth();
const currentMonthName = MESES_NOMBRES[currentMonthIdx];

const initialFilters: Filters = {
  año: currentYear,
  mes: [currentMonthName.toLowerCase()],
  dia: null,
  zona: [],
  regional: [],
  supervisor: [],
  estado: [],
  tratamiento: [],
  tipo_campana: [],
  nombre_asignado: [],
};

const initialOptions: FilterOptions = {
  años: [],
  meses: [],
  dias: [],
  zonas: [],
  regionales: [],
  supervisores: [],
  estados: [],
  tratamientos: [],
  tipos_campana: [],
  nombres_asignados: [],
};

export function useFilters() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [options, setOptions] = useState<FilterOptions>(initialOptions);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Solo ejecutar una vez al montar el componente
    if (initialized) return;

    const fetchOptions = async () => {
      try {
        const opts = await getFilterOptions();
        setOptions(opts);

        const currentYear = getCurrentYear();
        const currentMonthName = getCurrentMonthName();

        // Buscar el mes actual en las opciones disponibles
        let selectedMonth = findMonthInOptions(currentMonthName, opts.meses);

        // Si no se encuentra el mes actual, usar el último mes disponible
        if (!selectedMonth && opts.meses.length > 0) {
          selectedMonth = opts.meses[opts.meses.length - 1];
        }

        // Buscar el año actual, si no existe usar el último disponible
        let selectedYear = currentYear;
        if (!opts.años.includes(currentYear) && opts.años.length > 0) {
          selectedYear = opts.años[opts.años.length - 1];
        }

        setFilters(prev => ({
          ...prev,
          año: selectedYear,
          mes: selectedMonth ? [selectedMonth] : [],
        }));

        setInitialized(true);
      } catch (error) {
        console.error('Error fetching options:', error);
      }
    };

    fetchOptions();
  }, [initialized]);

  return { filters, setFilters, options };
}
