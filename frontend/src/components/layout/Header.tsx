'use client';

import { RefreshCw } from 'lucide-react';

interface HeaderProps {
  lastUpdate: string;
  onRefresh: () => void;
  isLoading: boolean;
}

export default function Header({ lastUpdate, onRefresh, isLoading }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Logo OCA */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-oca-blue">OCA</span>
            <span className="text-lg text-gray-400 font-light">GLOBAL</span>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Control de Pérdidas</h1>
            <p className="text-xs text-gray-500">Panel de Control - TUSAN</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-500">Última actualización</p>
            <p className="text-sm font-medium text-gray-700">{lastUpdate}</p>
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
}
