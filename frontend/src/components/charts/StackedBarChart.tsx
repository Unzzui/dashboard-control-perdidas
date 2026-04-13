'use client';

import { memo, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { DailyStats } from '@/types';

export interface ChartClickEvent {
  type: 'day' | 'series';
  value: string | number;
  seriesName?: string;
  data?: DailyStats;
}

interface StackedBarChartProps {
  data: DailyStats[];
  title?: string;
  height?: string;
  onElementClick?: (event: ChartClickEvent) => void;
}

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

const StackedBarChart = memo(function StackedBarChart({
  data,
  title,
  height = '300px',
  onElementClick
}: StackedBarChartProps) {
  const labels = useMemo(() => data.map((d) => formatDate(d.fecha, d.dia)), [data]);

  const handleClick = useCallback((params: { dataIndex: number; seriesName: string }) => {
    if (!onElementClick) return;

    const clickedData = data[params.dataIndex];
    if (clickedData) {
      onElementClick({
        type: 'day',
        value: clickedData.dia,
        seriesName: params.seriesName,
        data: clickedData,
      });
    }
  }, [data, onElementClick]);

  const onEvents = useMemo(() => onElementClick ? {
    click: handleClick,
  } : undefined, [handleClick, onElementClick]);

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
        if (onElementClick) {
          html += `<div style="margin-top:4px;font-size:10px;color:#6b7280;text-align:center">Click para filtrar por este día</div>`;
        }
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
      triggerEvent: true,
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
        cursor: onElementClick ? 'pointer' : 'default',
        emphasis: onElementClick ? {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
        } : undefined,
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
        cursor: onElementClick ? 'pointer' : 'default',
        emphasis: onElementClick ? {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
        } : undefined,
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
        cursor: onElementClick ? 'pointer' : 'default',
        emphasis: onElementClick ? {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
        } : undefined,
      },
    ],
  }), [data, title, labels, onElementClick]);

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      notMerge={true}
      onEvents={onEvents}
    />
  );
});

export default StackedBarChart;
