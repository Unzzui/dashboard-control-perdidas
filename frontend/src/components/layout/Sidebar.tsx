'use client';

import Image from 'next/image';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  TrendingUp,
  AlertTriangle,
  Wrench,
  DollarSign,
  Map,
  FileBarChart,
  Package,
  Search,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/contexts/SidebarContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    title: 'Operación Diaria',
    items: [
      { id: 'control-diario', label: 'Control Diario', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Indicadores',
    items: [
      { id: 'indicadores', label: 'Indicadores Generales', icon: LayoutDashboard },
      { id: 'delegacion', label: 'Resultados por Delegación', icon: BarChart3 },
      { id: 'ranking', label: 'Ranking CNR / Efectivas', icon: Users },
    ],
  },
  {
    title: 'Análisis',
    items: [
      { id: 'efectividad', label: 'Efectividad Mensual', icon: TrendingUp },
      { id: 'produccion', label: 'Producción Mensual', icon: DollarSign },
      { id: 'kwh', label: 'Control kWh Recuperado', icon: FileBarChart },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { id: 'visitas-fallidas', label: 'Visitas Fallidas', icon: AlertTriangle },
      { id: 'normalizaciones', label: 'Normalizaciones', icon: Wrench },
      { id: 'retiro-medidores', label: 'Retiro Medidores', icon: Package },
    ],
  },
  {
    title: 'Herramientas',
    items: [
      { id: 'detalle-aviso', label: 'Detalle Aviso', icon: Search },
      { id: 'mapa', label: 'Mapa Operaciones', icon: Map },
    ],
  },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { isNormal, toggleCollapse } = useSidebar();
  const isExpanded = isNormal;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-oca-blue flex flex-col transition-all duration-300 ease-in-out',
        isExpanded ? 'w-56' : 'w-14'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'h-14 flex items-center border-b border-white/10',
          isExpanded ? 'justify-between px-3' : 'justify-center'
        )}
      >
        {isExpanded && (
          <Image
            src="/logo_horizontal.svg"
            alt="OCA"
            width={120}
            height={40}
            className="h-10 w-auto"
          />
        )}
        <button
          onClick={toggleCollapse}
          className="rounded p-1.5 transition-colors text-white/60 hover:bg-white/10 hover:text-white"
          title={isExpanded ? 'Contraer' : 'Expandir'}
        >
          {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-4">
          {menuSections.map((section, sectionIdx) => (
            <div key={section.title}>
              {/* Section title */}
              {isExpanded && (
                <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {section.title}
                </p>
              )}
              {!isExpanded && sectionIdx > 0 && (
                <div className="mx-2 mb-2 border-t border-white/10" />
              )}

              {/* Section items */}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors duration-150',
                        isActive
                          ? 'bg-white/15 text-white'
                          : 'text-white/70 hover:bg-white/10 hover:text-white',
                        !isExpanded && 'justify-center px-0'
                      )}
                      title={item.label}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {isExpanded && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10">
        {isExpanded && (
          <p className="text-[10px] text-white/40 text-center">Control de Pérdidas v1.0</p>
        )}
      </div>
    </aside>
  );
}
