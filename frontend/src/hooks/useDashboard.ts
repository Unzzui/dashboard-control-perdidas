import { useState, useEffect, useCallback, useRef } from 'react';
import { Filters, DashboardData } from '@/types';
import { getDashboardData } from '@/lib/api';

const defaultData: DashboardData = {
  kpis: {
    total_registros: 0,
    total_normal: 0,
    total_cnr: 0,
    pct_cnr: 0,
    total_visita_fallida: 0,
    pct_visita_fallida: 0,
    total_efectivas: 0,
    pct_efectivas: 0,
    cnr_falla: 0,
    pct_cnr_falla: 0,
    cnr_hurto: 0,
    pct_cnr_hurto: 0,
    kwh_recuperado: 0,
  },
  zonas: [],
  daily: [],
  mensual: [],
  tecnicos: [],
  campanas: [],
  normalizaciones: [],
  visitas_fallidas_responsabilidad: [],
  produccion: [],
  resultados_fallidos: [],
};

// Generar clave única para los filtros
function getFilterKey(filters: Filters): string {
  return JSON.stringify({
    año: filters.año,
    mes: filters.mes.sort(),
    dia: filters.dia,
    zona: filters.zona.sort(),
    regional: filters.regional.sort(),
    supervisor: filters.supervisor.sort(),
  });
}

export function useDashboard(filters: Filters) {
  const [data, setData] = useState<DashboardData>(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const lastFilterKey = useRef<string>('');
  const abortController = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (force = false) => {
    // Evitar fetch si los filtros no han cambiado
    const currentKey = getFilterKey(filters);
    if (!force && currentKey === lastFilterKey.current && data !== defaultData) {
      return;
    }

    // Cancelar request anterior si existe
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    // No hacer fetch si no hay año seleccionado
    if (!filters.año) {
      return;
    }

    lastFilterKey.current = currentKey;
    setIsLoading(true);

    try {
      const dashboardData = await getDashboardData(filters);
      setData(dashboardData);
      setLastUpdate(new Date().toLocaleString('es-CL'));
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error fetching data:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [filters, data]);

  useEffect(() => {
    fetchData();
  }, [filters.año, filters.mes.join(','), filters.zona.join(','), filters.dia]);

  const handleRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return { data, isLoading, lastUpdate, handleRefresh };
}
