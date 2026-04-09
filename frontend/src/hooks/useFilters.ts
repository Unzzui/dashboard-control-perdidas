import { useState, useEffect, useCallback } from 'react';
import { Filters, FilterOptions } from '@/types';
import { getFilterOptions } from '@/lib/api';

const initialFilters: Filters = {
  año: null,
  mes: null,
  dia: null,
  zona: null,
  regional: null,
  supervisor: null,
  estado: null,
  tratamiento: null,
  tipo_campana: null,
  nombre_asignado: null,
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

  const fetchOptions = useCallback(async () => {
    try {
      const opts = await getFilterOptions();
      setOptions(opts);
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  return { filters, setFilters, options };
}
