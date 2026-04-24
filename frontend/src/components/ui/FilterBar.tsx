'use client';

import { useEffect, useMemo, useState } from 'react';
import { Filters, FilterOptions } from '@/types';
import MultiSelect from './MultiSelect';

interface FilterBarProps {
  filters: Filters;
  options: FilterOptions;
  onChange: (filters: Filters) => void;
}

// Compara dos objetos Filters de forma shallow (los arrays por contenido)
function filtersEqual(a: Filters, b: Filters): boolean {
  if (a.año !== b.año) return false;
  const arrayKeys: Array<keyof Filters> = [
    'mes', 'dia', 'zona', 'regional', 'supervisor',
    'estado', 'tratamiento', 'tipo_campana', 'nombre_asignado',
  ];
  for (const k of arrayKeys) {
    const av = a[k] as unknown[];
    const bv = b[k] as unknown[];
    if (av.length !== bv.length) return false;
    for (let i = 0; i < av.length; i++) {
      if (av[i] !== bv[i]) return false;
    }
  }
  return true;
}

export default function FilterBar({ filters, options, onChange }: FilterBarProps) {
  // Estado local del "borrador" — cambios pendientes sin aplicar
  const [draft, setDraft] = useState<Filters>(filters);

  // Si filters cambia externamente (p. ej. click en KPI desde una vista),
  // sincronizar el borrador al estado aplicado.
  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const hasPendingChanges = useMemo(() => !filtersEqual(draft, filters), [draft, filters]);

  const handleSingleChange = (key: keyof Filters, value: string | number | null) => {
    setDraft((prev) => ({
      ...prev,
      [key]: value === '' ? null : value,
    }));
  };

  const handleMultiChange = (key: keyof Filters, values: string[]) => {
    setDraft((prev) => ({
      ...prev,
      [key]: values,
    }));
  };

  const handleDiaChange = (values: string[]) => {
    setDraft((prev) => ({
      ...prev,
      dia: values.map((v) => Number(v)),
    }));
  };

  const selectClass = "text-[11px] border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-oca-blue/30 focus:border-oca-blue/40";

  // Contar filtros activos (en el estado APLICADO, no el draft)
  const activeFiltersCount = [
    filters.mes.length > 0,
    filters.dia.length > 0,
    filters.zona.length > 0,
    filters.regional.length > 0,
    filters.supervisor.length > 0,
    filters.estado.length > 0,
    filters.tratamiento.length > 0,
    filters.tipo_campana.length > 0,
    filters.nombre_asignado.length > 0,
  ].filter(Boolean).length;

  // "Limpiar" vacía el borrador y lo aplica de inmediato si corresponde
  const clearAllFilters = () => {
    const cleared: Filters = {
      ...draft,
      mes: [],
      dia: [],
      zona: [],
      regional: [],
      supervisor: [],
      estado: [],
      tratamiento: [],
      tipo_campana: [],
      nombre_asignado: [],
    };
    setDraft(cleared);
    onChange(cleared);
  };

  const applyFilters = () => {
    onChange(draft);
  };

  const discardChanges = () => {
    setDraft(filters);
  };

  // Atajo: Enter aplica, Escape descarta
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!hasPendingChanges) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      applyFilters();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      discardChanges();
    }
  };

  return (
    <div className="bg-white border-b border-slate-200/80" onKeyDown={handleKeyDown}>
      <div className="px-4 py-2">
        <div className="flex flex-wrap items-end gap-2">
          {/* Año - Select simple */}
          <FilterSelect
            label="Año"
            value={draft.año || ''}
            onChange={(v) => handleSingleChange('año', v ? Number(v) : null)}
            options={options.años.map((a) => ({ value: String(a), label: String(a) }))}
            className={`${selectClass} min-w-[70px]`}
          />

          {/* Mes - MultiSelect */}
          <MultiSelect
            label="Mes"
            selected={draft.mes}
            onChange={(v) => handleMultiChange('mes', v)}
            options={options.meses.map((m) => ({ value: m, label: capitalizeFirst(m) }))}
            placeholder="Todos"
            className="min-w-[110px]"
          />

          {/* Día - MultiSelect */}
          <MultiSelect
            label="Día"
            selected={draft.dia.map(String)}
            onChange={handleDiaChange}
            options={options.dias.map((d) => ({ value: String(d), label: String(d) }))}
            placeholder="Todos"
            className="min-w-[90px]"
          />

          <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

          {/* Regional - MultiSelect */}
          <MultiSelect
            label="Regional"
            selected={draft.regional}
            onChange={(v) => handleMultiChange('regional', v)}
            options={options.regionales.map((r) => ({ value: r, label: r }))}
            placeholder="Todas"
            className="min-w-[110px]"
            disabled={options.regionales.length === 0}
          />

          {/* Zona - MultiSelect */}
          <MultiSelect
            label="Zona"
            selected={draft.zona}
            onChange={(v) => handleMultiChange('zona', v)}
            options={options.zonas.map((z) => ({ value: z, label: z }))}
            placeholder="Todas"
            className="min-w-[160px]"
            disabled={options.zonas.length === 0}
          />

          {/* Supervisor - MultiSelect */}
          <MultiSelect
            label="Supervisor"
            selected={draft.supervisor}
            onChange={(v) => handleMultiChange('supervisor', v)}
            options={options.supervisores.map((s) => ({ value: s, label: s }))}
            placeholder="Todos"
            className="min-w-[130px]"
            disabled={options.supervisores.length === 0}
          />

          <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

          {/* Estado - MultiSelect */}
          <MultiSelect
            label="Estado"
            selected={draft.estado}
            onChange={(v) => handleMultiChange('estado', v)}
            options={options.estados.map((e) => ({ value: e, label: e }))}
            placeholder="Todos"
            className="min-w-[130px]"
            disabled={options.estados.length === 0}
          />

          {/* Tratamiento - MultiSelect */}
          <MultiSelect
            label="Tratamiento"
            selected={draft.tratamiento}
            onChange={(v) => handleMultiChange('tratamiento', v)}
            options={options.tratamientos.map((t) => ({ value: t, label: t }))}
            placeholder="Todos"
            className="min-w-[110px]"
            disabled={options.tratamientos.length === 0}
          />

          {/* Campaña - MultiSelect */}
          <MultiSelect
            label="Campaña"
            selected={draft.tipo_campana}
            onChange={(v) => handleMultiChange('tipo_campana', v)}
            options={options.tipos_campana.map((t) => ({ value: t, label: t }))}
            placeholder="Todas"
            className="min-w-[140px]"
            disabled={options.tipos_campana.length === 0}
          />

          {/* Técnico - MultiSelect */}
          <MultiSelect
            label="Técnico"
            selected={draft.nombre_asignado}
            onChange={(v) => handleMultiChange('nombre_asignado', v)}
            options={options.nombres_asignados.map((n) => ({ value: n, label: n }))}
            placeholder="Todos"
            className="min-w-[160px]"
            disabled={options.nombres_asignados.length === 0}
          />

          {/* Acciones: Aplicar / Descartar / Limpiar */}
          <div className="flex items-center gap-1.5 self-end ml-auto">
            {hasPendingChanges && (
              <>
                <span className="text-[10px] text-amber-600 font-medium px-1">
                  Cambios sin aplicar
                </span>
                <button
                  onClick={discardChanges}
                  className="text-[11px] px-2.5 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                  title="Descartar cambios (Esc)"
                >
                  Descartar
                </button>
              </>
            )}
            <button
              onClick={applyFilters}
              disabled={!hasPendingChanges}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded transition-colors ${
                hasPendingChanges
                  ? 'bg-oca-blue text-white hover:bg-oca-blue/90'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              title={hasPendingChanges ? 'Aplicar filtros (Enter)' : 'Sin cambios pendientes'}
            >
              Aplicar
            </button>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-[11px] text-slate-500 hover:text-slate-700 px-2.5 py-1.5 hover:bg-slate-50 rounded transition-colors"
              >
                Limpiar ({activeFiltersCount})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Todos',
  className,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[9px] font-medium uppercase tracking-wider text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
