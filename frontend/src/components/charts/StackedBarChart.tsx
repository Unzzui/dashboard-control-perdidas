'use client';

import ReactECharts from 'echarts-for-react';
import { DailyStats } from '@/types';

interface StackedBarChartProps {
  data: DailyStats[];
  title?: string;
}

export default function StackedBarChart({ data, title }: StackedBarChartProps) {
  const option = {
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
      data: data.map((d) => d.dia),
      axisLabel: { fontSize: 10 },
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
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: '300px', width: '100%' }}
      notMerge={true}
    />
  );
}
