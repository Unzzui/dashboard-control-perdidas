'use client';

import ReactECharts from 'echarts-for-react';

interface HorizontalBarChartProps {
  data: {
    name: string;
    value: number;
    meta?: number;
  }[];
  title?: string;
  valueLabel?: string;
  metaLabel?: string;
  color?: string;
  metaColor?: string;
}

export default function HorizontalBarChart({
  data,
  title,
  valueLabel = 'Valor',
  metaLabel = 'Meta',
  color = '#294D6D',
  metaColor = '#F97316',
}: HorizontalBarChartProps) {
  const categories = data.map((d) => d.name);
  const values = data.map((d) => d.value);
  const metas = data.map((d) => d.meta || 0);
  const hasMeta = data.some((d) => d.meta !== undefined);

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
    legend: hasMeta ? {
      data: [valueLabel, metaLabel],
      bottom: 0,
      textStyle: { fontSize: 11 },
    } : undefined,
    grid: {
      left: '3%',
      right: '10%',
      bottom: hasMeta ? '15%' : '5%',
      top: title ? '15%' : '5%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        fontSize: 9,
        width: 150,
        overflow: 'truncate',
      },
      inverse: true,
    },
    series: [
      {
        name: valueLabel,
        type: 'bar',
        data: values,
        itemStyle: { color },
        label: {
          show: true,
          position: 'right',
          fontSize: 10,
          color: '#374151',
        },
        barWidth: hasMeta ? '40%' : '60%',
      },
      ...(hasMeta ? [{
        name: metaLabel,
        type: 'bar',
        data: metas,
        itemStyle: { color: metaColor },
        label: {
          show: true,
          position: 'right',
          fontSize: 10,
          color: '#374151',
        },
        barWidth: '40%',
      }] : []),
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: `${Math.max(300, data.length * 25)}px`, width: '100%' }}
      notMerge={true}
    />
  );
}
