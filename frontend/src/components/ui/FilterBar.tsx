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

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex flex-wrap gap-3">
        {/* Año */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Año</label>
          <select
            value={filters.año || ''}
            onChange={(e) => handleChange('año', e.target.value ? Number(e.target.value) : null)}
            className="filter-select min-w-[80px]"
          >
            <option value="">Todas</option>
            {options.años.map((año) => (
              <option key={año} value={año}>{año}</option>
            ))}
          </select>
        </div>

        {/* Mes */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Mes</label>
          <select
            value={filters.mes || ''}
            onChange={(e) => handleChange('mes', e.target.value || null)}
            className="filter-select min-w-[100px]"
          >
            <option value="">Todas</option>
            {options.meses.map((mes) => (
              <option key={mes} value={mes}>{mes}</option>
            ))}
          </select>
        </div>

        {/* Día */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Día</label>
          <select
            value={filters.dia || ''}
            onChange={(e) => handleChange('dia', e.target.value ? Number(e.target.value) : null)}
            className="filter-select min-w-[70px]"
          >
            <option value="">Todas</option>
            {options.dias.map((dia) => (
              <option key={dia} value={dia}>{dia}</option>
            ))}
          </select>
        </div>

        {/* Regional */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Regional</label>
          <select
            value={filters.regional || ''}
            onChange={(e) => handleChange('regional', e.target.value || null)}
            className="filter-select min-w-[100px]"
          >
            <option value="">Todas</option>
            {options.regionales.map((regional) => (
              <option key={regional} value={regional}>{regional}</option>
            ))}
          </select>
        </div>

        {/* Zona */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Zona</label>
          <select
            value={filters.zona || ''}
            onChange={(e) => handleChange('zona', e.target.value || null)}
            className="filter-select min-w-[180px]"
          >
            <option value="">Selección múltiple...</option>
            {options.zonas.map((zona) => (
              <option key={zona} value={zona}>{zona}</option>
            ))}
          </select>
        </div>

        {/* Supervisor */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Supervisor</label>
          <select
            value={filters.supervisor || ''}
            onChange={(e) => handleChange('supervisor', e.target.value || null)}
            className="filter-select min-w-[140px]"
          >
            <option value="">Todas</option>
            {options.supervisores.map((sup) => (
              <option key={sup} value={sup}>{sup}</option>
            ))}
          </select>
        </div>

        {/* Estado */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Estado</label>
          <select
            value={filters.estado || ''}
            onChange={(e) => handleChange('estado', e.target.value || null)}
            className="filter-select min-w-[160px]"
          >
            <option value="">Selección múltiple...</option>
            {options.estados.map((estado) => (
              <option key={estado} value={estado}>{estado}</option>
            ))}
          </select>
        </div>

        {/* Tratamiento */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Tratamiento</label>
          <select
            value={filters.tratamiento || ''}
            onChange={(e) => handleChange('tratamiento', e.target.value || null)}
            className="filter-select min-w-[120px]"
          >
            <option value="">Todas</option>
            {options.tratamientos.map((trat) => (
              <option key={trat} value={trat}>{trat}</option>
            ))}
          </select>
        </div>

        {/* Tipo de Campaña */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Campaña</label>
          <select
            value={filters.tipo_campana || ''}
            onChange={(e) => handleChange('tipo_campana', e.target.value || null)}
            className="filter-select min-w-[160px]"
          >
            <option value="">Todas</option>
            {options.tipos_campana.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </div>

        {/* Nombre Asignado */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Nombre asignado</label>
          <select
            value={filters.nombre_asignado || ''}
            onChange={(e) => handleChange('nombre_asignado', e.target.value || null)}
            className="filter-select min-w-[180px]"
          >
            <option value="">Todas</option>
            {options.nombres_asignados.slice(0, 50).map((nombre) => (
              <option key={nombre} value={nombre}>{nombre}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
