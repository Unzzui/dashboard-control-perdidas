'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Column<T = any> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  sortable?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  className?: string;
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  /** Key del campo que identifica filas fijas (ej: 'zona' para detectar 'Total') */
  stickyRowKey?: keyof T | string;
  /** Valores que identifican filas fijas que no se ordenan (ej: ['Total', 'TOTAL']) */
  stickyRowValues?: string[];
  /** Función para asignar clases CSS a filas según su contenido */
  rowClassName?: (row: T) => string;
  /** Desactivar ordenamiento para tablas jerárquicas */
  disableSort?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;

const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  className = '',
  defaultSort,
  stickyRowKey,
  stickyRowValues = ['Total', 'TOTAL', 'total', 'Totales', 'TOTALES'],
  rowClassName,
  disableSort = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key || null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort?.direction || null);

  const getNestedValue = (obj: T, path: string): unknown => {
    return path.split('.').reduce((acc: unknown, part) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
  };

  const handleSort = (key: string, sortable?: boolean) => {
    if (sortable === false) return;

    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortKey(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Detectar automáticamente la primera columna como key para filas fijas si no se especifica
  const effectiveStickyKey = stickyRowKey || (columns.length > 0 ? String(columns[0].key) : null);

  const isStickyRow = (row: T): boolean => {
    if (!effectiveStickyKey) return false;
    const value = getNestedValue(row, String(effectiveStickyKey));
    if (typeof value === 'string') {
      return stickyRowValues.some(v => value.toLowerCase().includes(v.toLowerCase()));
    }
    return false;
  };

  const { sortedData, stickyRows } = useMemo(() => {
    // Separar filas normales de filas fijas (Total)
    const normalRows: T[] = [];
    const sticky: T[] = [];

    data.forEach(row => {
      if (isStickyRow(row)) {
        sticky.push(row);
      } else {
        normalRows.push(row);
      }
    });

    // Ordenar solo las filas normales
    if (!sortKey || !sortDirection) {
      return { sortedData: normalRows, stickyRows: sticky };
    }

    const sorted = [...normalRows].sort((a, b) => {
      const aVal = getNestedValue(a, sortKey);
      const bVal = getNestedValue(b, sortKey);

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      }
      return bStr.localeCompare(aStr);
    });

    return { sortedData: sorted, stickyRows: sticky };
  }, [data, sortKey, sortDirection]);

  const renderSortIcon = (key: string, sortable?: boolean) => {
    if (sortable === false) return null;

    const isActive = sortKey === key;

    if (!isActive) {
      return <ChevronsUpDown size={12} className="text-slate-300" />;
    }

    if (sortDirection === 'asc') {
      return <ChevronUp size={12} className="text-oca-blue" />;
    }

    if (sortDirection === 'desc') {
      return <ChevronDown size={12} className="text-oca-blue" />;
    }

    return <ChevronsUpDown size={12} className="text-slate-300" />;
  };

  // Combinar datos ordenados con filas fijas al final
  const finalData = [...sortedData, ...stickyRows];

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((col) => {
              const isSortable = !disableSort && col.sortable !== false;
              return (
                <th
                  key={String(col.key)}
                  style={{ width: col.width }}
                  onClick={() => handleSort(String(col.key), col.sortable)}
                  className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80 ${alignClass[col.align || 'left']} ${isSortable ? 'cursor-pointer hover:bg-slate-100 select-none' : ''}`}
                >
                  <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                    <span>{col.header}</span>
                    {renderSortIcon(String(col.key), col.sortable)}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {finalData.map((row, idx) => {
            const isSticky = isStickyRow(row);
            const customClass = rowClassName ? rowClassName(row) : '';
            return (
              <tr
                key={idx}
                className={`border-b transition-colors ${
                  isSticky
                    ? 'border-slate-200 bg-slate-100 font-semibold'
                    : 'border-slate-50 hover:bg-slate-50/80'
                } ${customClass}`}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={`px-3 py-2 text-[11px] text-slate-600 ${alignClass[col.align || 'left']}`}
                  >
                    {col.render
                      ? col.render(row)
                      : String(getNestedValue(row, String(col.key)) ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
