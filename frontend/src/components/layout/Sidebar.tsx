'use client';

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
  Search
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  { id: 'indicadores', label: 'Indicadores Generales', icon: LayoutDashboard },
  { id: 'delegacion', label: 'Resultados por Delegación', icon: BarChart3 },
  { id: 'ranking', label: 'Ranking CNR / Efectivas', icon: Users },
  { id: 'efectividad', label: 'Efectividad Mensual', icon: TrendingUp },
  { id: 'visitas-fallidas', label: 'Visitas Fallidas', icon: AlertTriangle },
  { id: 'normalizaciones', label: 'Normalizaciones', icon: Wrench },
  { id: 'produccion', label: 'Producción Mensual', icon: DollarSign },
  { id: 'kwh', label: 'Control kWh Recuperado', icon: FileBarChart },
  { id: 'retiro-medidores', label: 'Retiro Medidores', icon: Package },
  { id: 'detalle-aviso', label: 'Detalle Aviso', icon: Search },
  { id: 'mapa', label: 'Mapa Operaciones', icon: Map },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-40 w-56 h-screen bg-oca-blue flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center px-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-lg">OCA</span>
          <span className="text-white/50 font-light text-sm">GLOBAL</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10">
        <p className="text-[10px] text-white/40 text-center">Control de Pérdidas v1.0</p>
      </div>
    </aside>
  );
}
