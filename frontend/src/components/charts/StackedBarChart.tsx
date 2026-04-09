'use client';

import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { DailyStats } from '@/types';

interface StackedBarChartProps {
  data: DailyStats[];
  title?: string;
  height?: string;
}

// Formatear fecha para mostrar día/mes
function formatDate(fecha: string, dia: number): string {
  if (fecha) {
    try {
      const date = new Date(fecha);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      return `${day}/${month}`;
    } catch {
      return String(dia);
    }
  }
  return String(dia);
}

const StackedBarChart = memo(function StackedBarChart({ data, title, height = '300px' }: StackedBarChartProps) {
  const labels = useMemo(() => data.map((d) => formatDate(d.fecha, d.dia)), [data]);

  const option = useMemo(() => ({
    title: title ? {
      text: title,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 600,
        color: '#374151',
      },
    } : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#fff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
      formatter: (params: Array<{ seriesName: string; value: number; axisValue: string; color: string }>) => {
        if (!params.length) return '';
        const date = params[0].axisValue;
        let html = `<div style="font-weight:600;margin-bottom:4px">${date}</div>`;
        let total = 0;
        params.forEach((p) => {
          total += p.value || 0;
          html += `<div style="display:flex;justify-content:space-between;gap:12px">
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></span>${p.seriesName}</span>
            <span style="font-weight:500">${(p.value || 0).toLocaleString('es-CL')}</span>
          </div>`;
        });
        html += `<div style="border-top:1px solid #e5e7eb;margin-top:4px;padding-top:4px;display:flex;justify-content:space-between">
          <span style="font-weight:600">Total</span>
          <span style="font-weight:600">${total.toLocaleString('es-CL')}</span>
        </div>`;
        return html;
      },
    },
    legend: {
      data: ['CNR', 'NORMAL', 'VISITA FALLIDA'],
      bottom: 0,
      textStyle: { fontSize: 11 },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: title ? '15%' : '5%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        fontSize: 10,
        rotate: data.length > 15 ? 45 : 0,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10 },
    },
    series: [
      {
        name: 'CNR',
        type: 'bar',
        stack: 'total',
        data: data.map((d) => d.cnr),
        itemStyle: { color: '#294D6D' },
        label: {
          show: data.length <= 10,
          position: 'inside',
          fontSize: 10,
          color: '#fff',
        },
      },
      {
        name: 'NORMAL',
        type: 'bar',
        stack: 'total',
        data: data.map((d) => d.normal),
        itemStyle: { color: '#4A7BA7' },
        label: {
          show: data.length <= 10,
          position: 'inside',
          fontSize: 10,
          color: '#fff',
        },
      },
      {
        name: 'VISITA FALLIDA',
        type: 'bar',
        stack: 'total',
        data: data.map((d) => d.visita_fallida),
        itemStyle: { color: '#F97316' },
        label: {
          show: data.length <= 10,
          position: 'inside',
          fontSize: 10,
          color: '#fff',
        },
      },
    ],
  }), [data, title, labels]);

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      notMerge={true}
    />
  );
});

export default StackedBarChart;
