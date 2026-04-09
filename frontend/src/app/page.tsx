'use client';

import { useState } from 'react';
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
import RetiroMedidores from '@/components/views/RetiroMedidores';
import DetalleAviso from '@/components/views/DetalleAviso';
import { useFilters } from '@/hooks/useFilters';
import { useDashboard } from '@/hooks/useDashboard';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('indicadores');
  const { filters, setFilters, options } = useFilters();
  const { data, isLoading, lastUpdate, handleRefresh } = useDashboard(filters);

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
            resultadosFallidos={data.resultados_fallidos || []}
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
              produccion: t.efectivas * 25000,
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
      case 'retiro-medidores':
        return <RetiroMedidores filters={filters} />;
      case 'detalle-aviso':
        return <DetalleAviso filters={filters} />;
      case 'mapa':
        return (
          <div className="card">
            <h3 className="section-title mb-3">Mapa de Operaciones</h3>
            <div className="h-[500px] bg-slate-100 rounded-lg flex items-center justify-center">
              <p className="text-slate-400">Mapa disponible próximamente</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="pl-56 transition-all duration-300">
        <Header
          lastUpdate={lastUpdate || 'Cargando...'}
          onRefresh={handleRefresh}
          isLoading={isLoading}
        />

        <FilterBar
          filters={filters}
          options={options}
          onChange={setFilters}
        />

        <main className="p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oca-blue"></div>
            </div>
          ) : (
            renderContent()
          )}
        </main>
      </div>
    </div>
  );
}
