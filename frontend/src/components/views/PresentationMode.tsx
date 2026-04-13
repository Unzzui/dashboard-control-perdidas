'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';
import { DashboardData, Filters } from '@/types';
import ReactECharts from 'echarts-for-react';

interface PresentationModeProps {
  data: DashboardData;
  filters: Filters;
}

// Metas
const META_EFECTIVAS_MES = 160;
const META_EFECTIVAS_DIA = 8;
const DIAS_HABILES_MES = 20;

export default function PresentationMode({ data, filters }: PresentationModeProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const { setNormal } = useSidebar();

  // Calcular días hábiles
  const diasInfo = useMemo(() => {
    const hoy = new Date();
    const diaActual = hoy.getDate();
    const diasHabilesTranscurridos = Math.round(diaActual * 0.7);
    const diasHabilesRestantes = Math.max(0, DIAS_HABILES_MES - diasHabilesTranscurridos);
    return { diaActual, diasHabilesTranscurridos, diasHabilesRestantes };
  }, []);

  // Procesar datos de brigadas con proyección y VF calculado
  const brigadasData = useMemo(() => {
    return data.tecnicos.map(t => {
      const proyeccion = Math.round(t.efectivas + (t.promedio_efectivas * diasInfo.diasHabilesRestantes));
      // Calcular VF desde visitas_totales y pct_visitas_fallidas
      const visita_fallida = Math.round(t.visitas_totales * t.pct_visitas_fallidas / 100);
      let estado: 'cumplida' | 'en_camino' | 'no_alcanzara';
      if (t.efectivas >= META_EFECTIVAS_MES) {
        estado = 'cumplida';
      } else if (diasInfo.diasHabilesRestantes > 0 && proyeccion >= META_EFECTIVAS_MES) {
        estado = 'en_camino';
      } else {
        estado = 'no_alcanzara';
      }
      return { ...t, proyeccion, estado, visita_fallida };
    });
  }, [data.tecnicos, diasInfo.diasHabilesRestantes]);

  // Agrupar por zona
  const zonas = useMemo(() => {
    const zonasMap = new Map<string, typeof brigadasData>();
    brigadasData.forEach(b => {
      if (!zonasMap.has(b.zona)) zonasMap.set(b.zona, []);
      zonasMap.get(b.zona)!.push(b);
    });
    return Array.from(zonasMap.entries()).map(([zona, brigadas]) => {
      const cumplidas = brigadas.filter(b => b.estado === 'cumplida').length;
      const enCamino = brigadas.filter(b => b.estado === 'en_camino').length;
      const noAlcanzara = brigadas.filter(b => b.estado === 'no_alcanzara').length;
      const totalEfectivas = brigadas.reduce((a, b) => a + b.efectivas, 0);
      const totalCNR = brigadas.reduce((a, b) => a + b.cnr, 0);
      const totalKWH = brigadas.reduce((a, b) => a + b.kwh_estimado, 0);
      const promedioEfectivasDia = brigadas.reduce((a, b) => a + b.promedio_efectivas, 0) / brigadas.length;
      const promedioCNRDia = brigadas.reduce((a, b) => a + b.promedio_cnr, 0) / brigadas.length;

      // Buscar stats de zona
      const zonaStats = data.zonas.find(z => z.zona === zona);

      return {
        zona,
        brigadas: brigadas.sort((a, b) => b.efectivas - a.efectivas),
        cumplidas,
        enCamino,
        noAlcanzara,
        total: brigadas.length,
        pctCumpliran: ((cumplidas + enCamino) / brigadas.length) * 100,
        totalEfectivas,
        totalCNR,
        totalKWH,
        promedioEfectivasDia,
        promedioCNRDia,
        visitasFallidas: zonaStats?.visita_fallida || 0,
        pctVisitasFallidas: zonaStats?.pct_visita_fallida || 0,
      };
    }).sort((a, b) => a.zona.localeCompare(b.zona));
  }, [brigadasData, data.zonas]);

  // Slides: Portada + Resumen + Zonas (1 por zona) + VF + KWH
  const slideNames = useMemo(() => {
    const names = ['Portada', 'Resumen'];
    zonas.forEach(z => names.push(z.zona));
    names.push('Visitas Fallidas', 'kWh Recuperado');
    return names;
  }, [zonas]);

  const totalSlides = slideNames.length;

  // Navegación
  const goToSlide = useCallback((index: number) => {
    if (transitioning || index === currentSlide) return;
    setTransitioning(true);
    setTimeout(() => {
      setCurrentSlide(index);
      setTransitioning(false);
    }, 150);
  }, [currentSlide, transitioning]);

  const nextSlide = useCallback(() => {
    goToSlide((currentSlide + 1) % totalSlides);
  }, [currentSlide, totalSlides, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide((currentSlide - 1 + totalSlides) % totalSlides);
  }, [currentSlide, totalSlides, goToSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  // Período
  const periodoTexto = useMemo(() => {
    if (filters.mes.length === 0) return 'Todo el período';
    if (filters.mes.length === 1) return filters.mes[0].charAt(0).toUpperCase() + filters.mes[0].slice(1);
    return `${filters.mes.length} meses`;
  }, [filters.mes]);

  const renderSlide = () => {
    if (currentSlide === 0) {
      return <SlideCover periodoTexto={periodoTexto} diasInfo={diasInfo} totalZonas={zonas.length} totalBrigadas={brigadasData.length} />;
    }
    if (currentSlide === 1) {
      return <SlideResumen data={data} zonas={zonas} diasInfo={diasInfo} />;
    }
    if (currentSlide >= 2 && currentSlide < 2 + zonas.length) {
      const zonaData = zonas[currentSlide - 2];
      return (
        <SlideZona
          zonaData={zonaData}
          diasInfo={diasInfo}
          dailyZona={data.daily_por_zona?.[zonaData.zona] || []}
          resultadosFallidosZona={data.resultados_fallidos_por_zona?.[zonaData.zona] || []}
        />
      );
    }
    if (currentSlide === 2 + zonas.length) {
      return <SlideVisitasFallidas data={data} />;
    }
    if (currentSlide === 2 + zonas.length + 1) {
      return <SlideKWH data={data} zonas={zonas} />;
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-[900] bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold text-slate-800">Control de Pérdidas</span>
          <span className="text-sm text-slate-500">{periodoTexto}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
              Día {diasInfo.diaActual}
            </span>
            <span className="px-2 py-1 bg-green-50 text-green-600 rounded text-xs">
              {diasInfo.diasHabilesRestantes} días hábiles restantes
            </span>
          </div>
          <button
            onClick={setNormal}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
          >
            <X size={16} />
            ESC
          </button>
        </div>
      </div>

      {/* Slide Content */}
      <div className="flex-1 overflow-hidden">
        <div className={`h-full transition-opacity duration-150 ${transitioning ? 'opacity-0' : 'opacity-100'}`}>
          {renderSlide()}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-center gap-2 px-8 py-3 bg-white border-t border-slate-200">
        <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1">
          {slideNames.map((name, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={`px-3 py-1.5 text-xs rounded whitespace-nowrap transition-all ${
                currentSlide === idx
                  ? 'bg-oca-blue text-white font-semibold'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 ml-4 whitespace-nowrap">
          {currentSlide + 1} / {totalSlides}
        </span>
      </div>
    </div>
  );
}

// ============= SLIDES =============

interface DiasInfo {
  diaActual: number;
  diasHabilesTranscurridos: number;
  diasHabilesRestantes: number;
}

function SlideCover({ periodoTexto, diasInfo, totalZonas, totalBrigadas }: {
  periodoTexto: string;
  diasInfo: DiasInfo;
  totalZonas: number;
  totalBrigadas: number;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-white via-slate-50 to-white p-12 relative">
      {/* Decoración visual sutil */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-oca-blue/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl" />

      <div className="text-center max-w-5xl relative z-10">
        {/* Logo OCA */}
        <div className="mb-8">
          <Image
            src="/logoOcaHorizontal.svg"
            alt="OCA"
            width={200}
            height={67}
            className="mx-auto"
            priority
          />
        </div>

        <div className="inline-block bg-oca-blue/10 px-4 py-2 rounded-full mb-4">
          <p className="text-oca-blue text-sm font-semibold tracking-widest uppercase">Presentación de Resultados</p>
        </div>
        <h1 className="text-5xl font-bold mb-4 text-slate-800">
          Control de Pérdidasy en
        </h1>
        <p className="text-2xl text-slate-500 mb-10">
          Seguimiento de Metas y Cumplimiento
        </p>

        <div className="grid grid-cols-4 gap-5 mb-10">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <p className="text-4xl font-bold text-oca-blue">{periodoTexto}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-3">Período</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-green-200 shadow-sm">
            <p className="text-4xl font-bold text-green-600">{diasInfo.diasHabilesRestantes}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-3">Días Hábiles Restantes</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <p className="text-4xl font-bold text-slate-800">{totalZonas}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-3">Zonas</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <p className="text-4xl font-bold text-slate-800">{totalBrigadas}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-3">Brigadas</p>
          </div>
        </div>

        <div className="inline-flex items-center gap-4 bg-slate-100 px-6 py-3 rounded-full">
          <span className="text-slate-600 text-sm">Meta mensual:</span>
          <span className="text-lg font-bold text-oca-blue">{META_EFECTIVAS_MES} efectivas</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-600 text-sm">Meta diaria:</span>
          <span className="text-lg font-bold text-oca-blue">{META_EFECTIVAS_DIA} efectivas</span>
        </div>
      </div>

      <div className="absolute bottom-8 flex items-center gap-2 text-slate-400 text-sm">
        <span className="animate-pulse">→</span>
        <span>Presiona flecha derecha o espacio para continuar</span>
      </div>
    </div>
  );
}

function SlideResumen({ data, zonas, diasInfo }: {
  data: DashboardData;
  zonas: any[];
  diasInfo: DiasInfo;
}) {
  const totales = useMemo(() => {
    const cumplidas = zonas.reduce((a, z) => a + z.cumplidas, 0);
    const enCamino = zonas.reduce((a, z) => a + z.enCamino, 0);
    const noAlcanzara = zonas.reduce((a, z) => a + z.noAlcanzara, 0);
    const total = zonas.reduce((a, z) => a + z.total, 0);
    return { cumplidas, enCamino, noAlcanzara, total, pctCumpliran: ((cumplidas + enCamino) / total) * 100 };
  }, [zonas]);

  const chartOption = useMemo(() => ({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: zonas.map(z => z.zona),
      axisLabel: { color: '#64748b', fontSize: 10, rotate: 30 },
      axisLine: { lineStyle: { color: '#e2e8f0' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
    },
    series: [
      { name: 'Cumplidas', type: 'bar', stack: 'total', data: zonas.map(z => z.cumplidas), itemStyle: { color: '#10b981' } },
      { name: 'En Camino', type: 'bar', stack: 'total', data: zonas.map(z => z.enCamino), itemStyle: { color: '#f59e0b' } },
      { name: 'No Alcanzarán', type: 'bar', stack: 'total', data: zonas.map(z => z.noAlcanzara), itemStyle: { color: '#ef4444' } },
    ]
  }), [zonas]);

  return (
    <div className="h-full bg-white p-6">
      {/* Header con KPIs principales */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-800">Resumen Ejecutivo</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 px-4 py-2 bg-slate-50 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{data.kpis.total_efectivas.toLocaleString()}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Efectivas</p>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-oca-blue">{data.kpis.total_cnr.toLocaleString()}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">CNR</p>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-cyan-600">{(data.kpis.kwh_recuperado / 1000).toFixed(0)}k</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">kWh</p>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{data.kpis.total_visita_fallida.toLocaleString()}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">VF</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5 h-[calc(100%-90px)]">
        {/* KPIs de Estado */}
        <div className="col-span-3 space-y-3">
          {/* Gran indicador de % cumplirán */}
          <div className={`rounded-xl p-5 text-center ${totales.pctCumpliran >= 70 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-5xl font-bold ${totales.pctCumpliran >= 70 ? 'text-green-600' : 'text-red-500'}`}>{totales.pctCumpliran.toFixed(0)}%</p>
            <p className="text-sm text-slate-500 mt-2">de brigadas cumplirán meta</p>
            <div className="mt-3 h-2 bg-white/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${totales.pctCumpliran >= 70 ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${totales.pctCumpliran}%` }}
              />
            </div>
          </div>

          {/* Estados individuales */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
              <p className="text-2xl font-bold text-green-600">{totales.cumplidas}</p>
              <p className="text-[9px] uppercase tracking-wider text-slate-400 mt-1">Cumplidas</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-center">
              <p className="text-2xl font-bold text-amber-600">{totales.enCamino}</p>
              <p className="text-[9px] uppercase tracking-wider text-slate-400 mt-1">En Camino</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-center">
              <p className="text-2xl font-bold text-red-500">{totales.noAlcanzara}</p>
              <p className="text-[9px] uppercase tracking-wider text-slate-400 mt-1">No Alcanza</p>
            </div>
          </div>

          {/* Días restantes */}
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Avance del Mes</p>
              <p className="text-sm font-bold text-oca-blue">{diasInfo.diasHabilesTranscurridos}/{DIAS_HABILES_MES}</p>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-oca-blue rounded-full"
                style={{ width: `${(diasInfo.diasHabilesTranscurridos / DIAS_HABILES_MES) * 100}%` }}
              />
            </div>
            <p className="text-xs text-green-600 mt-2 font-medium">{diasInfo.diasHabilesRestantes} días hábiles restantes</p>
          </div>

          {/* Meta */}
          <div className="bg-oca-blue/5 rounded-lg p-4 border border-oca-blue/20">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Meta por Brigada</p>
            <p className="text-3xl font-bold text-oca-blue">{META_EFECTIVAS_MES}</p>
            <p className="text-xs text-slate-500 mt-1">{META_EFECTIVAS_DIA} efectivas/día</p>
          </div>
        </div>

        {/* Gráfico por Zona */}
        <div className="col-span-9 bg-white rounded-lg p-5 border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Estado de Metas por Zona</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-[10px] text-slate-500">Cumplidas</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-500" />
                <span className="text-[10px] text-slate-500">En Camino</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span className="text-[10px] text-slate-500">No Alcanzarán</span>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ReactECharts option={chartOption} style={{ height: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideZona({ zonaData, diasInfo, dailyZona, resultadosFallidosZona }: { zonaData: any; diasInfo: DiasInfo; dailyZona: any[]; resultadosFallidosZona: any[] }) {
  const [activeTab, setActiveTab] = useState<'metas' | 'kpi' | 'fallidas' | 'brigadas'>('metas');
  const { zona, brigadas, cumplidas, enCamino, noAlcanzara, total, pctCumpliran, totalEfectivas, totalCNR, totalKWH, promedioEfectivasDia, promedioCNRDia, visitasFallidas, pctVisitasFallidas } = zonaData;

  // Detectar si el mes está completo (días restantes = 0)
  const mesCompleto = diasInfo.diasHabilesRestantes === 0;

  const tabs = [
    { id: 'metas' as const, label: 'Cumplimiento Metas' },
    { id: 'kpi' as const, label: 'Indicadores' },
    { id: 'fallidas' as const, label: 'Visitas Fallidas' },
    { id: 'brigadas' as const, label: 'Detalle Brigadas' },
  ];

  // Brigadas críticas (no alcanzarán meta)
  const brigadasCriticas = useMemo(() => {
    return brigadas.filter((b: any) => b.estado === 'no_alcanzara')
      .sort((a: any, b: any) => a.proyeccion - b.proyeccion);
  }, [brigadas]);

  // Datos para VF por brigada
  const brigadasVF = useMemo(() => {
    return [...brigadas]
      .map((b: any) => ({ nombre: b.nombre, vf: b.visita_fallida || 0 }))
      .sort((a, b) => b.vf - a.vf);
  }, [brigadas]);

  const totalVFZona = brigadasVF.reduce((acc, b) => acc + b.vf, 0);

  // Chart Pareto de causas VF (específico de la zona)
  const paretoVFChart = useMemo(() => {
    if (!resultadosFallidosZona || resultadosFallidosZona.length === 0) return null;
    const sorted = [...resultadosFallidosZona].sort((a, b) => b.cantidad - a.cantidad);
    const top10 = sorted.slice(0, 10);
    const totalResultados = sorted.reduce((acc, r) => acc + r.cantidad, 0);

    // Calcular porcentaje acumulado para línea Pareto
    let acumulado = 0;
    const dataWithAcumulado = top10.map(r => {
      acumulado += r.cantidad;
      return {
        name: r.resultado.length > 25 ? r.resultado.substring(0, 25) + '...' : r.resultado,
        fullName: r.resultado,
        value: r.cantidad,
        pct: totalResultados > 0 ? (r.cantidad / totalResultados * 100).toFixed(1) : '0',
        pctAcumulado: totalResultados > 0 ? (acumulado / totalResultados * 100).toFixed(1) : '0',
      };
    });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
        textStyle: { color: '#334155', fontSize: 11 },
        formatter: (params: any) => {
          const bar = params.find((p: any) => p.seriesType === 'bar');
          const line = params.find((p: any) => p.seriesType === 'line');
          const item = dataWithAcumulado.find(d => d.name === bar?.name);
          return `<div style="font-weight:600;margin-bottom:4px">${item?.fullName || bar?.name}</div>
                  <div>Cantidad: <b>${bar?.value}</b> (${item?.pct}%)</div>
                  <div>% Acumulado: <b>${line?.value}%</b></div>`;
        }
      },
      grid: { left: '3%', right: '8%', bottom: '25%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dataWithAcumulado.map(d => d.name),
        axisLabel: { color: '#64748b', fontSize: 8, rotate: 40, interval: 0 },
        axisLine: { lineStyle: { color: '#e2e8f0' } }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Cantidad',
          axisLabel: { color: '#64748b', fontSize: 10 },
          axisLine: { lineStyle: { color: '#e2e8f0' } },
          splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
        },
        {
          type: 'value',
          name: '%',
          max: 100,
          axisLabel: { color: '#64748b', fontSize: 10, formatter: '{value}%' },
          axisLine: { lineStyle: { color: '#e2e8f0' } },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'Cantidad',
          type: 'bar',
          data: dataWithAcumulado.map(d => d.value),
          itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 30
        },
        {
          name: '% Acumulado',
          type: 'line',
          yAxisIndex: 1,
          data: dataWithAcumulado.map(d => parseFloat(d.pctAcumulado)),
          itemStyle: { color: '#ef4444' },
          lineStyle: { width: 2 },
          symbol: 'circle',
          symbolSize: 6
        }
      ]
    };
  }, [resultadosFallidosZona]);

  // Chart de evolución diaria (específico de la zona)
  const dailyEvolutionChart = useMemo(() => {
    if (!dailyZona || dailyZona.length === 0) return null;
    const sortedDaily = [...dailyZona].sort((a, b) => a.dia - b.dia);
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
        textStyle: { color: '#334155', fontSize: 11 },
        formatter: (params: any) => {
          let html = `<div style="font-weight:600;margin-bottom:4px">${params[0].axisValue}</div>`;
          params.forEach((p: any) => {
            html += `<div style="display:flex;align-items:center;gap:6px">
              <span style="width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
              ${p.seriesName}: <b>${p.value.toLocaleString('es-CL')}</b>
            </div>`;
          });
          return html;
        }
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#64748b', fontSize: 10 },
        itemWidth: 15,
        itemHeight: 8
      },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '8%', containLabel: true },
      xAxis: {
        type: 'category',
        data: sortedDaily.map(d => `Día ${d.dia}`),
        axisLabel: { color: '#64748b', fontSize: 9 },
        axisLine: { lineStyle: { color: '#e2e8f0' } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 10 },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
      },
      series: [
        {
          name: 'Efectivas',
          type: 'line',
          data: sortedDaily.map(d => d.cnr + d.normal),
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 2 },
          smooth: true,
          symbol: 'circle',
          symbolSize: 6
        },
        {
          name: 'CNR',
          type: 'line',
          data: sortedDaily.map(d => d.cnr),
          itemStyle: { color: '#294D6D' },
          lineStyle: { width: 2 },
          smooth: true,
          symbol: 'circle',
          symbolSize: 6
        },
        {
          name: 'VF',
          type: 'line',
          data: sortedDaily.map(d => d.visita_fallida),
          itemStyle: { color: '#f59e0b' },
          lineStyle: { width: 2 },
          smooth: true,
          symbol: 'circle',
          symbolSize: 6
        }
      ]
    };
  }, [dailyZona]);

  // Chart de brigadas críticas (horizontal bar)
  const criticasChartOption = useMemo(() => ({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '3%', containLabel: true },
    xAxis: {
      type: 'value',
      max: META_EFECTIVAS_MES,
      axisLabel: { color: '#64748b', fontSize: 10 },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      data: brigadasCriticas.slice(0, 6).map((b: any) => b.nombre.split(' ').slice(0, 2).join(' ')).reverse(),
      axisLabel: { color: '#64748b', fontSize: 9 },
      axisLine: { lineStyle: { color: '#e2e8f0' } }
    },
    series: [
      {
        name: 'Acumulado',
        type: 'bar',
        data: brigadasCriticas.slice(0, 6).map((b: any) => b.efectivas).reverse(),
        itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 20,
        label: { show: true, position: 'right', fontSize: 10, color: '#64748b' }
      }
    ]
  }), [brigadasCriticas]);

  return (
    <div className="h-full bg-white p-6 overflow-hidden flex flex-col">
      {/* Header de Zona - Más visual */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-6">
          <div className="bg-oca-blue text-white px-5 py-3 rounded-lg">
            <h2 className="text-2xl font-bold">{zona}</h2>
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800">{total}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Brigadas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{diasInfo.diasHabilesRestantes}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Días Restantes</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xl font-bold text-slate-800">{totalEfectivas}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Efectivas</p>
          </div>
          <div className="text-center px-4 py-2 bg-oca-blue/5 rounded-lg border border-oca-blue/20">
            <p className="text-xl font-bold text-oca-blue">{totalCNR}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">CNR</p>
          </div>
          <div className={`text-center px-5 py-2 rounded-lg ${pctCumpliran >= 70 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-2xl font-bold ${pctCumpliran >= 70 ? 'text-green-600' : 'text-red-500'}`}>{pctCumpliran.toFixed(0)}%</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Cumplirán Meta</p>
          </div>
        </div>
      </div>

      {/* Tabs internos */}
      <div className="flex gap-1 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium rounded-t transition-colors ${
              activeTab === tab.id
                ? 'bg-oca-blue text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'metas' && (
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* Estado resumen + KPIs */}
            <div className="col-span-3 space-y-3">
              {/* Estado cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
                  <p className="text-2xl font-bold text-green-600">{cumplidas}</p>
                  <p className="text-[9px] uppercase tracking-wider text-slate-400">Cumplidas</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-center">
                  <p className="text-2xl font-bold text-amber-600">{enCamino}</p>
                  <p className="text-[9px] uppercase tracking-wider text-slate-400">En Camino</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-center">
                  <p className="text-2xl font-bold text-red-500">{noAlcanzara}</p>
                  <p className="text-[9px] uppercase tracking-wider text-slate-400">No Alcanza</p>
                </div>
              </div>

              {/* Producción / Montos */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Producción Zona</p>
                <p className="text-2xl font-bold mt-1 text-green-600">
                  ${(totalEfectivas * 25000 / 1000000).toFixed(1)}M
                </p>
                <p className="text-[10px] text-slate-400 mt-1">${(totalEfectivas * 25000).toLocaleString('es-CL')} CLP</p>
              </div>

              {/* Promedio E/día */}
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Promedio E/día</p>
                    <p className={`text-2xl font-bold mt-1 ${promedioEfectivasDia >= META_EFECTIVAS_DIA ? 'text-green-600' : 'text-red-500'}`}>
                      {promedioEfectivasDia.toFixed(1)}
                    </p>
                  </div>
                  <div className={`p-1.5 rounded-full ${promedioEfectivasDia >= META_EFECTIVAS_DIA ? 'bg-green-100' : 'bg-red-100'}`}>
                    {promedioEfectivasDia >= META_EFECTIVAS_DIA ? <TrendingUp className="text-green-600" size={16} /> : <TrendingDown className="text-red-500" size={16} />}
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${promedioEfectivasDia >= META_EFECTIVAS_DIA ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, (promedioEfectivasDia / META_EFECTIVAS_DIA) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Meta: {META_EFECTIVAS_DIA}/día</p>
              </div>

              {/* Q Acumulado */}
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Q Acumulado</p>
                <p className="text-2xl font-bold mt-1 text-slate-800">{totalEfectivas}</p>
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-oca-blue rounded-full" style={{ width: `${Math.min(100, (totalEfectivas / (total * META_EFECTIVAS_MES)) * 100)}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{((totalEfectivas / (total * META_EFECTIVAS_MES)) * 100).toFixed(0)}% de meta ({total * META_EFECTIVAS_MES})</p>
              </div>

              {/* Avance del mes */}
              <div className={`rounded-lg p-3 border ${mesCompleto ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    {mesCompleto ? 'Mes Completado' : 'Avance del Mes'}
                  </p>
                  <p className={`text-sm font-bold ${mesCompleto ? 'text-green-600' : 'text-oca-blue'}`}>
                    {diasInfo.diasHabilesTranscurridos}/{DIAS_HABILES_MES}
                  </p>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${mesCompleto ? 'bg-green-500' : 'bg-oca-blue'}`}
                    style={{ width: `${(diasInfo.diasHabilesTranscurridos / DIAS_HABILES_MES) * 100}%` }}
                  />
                </div>
                {!mesCompleto && <p className="text-[10px] text-green-600 mt-1">{diasInfo.diasHabilesRestantes} días restantes</p>}
              </div>
            </div>

            {/* Brigadas Críticas (gráfico) */}
            <div className="col-span-4 bg-white rounded-lg border border-slate-200 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Brigadas Críticas</p>
                <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-600 rounded font-bold">{noAlcanzara} brigadas</span>
              </div>
              {brigadasCriticas.length > 0 ? (
                <div className="flex-1 min-h-0">
                  <ReactECharts option={criticasChartOption} style={{ height: '100%' }} />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-slate-400 text-sm">Sin brigadas críticas</p>
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-2 text-center">Acumulado vs Meta ({META_EFECTIVAS_MES})</p>
            </div>

            {/* Tabla resumen brigadas */}
            <div className="col-span-5 bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Estado de Brigadas</p>
                <p className="text-[10px] text-slate-400">Prod. Total: <span className="font-semibold text-green-600">${(totalEfectivas * 25000 / 1000000).toFixed(1)}M</span></p>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2 text-left font-semibold">Brigada</th>
                      <th className="px-2 py-2 text-center font-semibold">Acum</th>
                      <th className="px-2 py-2 text-center font-semibold">E/día</th>
                      <th className="px-2 py-2 text-center font-semibold">Monto</th>
                      <th className="px-2 py-2 text-center font-semibold">{mesCompleto ? 'Final' : 'Proy'}</th>
                      <th className="px-3 py-2 text-center font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brigadas.map((b: any, idx: number) => (
                      <tr key={idx} className={`border-b border-slate-100 ${
                        b.estado === 'no_alcanzara' ? 'bg-red-50/50' :
                        b.estado === 'en_camino' ? 'bg-amber-50/50' : ''
                      }`}>
                        <td className="px-3 py-2 font-medium text-slate-700 truncate max-w-[100px]" title={b.nombre}>{b.nombre}</td>
                        <td className="px-2 py-2 text-center font-semibold text-slate-800">{b.efectivas}</td>
                        <td className="px-2 py-2 text-center">
                          <span className={b.promedio_efectivas >= META_EFECTIVAS_DIA ? 'text-green-600 font-semibold' : 'text-red-500'}>
                            {b.promedio_efectivas.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center text-green-600 font-medium">
                          ${((b.efectivas * 25000) / 1000000).toFixed(1)}M
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className={(mesCompleto ? b.efectivas : b.proyeccion) >= META_EFECTIVAS_MES ? 'text-green-600' : 'text-red-500'}>
                            {mesCompleto ? b.efectivas : b.proyeccion}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.estado === 'cumplida' ? 'bg-green-100 text-green-700' :
                            b.estado === 'en_camino' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-600'
                          }`}>
                            {b.estado === 'cumplida' ? 'CUMPLIDA' : b.estado === 'en_camino' ? 'EN CAMINO' : 'NO ALCANZA'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'kpi' && (
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* KPIs principales - columna izquierda */}
            <div className="col-span-3 space-y-3">
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Efectivas Totales</p>
                <p className="text-3xl font-bold mt-1 text-slate-800">{totalEfectivas}</p>
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${Math.min(100, (totalEfectivas / (total * META_EFECTIVAS_MES)) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{((totalEfectivas / (total * META_EFECTIVAS_MES)) * 100).toFixed(1)}% de meta zona</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">CNR Total</p>
                <p className="text-3xl font-bold mt-1 text-oca-blue">{totalCNR}</p>
                <p className="text-[10px] text-slate-400 mt-1">{promedioCNRDia.toFixed(1)} CNR/día</p>
              </div>

              <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">kWh Recuperado</p>
                <p className="text-3xl font-bold mt-1 text-cyan-600">{(totalKWH / 1000).toFixed(0)}k</p>
                <p className="text-[10px] text-slate-400 mt-1">{totalKWH.toLocaleString()} kWh</p>
              </div>

              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Visitas Fallidas</p>
                <p className="text-3xl font-bold mt-1 text-amber-600">{visitasFallidas}</p>
                <p className="text-[10px] text-slate-400 mt-1">{pctVisitasFallidas.toFixed(1)}% del total</p>
              </div>
            </div>

            {/* Gráfico de evolución diaria - centro */}
            <div className="col-span-6 bg-white rounded-lg p-4 border border-slate-200 flex flex-col">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Evolución Diaria</p>
              <div className="flex-1 min-h-0">
                {dailyEvolutionChart ? (
                  <ReactECharts option={dailyEvolutionChart} style={{ height: '100%' }} />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    Sin datos diarios disponibles
                  </div>
                )}
              </div>
            </div>

            {/* Top brigadas - columna derecha */}
            <div className="col-span-3 space-y-3">
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Prom E/día</p>
                  {promedioEfectivasDia >= META_EFECTIVAS_DIA ? <TrendingUp className="text-green-600" size={16} /> : <TrendingDown className="text-red-500" size={16} />}
                </div>
                <p className={`text-3xl font-bold ${promedioEfectivasDia >= META_EFECTIVAS_DIA ? 'text-green-600' : 'text-red-500'}`}>
                  {promedioEfectivasDia.toFixed(1)}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Meta: {META_EFECTIVAS_DIA}/día</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">Top 5 Efectivas</p>
                <div className="space-y-2">
                  {brigadas.slice(0, 5).map((b: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">{idx + 1}.</span>
                        <span className="text-[11px] text-slate-600 truncate max-w-[90px]">{b.nombre}</span>
                      </div>
                      <span className="text-xs font-semibold text-green-600">{b.efectivas}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">Top 5 kWh</p>
                <div className="space-y-2">
                  {[...brigadas].sort((a: any, b: any) => b.kwh_estimado - a.kwh_estimado).slice(0, 5).map((b: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">{idx + 1}.</span>
                        <span className="text-[11px] text-slate-600 truncate max-w-[90px]">{b.nombre}</span>
                      </div>
                      <span className="text-xs font-semibold text-cyan-600">{(b.kwh_estimado / 1000).toFixed(0)}k</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fallidas' && (
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* KPIs de VF de la ZONA */}
            <div className="col-span-3 space-y-3">
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">VF Zona {zona}</p>
                <p className="text-3xl font-bold mt-1 text-amber-600">{totalVFZona}</p>
                <p className="text-[10px] text-slate-400 mt-1">{pctVisitasFallidas.toFixed(1)}% de visitas totales</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">V. Totales</p>
                  <p className="text-lg font-bold mt-1 text-slate-800">{brigadas.reduce((a: number, b: any) => a + b.visitas_totales, 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">V. Efectivas</p>
                  <p className="text-lg font-bold mt-1 text-green-600">{brigadas.reduce((a: number, b: any) => a + b.visitas_efectivas, 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Resumen brigadas */}
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Resumen Brigadas</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Brigadas con VF alto (&gt;{Math.round(totalVFZona / brigadas.length)})</span>
                    <span className="text-sm font-bold text-amber-600">{brigadasVF.filter(b => b.vf > (totalVFZona / brigadas.length)).length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Brigadas sin VF</span>
                    <span className="text-sm font-bold text-green-600">{brigadasVF.filter(b => b.vf === 0).length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Promedio VF/brigada</span>
                    <span className="text-sm font-bold text-slate-700">{(totalVFZona / brigadas.length).toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico barras horizontales - VF por Brigada de la zona */}
            <div className="col-span-5 bg-white rounded-lg p-4 border border-slate-200 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Visitas Fallidas por Brigada - {zona}</p>
                <span className="text-[10px] text-slate-400">{brigadas.length} brigadas</span>
              </div>
              <div className="flex-1 min-h-0">
                <ReactECharts
                  option={{
                    tooltip: {
                      trigger: 'axis',
                      axisPointer: { type: 'shadow' },
                      formatter: (params: any) => {
                        const b = brigadasVF.find(x => x.nombre.split(' ').slice(0, 2).join(' ') === params[0].name);
                        const pct = b ? (totalVFZona > 0 ? ((b.vf / totalVFZona) * 100).toFixed(1) : '0') : '0';
                        return `<b>${params[0].name}</b><br/>VF: ${params[0].value}<br/>% del total: ${pct}%`;
                      }
                    },
                    grid: { left: '3%', right: '15%', top: '3%', bottom: '3%', containLabel: true },
                    xAxis: {
                      type: 'value',
                      axisLabel: { fontSize: 10, color: '#64748b' },
                      splitLine: { lineStyle: { color: '#f1f5f9' } },
                    },
                    yAxis: {
                      type: 'category',
                      data: brigadasVF.slice(0, 10).map(b => b.nombre.split(' ').slice(0, 2).join(' ')).reverse(),
                      axisLabel: { fontSize: 9, color: '#475569' },
                      axisLine: { show: false },
                      axisTick: { show: false },
                    },
                    series: [{
                      type: 'bar',
                      data: brigadasVF.slice(0, 10).map(b => ({
                        value: b.vf,
                        itemStyle: {
                          color: b.vf > (totalVFZona / brigadas.length) ? '#f59e0b' : '#94a3b8',
                          borderRadius: [0, 4, 4, 0]
                        },
                      })).reverse(),
                      barWidth: '60%',
                      label: {
                        show: true,
                        position: 'right',
                        fontSize: 10,
                        color: '#475569',
                        formatter: (params: any) => {
                          const pct = totalVFZona > 0 ? ((params.value / totalVFZona) * 100).toFixed(0) : 0;
                          return `${params.value} (${pct}%)`;
                        },
                      },
                    }]
                  }}
                  style={{ height: '100%' }}
                />
              </div>
            </div>

            {/* Pareto de Causas VF */}
            <div className="col-span-4 bg-white rounded-lg p-4 border border-slate-200 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Causas de VF - {zona}</p>
                <span className="text-[10px] text-slate-400">Top 10</span>
              </div>
              <div className="flex-1 min-h-0">
                {paretoVFChart ? (
                  <ReactECharts option={paretoVFChart} style={{ height: '100%' }} />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    Sin datos de causas disponibles
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'brigadas' && (
          <div className="h-full bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Detalle Completo por Brigada</p>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 text-left font-semibold">Brigada</th>
                    <th className="px-2 py-2 text-center font-semibold">Días</th>
                    <th className="px-2 py-2 text-center font-semibold">Acumulado</th>
                    <th className="px-2 py-2 text-center font-semibold">E/día</th>
                    <th className="px-2 py-2 text-center font-semibold">CNR</th>
                    <th className="px-2 py-2 text-center font-semibold">CNR/día</th>
                    <th className="px-2 py-2 text-center font-semibold">kWh</th>
                    <th className="px-2 py-2 text-center font-semibold">VF</th>
                    <th className="px-2 py-2 text-center font-semibold">Proyección</th>
                    <th className="px-3 py-2 text-center font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {brigadas.map((b: any, idx: number) => (
                    <tr key={idx} className={`border-b border-slate-100 hover:bg-slate-50/50 ${
                      b.estado === 'no_alcanzara' ? 'bg-red-50/30' :
                      b.estado === 'en_camino' ? 'bg-amber-50/30' : ''
                    }`}>
                      <td className="px-3 py-2.5 font-medium text-slate-700">{b.nombre}</td>
                      <td className="px-2 py-2.5 text-center text-slate-500">{b.dias_trabajados}</td>
                      <td className="px-2 py-2.5 text-center font-semibold text-slate-800">{b.efectivas}</td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={b.promedio_efectivas >= META_EFECTIVAS_DIA ? 'text-green-600 font-semibold' : 'text-red-500'}>
                          {b.promedio_efectivas.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center text-oca-blue font-semibold">{b.cnr}</td>
                      <td className="px-2 py-2.5 text-center text-slate-600">{b.promedio_cnr.toFixed(1)}</td>
                      <td className="px-2 py-2.5 text-center text-cyan-600">{(b.kwh_estimado / 1000).toFixed(0)}k</td>
                      <td className="px-2 py-2.5 text-center text-amber-600">{b.visita_fallida || 0}</td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={`font-semibold ${b.proyeccion >= META_EFECTIVAS_MES ? 'text-green-600' : 'text-red-500'}`}>
                          {b.proyeccion}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                          b.estado === 'cumplida' ? 'bg-green-100 text-green-700' :
                          b.estado === 'en_camino' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-600'
                        }`}>
                          {b.estado === 'cumplida' ? 'CUMPLIDA' : b.estado === 'en_camino' ? 'EN CAMINO' : 'NO ALCANZA'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SlideVisitasFallidas({ data }: { data: DashboardData }) {
  const chartOption = useMemo(() => ({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: '#64748b', fontSize: 10 } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, color: '#64748b', fontSize: 10 },
      data: data.visitas_fallidas_responsabilidad.map((r, idx) => ({
        value: r.total,
        name: r.descripcion,
        itemStyle: { color: ['#294D6D', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][idx % 6] }
      }))
    }]
  }), [data.visitas_fallidas_responsabilidad]);

  const totalCGE = data.visitas_fallidas_responsabilidad.reduce((a, r) => a + r.responsabilidad_cge, 0);
  const totalContratista = data.visitas_fallidas_responsabilidad.reduce((a, r) => a + r.responsabilidad_contratista, 0);

  return (
    <div className="h-full bg-white p-8">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Análisis de Visitas Fallidas</h2>

      <div className="grid grid-cols-12 gap-6 h-[calc(100%-60px)]">
        {/* KPIs */}
        <div className="col-span-3 space-y-4">
          <div className="bg-amber-50 rounded-lg p-5 border border-amber-200">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Total Visitas Fallidas</p>
            <p className="text-3xl font-bold mt-2 text-amber-600">{data.kpis.total_visita_fallida.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-2">{data.kpis.pct_visita_fallida.toFixed(1)}% del total</p>
          </div>

          <div className="bg-red-50 rounded-lg p-5 border border-red-200">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Responsabilidad CGE</p>
            <p className="text-2xl font-bold mt-2 text-red-500">{totalCGE.toLocaleString()}</p>
          </div>

          <div className="bg-amber-50 rounded-lg p-5 border border-amber-200">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Responsabilidad Contratista</p>
            <p className="text-2xl font-bold mt-2 text-amber-600">{totalContratista.toLocaleString()}</p>
          </div>
        </div>

        {/* Gráfico */}
        <div className="col-span-5 bg-white rounded-lg p-5 border border-slate-200">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-4">Distribución por Resultado</p>
          <div className="h-[calc(100%-40px)]">
            <ReactECharts option={chartOption} style={{ height: '100%' }} />
          </div>
        </div>

        {/* Tabla */}
        <div className="col-span-4 bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Detalle por Tipo</p>
          </div>
          <div className="overflow-auto h-[calc(100%-45px)]">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 text-left font-semibold">Resultado</th>
                  <th className="px-2 py-2 text-center font-semibold">Total</th>
                  <th className="px-2 py-2 text-center font-semibold">CGE</th>
                  <th className="px-2 py-2 text-center font-semibold">Contr.</th>
                </tr>
              </thead>
              <tbody>
                {data.visitas_fallidas_responsabilidad.map((r, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-slate-600 truncate max-w-[120px]" title={r.descripcion}>{r.descripcion}</td>
                    <td className="px-2 py-2 text-center font-semibold text-slate-800">{r.total}</td>
                    <td className="px-2 py-2 text-center text-red-500">{r.responsabilidad_cge}</td>
                    <td className="px-2 py-2 text-center text-amber-600">{r.responsabilidad_contratista}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideKWH({ data, zonas }: { data: DashboardData; zonas: any[] }) {
  const chartOption = useMemo(() => ({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: zonas.map(z => z.zona),
      axisLabel: { color: '#64748b', fontSize: 10, rotate: 30 },
      axisLine: { lineStyle: { color: '#e2e8f0' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => (v / 1000) + 'k' },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
    },
    series: [{
      type: 'bar',
      data: zonas.map(z => z.totalKWH),
      itemStyle: {
        color: '#0891b2',
        borderRadius: [4, 4, 0, 0]
      },
      barMaxWidth: 40
    }]
  }), [zonas]);

  // Top 5 técnicos por kWh
  const topTecnicos = [...data.tecnicos]
    .sort((a, b) => b.kwh_estimado - a.kwh_estimado)
    .slice(0, 5);

  return (
    <div className="h-full bg-white p-8">
      <h2 className="text-xl font-bold text-slate-800 mb-6">kWh Recuperado</h2>

      <div className="grid grid-cols-12 gap-6 h-[calc(100%-60px)]">
        {/* KPIs */}
        <div className="col-span-3 space-y-4">
          <div className="bg-cyan-50 rounded-lg p-6 border border-cyan-200">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Total kWh Recuperado</p>
            <p className="text-4xl font-bold mt-3 text-cyan-600">{(data.kpis.kwh_recuperado / 1000).toFixed(0)}k</p>
            <p className="text-xs text-slate-500 mt-2">{data.kpis.kwh_recuperado.toLocaleString()} kWh</p>
          </div>

          <div className="bg-white rounded-lg p-5 border border-slate-200">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-4">Top 5 Técnicos</p>
            <div className="space-y-3">
              {topTecnicos.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{idx + 1}.</span>
                    <span className="text-xs text-slate-600 truncate max-w-[120px]" title={t.nombre}>{t.nombre}</span>
                  </div>
                  <span className="text-xs font-semibold text-cyan-600">{(t.kwh_estimado / 1000).toFixed(0)}k</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gráfico */}
        <div className="col-span-9 bg-white rounded-lg p-5 border border-slate-200">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-4">kWh por Zona</p>
          <div className="h-[calc(100%-40px)]">
            <ReactECharts option={chartOption} style={{ height: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
