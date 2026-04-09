'use client';

import { useState, useEffect, useCallback } from 'react';
import { Filters, DetalleAvisoData } from '@/types';
import DataTable from '@/components/ui/DataTable';
import { getDetalleAviso } from '@/lib/api';

interface DetalleAvisoProps {
  filters: Filters;
}

export default function DetalleAviso({ filters }: DetalleAvisoProps) {
  const [data, setData] = useState<DetalleAvisoData | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getDetalleAviso(filters, page);
      setData(result);
    } catch (error) {
      console.error('Error fetching detalle aviso:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const columns = [
    { key: 'ID Medida', header: 'ID Medida', width: '100px' },
    { key: 'Aviso', header: 'Aviso', width: '130px' },
    { key: 'Comuna', header: 'Comuna', width: '130px' },
    { key: 'Unidad de lectura', header: 'Unidad de lectura', width: '120px' },
    { key: 'Porción', header: 'Porcion', width: '100px' },
    { key: 'Descripción del aviso', header: 'Campana', width: '250px' },
    { key: 'Resultado visita', header: 'Resultado', width: '120px' },
    { key: 'Nombre asignado', header: 'Tecnico', width: '200px' },
    { key: 'zona', header: 'Zona', width: '180px' },
    { key: 'Estado', header: 'Estado', width: '160px' },
    { key: 'Fecha ejecución', header: 'Fecha', width: '100px' },
    { key: 'Dirección Servicio', header: 'Direccion', width: '200px' },
  ];

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oca-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Campanas por Comuna */}
      {data?.campanas_comuna && data.campanas_comuna.length > 0 && (
        <div className="card">
          <h3 className="section-title mb-3">Campanas por Comuna</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {data.campanas_comuna.slice(0, 12).map((c) => (
              <div key={c.comuna} className="bg-slate-50 rounded px-3 py-2 text-center">
                <p className="text-[10px] text-slate-400 truncate">{c.comuna}</p>
                <p className="text-sm font-semibold text-slate-700">{c.cantidad.toLocaleString('es-CL')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">Detalle Aviso</h3>
          {data && (
            <p className="text-[10px] text-slate-400">
              {((page - 1) * data.page_size + 1).toLocaleString('es-CL')} - {Math.min(page * data.page_size, data.total).toLocaleString('es-CL')} de {data.total.toLocaleString('es-CL')} registros
            </p>
          )}
        </div>
        {data && (
          <>
            <div className="overflow-x-auto">
              <DataTable columns={columns} data={data.registros} />
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="px-3 py-1.5 text-[11px] font-medium rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-[11px] text-slate-500">
                Pagina {page} de {data.total_pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                disabled={page >= data.total_pages || isLoading}
                className="px-3 py-1.5 text-[11px] font-medium rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
