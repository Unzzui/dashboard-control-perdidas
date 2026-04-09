'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  maxDisplay?: number;
}

export default function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Todos',
  className,
  maxDisplay = 2,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const removeItem = (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    onChange(selected.filter(v => v !== value));
  };

  const selectAll = () => {
    onChange(options.map(o => o.value));
  };

  const getDisplayText = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const opt = options.find(o => o.value === selected[0]);
      return opt?.label || selected[0];
    }
    if (selected.length <= maxDisplay) {
      return selected.map(v => {
        const opt = options.find(o => o.value === v);
        return opt?.label || v;
      }).join(', ');
    }
    return `${selected.length} seleccionados`;
  };

  return (
    <div className="flex flex-col gap-0.5" ref={containerRef}>
      <label className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex items-center justify-between gap-1 text-left',
            'text-[11px] border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700',
            'focus:outline-none focus:ring-1 focus:ring-oca-blue/30 focus:border-oca-blue/40',
            'hover:border-slate-300 transition-colors',
            selected.length > 0 && 'border-oca-blue/40 bg-oca-blue/5',
            className
          )}
        >
          <span className={cn('truncate flex-1', selected.length === 0 && 'text-slate-400')}>
            {getDisplayText()}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {selected.length > 0 && (
              <span
                onClick={clearAll}
                className="p-0.5 hover:bg-slate-200 rounded-full cursor-pointer"
              >
                <X size={12} className="text-slate-400" />
              </span>
            )}
            <ChevronDown size={14} className={cn('text-slate-400 transition-transform', isOpen && 'rotate-180')} />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white border border-slate-200 rounded-md shadow-lg">
            {/* Search */}
            <div className="p-2 border-b border-slate-100">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-oca-blue/40"
                autoFocus
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-2 py-1.5 border-b border-slate-100 text-[10px]">
              <button
                onClick={selectAll}
                className="text-oca-blue hover:underline"
              >
                Seleccionar todos
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => onChange([])}
                className="text-slate-500 hover:underline"
              >
                Limpiar
              </button>
            </div>

            {/* Options */}
            <div className="max-h-[200px] overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-2 py-3 text-[11px] text-slate-400 text-center">
                  No hay opciones
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = selected.includes(opt.value);
                  return (
                    <div
                      key={opt.value}
                      onClick={() => toggleOption(opt.value)}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 cursor-pointer text-[11px]',
                        'hover:bg-slate-50 transition-colors',
                        isSelected && 'bg-oca-blue/5'
                      )}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                          isSelected
                            ? 'bg-oca-blue border-oca-blue'
                            : 'border-slate-300'
                        )}
                      >
                        {isSelected && <Check size={12} className="text-white" />}
                      </div>
                      <span className={cn('truncate', isSelected && 'font-medium')}>
                        {opt.label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
