'use client';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  className?: string;
}

const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  className = ''
}: DataTableProps<T>) {
  const getNestedValue = (obj: T, path: string): unknown => {
    return path.split('.').reduce((acc: unknown, part) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                style={{ width: col.width }}
                className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80 ${alignClass[col.align || 'left']}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
