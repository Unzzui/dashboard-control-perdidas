'use client';

import { useState, useCallback } from 'react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import FilterBar from '@/components/ui/FilterBar';
import AlertasOperativas from '@/components/views/AlertasOperativas';
import ControlDiario from '@/components/views/ControlDiario';
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
import AnalisisComparativo from '@/components/views/AnalisisComparativo';
import AnalisisJornada from '@/components/views/AnalisisJornada';
import ControlMetas from '@/components/views/ControlMetas';
import PresentationMode from '@/components/views/PresentationMode';
import ConfiguracionView from '@/components/views/configuracion/ConfiguracionView';
import { useFilters } from '@/hooks/useFilters';
import { useDashboard } from '@/hooks/useDashboard';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { Filters } from '@/types';
import { cn } from '@/lib/utils';

function DashboardContent() {
  const [activeTab, setActiveTab] = useState('alertas');
  const { filters, setFilters, options } = useFilters();
  const { data, isLoading, lastUpdate, handleRefresh } = useDashboard(filters);
  const { isNormal, isPresentation } = useSidebar();

  // Funciones de filtrado interactivo
  const handleFilterByDay = useCallback((day: number) => {
    setFilters(prev => ({
      ...prev,
      dia: prev.dia.includes(day) ? prev.dia.filter(d => d !== day) : [...prev.dia, day],
    }));
  }, [setFilters]);

  const handleFilterByZona = useCallback((zona: string) => {
    setFilters(prev => ({
      ...prev,
      zona: prev.zona.includes(zona) ? prev.zona.filter(z => z !== zona) : [...prev.zona, zona],
    }));
  }, [setFilters]);

  const handleFilterByMes = useCallback((mes: string) => {
    const mesLower = mes.toLowerCase();
    setFilters(prev => ({
      ...prev,
      mes: prev.mes.includes(mesLower) ? prev.mes.filter(m => m !== mesLower) : [...prev.mes, mesLower],
    }));
  }, [setFilters]);

  const handleFilterByTecnico = useCallback((tecnico: string) => {
    setFilters(prev => ({
      ...prev,
      nombre_asignado: prev.nombre_asignado.includes(tecnico)
        ? prev.nombre_asignado.filter(t => t !== tecnico)
        : [...prev.nombre_asignado, tecnico],
    }));
  }, [setFilters]);

  // Objeto con todas las funciones de filtrado
  const filterHandlers = {
    onFilterByDay: handleFilterByDay,
    onFilterByZona: handleFilterByZona,
    onFilterByMes: handleFilterByMes,
    onFilterByTecnico: handleFilterByTecnico,
    currentFilters: filters,
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'alertas':
        return (
          <AlertasOperativas
            filters={filters}
            pagoTecnicos={data.pago_tecnicos}
            calendarioMes={data.calendario_mes}
          />
        );
      case 'control-diario':
        return <ControlDiario filters={filters} />;
      case 'control-metas':
        return (
          <ControlMetas
            tecnicos={data.tecnicos}
            filters={filters}
            calendarioMes={data.calendario_mes}
            kpis={data.kpis}
          />
        );
      case 'indicadores':
        return (
          <IndicadoresGenerales
            kpis={data.kpis}
            zonas={data.zonas}
            daily={data.daily}
            {...filterHandlers}
          />
        );
      case 'delegacion':
        return (
          <ResultadosDelegacion
            campanas={data.campanas}
          />
        );
      case 'ranking':
        return (
          <RankingTecnicos
            tecnicos={data.tecnicos}
            {...filterHandlers}
          />
        );
      case 'efectividad':
        return (
          <EfectividadMensual
            mensual={data.mensual}
            kpis={data.kpis}
            {...filterHandlers}
          />
        );
      case 'visitas-fallidas':
        return (
          <VisitasFallidas
            responsabilidad={data.visitas_fallidas_responsabilidad}
            totalCGE={data.kpis.total_visita_fallida_cge}
            totalContratista={data.kpis.total_visita_fallida_oca}
            resultadosFallidos={data.resultados_fallidos || []}
            kpis={data.kpis}
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
            pagoTecnicos={data.pago_tecnicos}
            mesesSeleccionados={filters.mes}
            calendarioMes={data.calendario_mes}
            filters={filters}
          />
        );
      case 'kwh':
        return (
          <ControlKWH
            tecnicos={data.tecnicos}
            zonas={data.zonas}
            daily={data.daily}
            totalKWH={data.kpis.kwh_recuperado}
            {...filterHandlers}
          />
        );
      case 'retiro-medidores':
        return <RetiroMedidores filters={filters} />;
      case 'comparativo':
        return (
          <AnalisisComparativo
            filters={filters}
            {...filterHandlers}
          />
        );
      case 'jornada':
        return (
          <AnalisisJornada
            filters={filters}
            daily={data.daily}
          />
        );
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
      case 'configuracion':
        return <ConfiguracionView />;
      default:
        return null;
    }
  };

  // Modo presentación
  if (isPresentation && !isLoading) {
    return <PresentationMode data={data} filters={filters} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className={cn(
        'transition-all duration-300',
        isNormal ? 'pl-56' : 'pl-14'
      )}>
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

export default function Dashboard() {
  return (
    <SidebarProvider>
      <DashboardContent />
    </SidebarProvider>
  );
}
