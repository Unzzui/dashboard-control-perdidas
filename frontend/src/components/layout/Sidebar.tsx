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
  FileBarChart
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
  { id: 'mapa', label: 'Mapa Operaciones', icon: Map },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
      <nav className="p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-oca-blue text-white'
                  : 'text-gray-600 hover:bg-oca-blue-lighter hover:text-oca-blue'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
