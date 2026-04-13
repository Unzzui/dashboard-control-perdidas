import { useState, useEffect, useCallback, useRef } from 'react';
import { Filters, FilterOptions } from '@/types';
import { getFilterOptions, getCascadeFilterOptions } from '@/lib/api';

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
  const found = options.find(opt =>
    opt.toLowerCase() === monthName.toLowerCase()
  );
  if (found) return found;

  const partial = options.find(opt =>
    opt.toLowerCase().includes(monthName.toLowerCase()) ||
    monthName.toLowerCase().includes(opt.toLowerCase())
  );
  if (partial) return partial;

  return null;
}

const currentYear = new Date().getFullYear();
const currentMonthIdx = new Date().getMonth();
const currentMonthName = MESES_NOMBRES[currentMonthIdx];

const initialFilters: Filters = {
  año: currentYear,
  mes: [currentMonthName.toLowerCase()],
  dia: [],
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
  const cascadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCascadeKeyRef = useRef<string>('');

  // Inicialización
  useEffect(() => {
    if (initialized) return;

    const fetchOptions = async () => {
      try {
        const opts = await getFilterOptions();
        setOptions(opts);

        const currentYear = getCurrentYear();
        const currentMonthName = getCurrentMonthName();

        let selectedMonth = findMonthInOptions(currentMonthName, opts.meses);
        if (!selectedMonth && opts.meses.length > 0) {
          selectedMonth = opts.meses[opts.meses.length - 1];
        }

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

  // Actualizar opciones en cascada cuando cambien los filtros principales
  useEffect(() => {
    if (!initialized) return;

    // Cancelar timeout anterior
    if (cascadeTimeoutRef.current) {
      clearTimeout(cascadeTimeoutRef.current);
    }

    // Debounce de 400ms para dar tiempo a selecciones múltiples
    cascadeTimeoutRef.current = setTimeout(async () => {
      try {
        const cascadeFilters = {
          año: filters.año,
          mes: filters.mes,
          zona: filters.zona,
          regional: filters.regional,
          supervisor: filters.supervisor,
        };

        // Evitar llamadas duplicadas
        const cascadeKey = JSON.stringify(cascadeFilters);
        if (cascadeKey === lastCascadeKeyRef.current) {
          return;
        }
        lastCascadeKeyRef.current = cascadeKey;

        const opts = await getCascadeFilterOptions(cascadeFilters);

        setOptions(prev => ({
          ...prev,
          dias: opts.dias,
          zonas: opts.zonas,
          regionales: opts.regionales,
          supervisores: opts.supervisores,
          estados: opts.estados,
          tratamientos: opts.tratamientos,
          tipos_campana: opts.tipos_campana,
          nombres_asignados: opts.nombres_asignados,
        }));

        // Solo limpiar selecciones de campos dependientes (días, técnicos)
        // NO limpiar zona, regional, supervisor - el usuario debe poder seleccionar múltiples
        setFilters(prev => {
          const newFilters = { ...prev };
          let changed = false;

          // Filtrar días que ya no existen (dependiente de mes)
          const validDias = prev.dia.filter(d => opts.dias.includes(d));
          if (validDias.length !== prev.dia.length) {
            newFilters.dia = validDias;
            changed = true;
          }

          // Filtrar técnicos que ya no existen (dependiente de supervisor)
          const validTecnicos = prev.nombre_asignado.filter(t => opts.nombres_asignados.includes(t));
          if (validTecnicos.length !== prev.nombre_asignado.length) {
            newFilters.nombre_asignado = validTecnicos;
            changed = true;
          }

          return changed ? newFilters : prev;
        });

      } catch (error) {
        console.error('Error fetching cascade options:', error);
      }
    }, 400);

    return () => {
      if (cascadeTimeoutRef.current) {
        clearTimeout(cascadeTimeoutRef.current);
      }
    };
  }, [initialized, filters.año, filters.mes.join(','), filters.zona.join(','), filters.regional.join(','), filters.supervisor.join(',')]);

  return { filters, setFilters, options };
}
