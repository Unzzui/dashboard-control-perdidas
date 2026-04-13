'use client';

import { Filters, FilterOptions } from '@/types';
import MultiSelect from './MultiSelect';

interface FilterBarProps {
  filters: Filters;
  options: FilterOptions;
  onChange: (filters: Filters) => void;
}

export default function FilterBar({ filters, options, onChange }: FilterBarProps) {
  const handleSingleChange = (key: keyof Filters, value: string | number | null) => {
    onChange({
      ...filters,
      [key]: value === '' ? null : value,
    });
  };

  const handleMultiChange = (key: keyof Filters, values: string[]) => {
    onChange({
      ...filters,
      [key]: values,
    });
  };

  const handleDiaChange = (values: string[]) => {
    onChange({
      ...filters,
      dia: values.map(v => Number(v)),
    });
  };

  const selectClass = "text-[11px] border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-oca-blue/30 focus:border-oca-blue/40";

  // Contar filtros activos
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

  const clearAllFilters = () => {
    onChange({
      ...filters,
      mes: [],
      dia: [],
      zona: [],
      regional: [],
      supervisor: [],
      estado: [],
      tratamiento: [],
      tipo_campana: [],
      nombre_asignado: [],
    });
  };

  return (
    <div className="bg-white border-b border-slate-200/80">
      <div className="px-4 py-2">
        <div className="flex flex-wrap items-end gap-2">
          {/* Año - Select simple */}
          <FilterSelect
            label="Año"
            value={filters.año || ''}
            onChange={(v) => handleSingleChange('año', v ? Number(v) : null)}
            options={options.años.map((a) => ({ value: String(a), label: String(a) }))}
            className={`${selectClass} min-w-[70px]`}
          />

          {/* Mes - MultiSelect */}
          <MultiSelect
            label="Mes"
            selected={filters.mes}
            onChange={(v) => handleMultiChange('mes', v)}
            options={options.meses.map((m) => ({ value: m, label: capitalizeFirst(m) }))}
            placeholder="Todos"
            className="min-w-[110px]"
          />

          {/* Día - MultiSelect */}
          <MultiSelect
            label="Día"
            selected={filters.dia.map(String)}
            onChange={handleDiaChange}
            options={options.dias.map((d) => ({ value: String(d), label: String(d) }))}
            placeholder="Todos"
            className="min-w-[90px]"
          />

          <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

          {/* Regional - MultiSelect */}
          <MultiSelect
            label="Regional"
            selected={filters.regional}
            onChange={(v) => handleMultiChange('regional', v)}
            options={options.regionales.map((r) => ({ value: r, label: r }))}
            placeholder="Todas"
            className="min-w-[110px]"
            disabled={options.regionales.length === 0}
          />

          {/* Zona - MultiSelect */}
          <MultiSelect
            label="Zona"
            selected={filters.zona}
            onChange={(v) => handleMultiChange('zona', v)}
            options={options.zonas.map((z) => ({ value: z, label: z }))}
            placeholder="Todas"
            className="min-w-[160px]"
            disabled={options.zonas.length === 0}
          />

          {/* Supervisor - MultiSelect */}
          <MultiSelect
            label="Supervisor"
            selected={filters.supervisor}
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
            selected={filters.estado}
            onChange={(v) => handleMultiChange('estado', v)}
            options={options.estados.map((e) => ({ value: e, label: e }))}
            placeholder="Todos"
            className="min-w-[130px]"
            disabled={options.estados.length === 0}
          />

          {/* Tratamiento - MultiSelect */}
          <MultiSelect
            label="Tratamiento"
            selected={filters.tratamiento}
            onChange={(v) => handleMultiChange('tratamiento', v)}
            options={options.tratamientos.map((t) => ({ value: t, label: t }))}
            placeholder="Todos"
            className="min-w-[110px]"
            disabled={options.tratamientos.length === 0}
          />

          {/* Campaña - MultiSelect */}
          <MultiSelect
            label="Campaña"
            selected={filters.tipo_campana}
            onChange={(v) => handleMultiChange('tipo_campana', v)}
            options={options.tipos_campana.map((t) => ({ value: t, label: t }))}
            placeholder="Todas"
            className="min-w-[140px]"
            disabled={options.tipos_campana.length === 0}
          />

          {/* Técnico - MultiSelect */}
          <MultiSelect
            label="Técnico"
            selected={filters.nombre_asignado}
            onChange={(v) => handleMultiChange('nombre_asignado', v)}
            options={options.nombres_asignados.map((n) => ({ value: n, label: n }))}
            placeholder="Todos"
            className="min-w-[160px]"
            disabled={options.nombres_asignados.length === 0}
          />

          {/* Botón limpiar filtros */}
          {activeFiltersCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-[10px] text-slate-500 hover:text-slate-700 px-2 py-1.5 hover:bg-slate-50 rounded transition-colors self-end"
            >
              Limpiar ({activeFiltersCount})
            </button>
          )}
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
