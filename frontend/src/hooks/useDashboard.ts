import { useState, useEffect, useCallback } from 'react';
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

export function useDashboard(filters: Filters) {
  const [data, setData] = useState<DashboardData>(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const dashboardData = await getDashboardData(filters);
      setData(dashboardData);
      setLastUpdate(new Date().toLocaleString('es-CL'));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData();
  };

  return { data, isLoading, lastUpdate, handleRefresh };
}
