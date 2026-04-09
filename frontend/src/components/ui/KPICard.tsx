'use client';

import { memo } from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'blue' | 'green' | 'red' | 'orange' | 'gray';
}

const valueColors = {
  blue: 'text-oca-blue',
  green: 'text-green-700',
  red: 'text-red-700',
  orange: 'text-amber-600',
  gray: 'text-slate-900',
};

const KPICard = memo(function KPICard({ title, value, subtitle, color = 'blue' }: KPICardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200/60 shadow-sm px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${valueColors[color]}`}>
        {typeof value === 'number' ? value.toLocaleString('es-CL') : value}
      </p>
      {subtitle && (
        <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
      )}
    </div>
  );
});

export default KPICard;
