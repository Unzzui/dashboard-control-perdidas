'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'red' | 'orange' | 'gray';
}

const valueColors = {
  blue: 'text-oca-blue',
  green: 'text-green-700',
  red: 'text-red-700',
  orange: 'text-amber-600',
  gray: 'text-slate-900',
};

const trendColors = {
  up: 'text-green-700',
  down: 'text-red-700',
  neutral: 'text-slate-400',
};

export default function KPICard({ title, value, subtitle, trend, color = 'blue' }: KPICardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{title}</p>
      <div className="flex items-end gap-2 mt-1">
        <p className={`text-2xl font-bold ${valueColors[color]}`}>
          {typeof value === 'number' ? value.toLocaleString('es-CL') : value}
        </p>
        {trend && trend !== 'neutral' && (
          <span className={`flex items-center pb-0.5 ${trendColors[trend]}`}>
            {trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}
