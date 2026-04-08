'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import FilterBar from '@/components/ui/FilterBar';
import IndicadoresGenerales from '@/components/views/IndicadoresGenerales';
import ResultadosDelegacion from '@/components/views/ResultadosDelegacion';
import RankingTecnicos from '@/components/views/RankingTecnicos';
import EfectividadMensual from '@/components/views/EfectividadMensual';
import VisitasFallidas from '@/components/views/VisitasFallidas';
import Normalizaciones from '@/components/views/Normalizaciones';
import ProduccionMensual from '@/components/views/ProduccionMensual';
import ControlKWH from '@/components/views/ControlKWH';
import { Filters, FilterOptions, DashboardData } from '@/types';

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
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('indicadores');
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [options, setOptions] = useState<FilterOptions>(initialOptions);
  const [data, setData] = useState<DashboardData>(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');

  const fetchOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/filters');
      if (res.ok) {
        const opts = await res.json();
        setOptions(opts);
      }
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });

      const queryString = params.toString();
      const endpoint = queryString ? `/api/v1/dashboard?${queryString}` : '/api/v1/dashboard';

      const res = await fetch(endpoint);
      if (res.ok) {
        const dashboardData = await res.json();
        setData(dashboardData);
        setLastUpdate(new Date().toLocaleString('es-CL'));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'indicadores':
        return (
          <IndicadoresGenerales
            kpis={data.kpis}
            zonas={data.zonas}
            daily={data.daily}
          />
        );
      case 'delegacion':
        return (
          <ResultadosDelegacion
            zonas={data.zonas}
            campanas={data.campanas}
            daily={data.daily}
            cnrFalla={data.kpis.cnr_falla}
            cnrHurto={data.kpis.cnr_hurto}
          />
        );
      case 'ranking':
        return <RankingTecnicos tecnicos={data.tecnicos} />;
      case 'efectividad':
        return (
          <EfectividadMensual
            mensual={data.mensual}
            kpis={data.kpis}
          />
        );
      case 'visitas-fallidas':
        return (
          <VisitasFallidas
            responsabilidad={data.visitas_fallidas_responsabilidad}
            totalCGE={data.visitas_fallidas_responsabilidad.reduce((acc, r) => acc + r.responsabilidad_cge, 0)}
            totalContratista={data.visitas_fallidas_responsabilidad.reduce((acc, r) => acc + r.responsabilidad_contratista, 0)}
            resultadosFallidos={[]}
          />
        );
      case 'normalizaciones':
        return (
          <Normalizaciones
            normalizaciones={data.normalizaciones}
            cnrFalla={data.kpis.cnr_falla}
            cnrHurto={data.kpis.cnr_hurto}
            dailyTratamiento={data.daily}
          />
        );
      case 'produccion':
        return (
          <ProduccionMensual
            produccion={data.produccion}
            produccionTecnicos={data.tecnicos.map((t) => ({
              zona: t.zona,
              nombre: t.nombre,
              produccion: t.efectivas * 25000, // Estimate
            }))}
          />
        );
      case 'kwh':
        return (
          <ControlKWH
            data={[]}
            totalKWH={data.kpis.kwh_recuperado}
            pctKWHZona={12.25}
            efectivasPorTecnico={[]}
          />
        );
      case 'mapa':
        return (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Mapa de Operaciones</h3>
            <div className="h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">
              <p className="text-gray-500">Mapa disponible próximamente</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        lastUpdate={lastUpdate || 'Cargando...'}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />

      <div className="flex">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1">
          <FilterBar
            filters={filters}
            options={options}
            onChange={setFilters}
          />

          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oca-blue"></div>
              </div>
            ) : (
              renderContent()
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
