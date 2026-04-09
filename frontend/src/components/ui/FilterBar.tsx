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

  const selectClass = "text-[11px] border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-oca-blue/30 focus:border-oca-blue/40";

  return (
    <div className="bg-white border-b border-slate-200 px-5 py-2.5">
      <div className="flex flex-wrap items-end gap-2.5">
        {/* Año - Select simple */}
        <FilterSelect
          label="Año"
          value={filters.año || ''}
          onChange={(v) => handleSingleChange('año', v ? Number(v) : null)}
          options={options.años.map((a) => ({ value: String(a), label: String(a) }))}
          className={`${selectClass} min-w-[72px]`}
        />

        {/* Mes - MultiSelect */}
        <MultiSelect
          label="Mes"
          selected={filters.mes}
          onChange={(v) => handleMultiChange('mes', v)}
          options={options.meses.map((m) => ({ value: m, label: m }))}
          placeholder="Todos"
          className="min-w-[120px]"
        />

        {/* Día - Select simple */}
        <FilterSelect
          label="Día"
          value={filters.dia || ''}
          onChange={(v) => handleSingleChange('dia', v ? Number(v) : null)}
          options={options.dias.map((d) => ({ value: String(d), label: String(d) }))}
          className={`${selectClass} min-w-[64px]`}
        />

        {/* Regional - MultiSelect */}
        <MultiSelect
          label="Regional"
          selected={filters.regional}
          onChange={(v) => handleMultiChange('regional', v)}
          options={options.regionales.map((r) => ({ value: r, label: r }))}
          placeholder="Todas"
          className="min-w-[120px]"
        />

        {/* Zona - MultiSelect */}
        <MultiSelect
          label="Zona"
          selected={filters.zona}
          onChange={(v) => handleMultiChange('zona', v)}
          options={options.zonas.map((z) => ({ value: z, label: z }))}
          placeholder="Todas"
          className="min-w-[180px]"
        />

        {/* Supervisor - MultiSelect */}
        <MultiSelect
          label="Supervisor"
          selected={filters.supervisor}
          onChange={(v) => handleMultiChange('supervisor', v)}
          options={options.supervisores.map((s) => ({ value: s, label: s }))}
          placeholder="Todos"
          className="min-w-[140px]"
        />

        {/* Estado - MultiSelect */}
        <MultiSelect
          label="Estado"
          selected={filters.estado}
          onChange={(v) => handleMultiChange('estado', v)}
          options={options.estados.map((e) => ({ value: e, label: e }))}
          placeholder="Todos"
          className="min-w-[150px]"
        />

        {/* Tratamiento - MultiSelect */}
        <MultiSelect
          label="Tratamiento"
          selected={filters.tratamiento}
          onChange={(v) => handleMultiChange('tratamiento', v)}
          options={options.tratamientos.map((t) => ({ value: t, label: t }))}
          placeholder="Todos"
          className="min-w-[120px]"
        />

        {/* Campaña - MultiSelect */}
        <MultiSelect
          label="Campaña"
          selected={filters.tipo_campana}
          onChange={(v) => handleMultiChange('tipo_campana', v)}
          options={options.tipos_campana.map((t) => ({ value: t, label: t }))}
          placeholder="Todas"
          className="min-w-[160px]"
        />

        {/* Nombre asignado - MultiSelect */}
        <MultiSelect
          label="Técnico"
          selected={filters.nombre_asignado}
          onChange={(v) => handleMultiChange('nombre_asignado', v)}
          options={options.nombres_asignados.slice(0, 100).map((n) => ({ value: n, label: n }))}
          placeholder="Todos"
          className="min-w-[180px]"
        />
      </div>
    </div>
  );
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
