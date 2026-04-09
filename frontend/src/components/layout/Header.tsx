'use client';

import { RefreshCw } from 'lucide-react';

interface HeaderProps {
  lastUpdate: string;
  onRefresh: () => void;
  isLoading: boolean;
}

export default function Header({ lastUpdate, onRefresh, isLoading }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-14 flex items-center px-5">
      <div className="flex items-center justify-between w-full">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Control de Pérdidas</h1>
          <p className="text-[10px] text-slate-400">Panel de Control - TUSAN</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-slate-400">Última actualización</p>
            <p className="text-[11px] font-medium text-slate-600">{lastUpdate}</p>
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <div className="w-7 h-7 rounded-full bg-oca-blue flex items-center justify-center">
            <span className="text-white text-[11px] font-medium">CP</span>
          </div>
        </div>
      </div>
    </header>
  );
}
