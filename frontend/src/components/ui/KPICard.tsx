'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'red' | 'orange' | 'gray';
}

const colorClasses = {
  blue: 'text-oca-blue',
  green: 'text-green-600',
  red: 'text-oca-red',
  orange: 'text-orange-500',
  gray: 'text-gray-600',
};

export default function KPICard({ title, value, subtitle, trend, color = 'blue' }: KPICardProps) {
  return (
    <div className="stat-card">
      <p className="kpi-label">{title}</p>
      <div className="flex items-end gap-2 mt-1">
        <p className={`text-2xl font-bold ${colorClasses[color]}`}>
          {typeof value === 'number' ? value.toLocaleString('es-CL') : value}
        </p>
        {trend && trend !== 'neutral' && (
          <span className={`flex items-center ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
            {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
