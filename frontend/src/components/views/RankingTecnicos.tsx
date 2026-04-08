'use client';

import { TecnicoRanking } from '@/types';
import DataTable from '@/components/ui/DataTable';
import HorizontalBarChart from '@/components/charts/HorizontalBarChart';

interface RankingTecnicosProps {
  tecnicos: TecnicoRanking[];
}

export default function RankingTecnicos({ tecnicos }: RankingTecnicosProps) {
  // Group by zona
  const byZona = tecnicos.reduce((acc, t) => {
    if (!acc[t.zona]) acc[t.zona] = [];
    acc[t.zona].push(t);
    return acc;
  }, {} as Record<string, TecnicoRanking[]>);

  const columns = [
    { key: 'nombre', header: 'Nombre', width: '220px' },
    {
      key: 'cnr',
      header: 'CNR',
      align: 'right' as const,
      render: (row: TecnicoRanking) => row.cnr.toLocaleString('es-CL'),
    },
    {
      key: 'promedio_cnr',
      header: 'PROMEDIO CNR',
      align: 'right' as const,
      render: (row: TecnicoRanking) => row.promedio_cnr.toFixed(2),
    },
    {
      key: 'efectivas',
      header: 'EFECTIVAS',
      align: 'right' as const,
      render: (row: TecnicoRanking) => row.efectivas.toLocaleString('es-CL'),
    },
    {
      key: 'promedio_efectivas',
      header: 'PROMEDIO EFECTIVAS',
      align: 'right' as const,
      render: (row: TecnicoRanking) => row.promedio_efectivas.toFixed(2),
    },
    {
      key: 'status_cnr',
      header: '',
      align: 'center' as const,
      render: (row: TecnicoRanking) => (
        row.promedio_cnr >= 40 ? (
          <span className="text-green-500">✓</span>
        ) : (
          <span className="text-red-500">✗</span>
        )
      ),
    },
    {
      key: 'status_efectivas',
      header: '',
      align: 'center' as const,
      render: (row: TecnicoRanking) => (
        row.promedio_efectivas >= 160 ? (
          <span className="text-green-500">✓</span>
        ) : (
          <span className="text-red-500">✗</span>
        )
      ),
    },
  ];

  // Prepare ranking data sorted by CNR
  const rankingCNR = [...tecnicos]
    .sort((a, b) => b.cnr - a.cnr)
    .slice(0, 20)
    .map((t) => ({
      name: t.nombre.length > 30 ? t.nombre.substring(0, 30) + '...' : t.nombre,
      value: t.cnr,
      meta: 40,
    }));

  const rankingEfectivas = [...tecnicos]
    .sort((a, b) => b.efectivas - a.efectivas)
    .slice(0, 20)
    .map((t) => ({
      name: t.nombre.length > 30 ? t.nombre.substring(0, 30) + '...' : t.nombre,
      value: t.efectivas,
      meta: 160,
    }));

  return (
    <div className="space-y-6">
      {/* Rankings Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Ranking CNR</h3>
          <HorizontalBarChart
            data={rankingCNR}
            valueLabel="CNR"
            metaLabel="CNR META"
            color="#294D6D"
            metaColor="#F97316"
          />
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Ranking Efectivas</h3>
          <HorizontalBarChart
            data={rankingEfectivas}
            valueLabel="EFECTIVAS"
            metaLabel="EFECTIVAS META"
            color="#294D6D"
            metaColor="#F97316"
          />
        </div>
      </div>

      {/* Table by Zone */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Detalle por Zona</h3>
        <div className="max-h-[500px] overflow-y-auto">
          {Object.entries(byZona).map(([zona, tecnicosZona]) => (
            <div key={zona} className="mb-6">
              <h4 className="text-xs font-semibold text-oca-blue uppercase mb-2 bg-oca-blue-lighter px-3 py-2 rounded">
                {zona}
              </h4>
              <DataTable columns={columns} data={tecnicosZona} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
