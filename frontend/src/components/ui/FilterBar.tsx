'use client';

import { Filters, FilterOptions } from '@/types';

interface FilterBarProps {
  filters: Filters;
  options: FilterOptions;
  onChange: (filters: Filters) => void;
}

export default function FilterBar({ filters, options, onChange }: FilterBarProps) {
  const handleChange = (key: keyof Filters, value: string | number | null) => {
    onChange({
      ...filters,
      [key]: value === '' ? null : value,
    });
  };

  const selectClass = "text-[11px] border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-oca-blue/30 focus:border-oca-blue/40";

  return (
    <div className="bg-white border-b border-slate-200 px-5 py-2.5">
      <div className="flex flex-wrap items-end gap-2.5">
        <FilterSelect
          label="Año"
          value={filters.año || ''}
          onChange={(v) => handleChange('año', v ? Number(v) : null)}
          options={options.años.map((a) => ({ value: String(a), label: String(a) }))}
          className={`${selectClass} min-w-[72px]`}
        />
        <FilterSelect
          label="Mes"
          value={filters.mes || ''}
          onChange={(v) => handleChange('mes', v || null)}
          options={options.meses.map((m) => ({ value: m, label: m }))}
          className={`${selectClass} min-w-[96px]`}
        />
        <FilterSelect
          label="Día"
          value={filters.dia || ''}
          onChange={(v) => handleChange('dia', v ? Number(v) : null)}
          options={options.dias.map((d) => ({ value: String(d), label: String(d) }))}
          className={`${selectClass} min-w-[64px]`}
        />
        <FilterSelect
          label="Regional"
          value={filters.regional || ''}
          onChange={(v) => handleChange('regional', v || null)}
          options={options.regionales.map((r) => ({ value: r, label: r }))}
          className={`${selectClass} min-w-[96px]`}
        />
        <FilterSelect
          label="Zona"
          value={filters.zona || ''}
          onChange={(v) => handleChange('zona', v || null)}
          options={options.zonas.map((z) => ({ value: z, label: z }))}
          placeholder="Todas las zonas"
          className={`${selectClass} min-w-[170px]`}
        />
        <FilterSelect
          label="Supervisor"
          value={filters.supervisor || ''}
          onChange={(v) => handleChange('supervisor', v || null)}
          options={options.supervisores.map((s) => ({ value: s, label: s }))}
          className={`${selectClass} min-w-[130px]`}
        />
        <FilterSelect
          label="Estado"
          value={filters.estado || ''}
          onChange={(v) => handleChange('estado', v || null)}
          options={options.estados.map((e) => ({ value: e, label: e }))}
          className={`${selectClass} min-w-[150px]`}
        />
        <FilterSelect
          label="Tratamiento"
          value={filters.tratamiento || ''}
          onChange={(v) => handleChange('tratamiento', v || null)}
          options={options.tratamientos.map((t) => ({ value: t, label: t }))}
          className={`${selectClass} min-w-[110px]`}
        />
        <FilterSelect
          label="Campaña"
          value={filters.tipo_campana || ''}
          onChange={(v) => handleChange('tipo_campana', v || null)}
          options={options.tipos_campana.map((t) => ({ value: t, label: t }))}
          className={`${selectClass} min-w-[150px]`}
        />
        <FilterSelect
          label="Nombre asignado"
          value={filters.nombre_asignado || ''}
          onChange={(v) => handleChange('nombre_asignado', v || null)}
          options={options.nombres_asignados.slice(0, 50).map((n) => ({ value: n, label: n }))}
          className={`${selectClass} min-w-[170px]`}
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
  placeholder = 'Todas',
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
