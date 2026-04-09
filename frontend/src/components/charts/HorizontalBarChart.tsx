'use client';

import { memo, useMemo } from 'react';
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

const HorizontalBarChart = memo(function HorizontalBarChart({
  data,
  title,
  valueLabel = 'Valor',
  metaLabel = 'Meta',
  color = '#294D6D',
  metaColor = '#F97316',
}: HorizontalBarChartProps) {
  const { categories, values, metas, hasMeta } = useMemo(() => ({
    categories: data.map((d) => d.name),
    values: data.map((d) => d.value),
    metas: data.map((d) => d.meta || 0),
    hasMeta: data.some((d) => d.meta !== undefined),
  }), [data]);

  // Formatear números grandes
  const formatValue = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString('es-CL')}`;
  };

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
      formatter: (params: Array<{ seriesName: string; value: number; marker: string; name: string }>) => {
        if (!params.length) return '';
        let html = `<div style="font-weight:600;margin-bottom:4px">${params[0].name}</div>`;
        params.forEach((p) => {
          html += `<div>${p.marker} ${p.seriesName}: <b>${formatValue(p.value)}</b></div>`;
        });
        return html;
      },
    },
    legend: hasMeta ? {
      data: [valueLabel, metaLabel],
      bottom: 0,
      textStyle: { fontSize: 11 },
    } : undefined,
    grid: {
      left: '3%',
      right: '12%',
      bottom: hasMeta ? '15%' : '5%',
      top: title ? '15%' : '5%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      axisLabel: {
        fontSize: 10,
        formatter: (value: number) => formatValue(value),
      },
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        fontSize: 9,
        width: 120,
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
          fontSize: 9,
          color: '#374151',
          formatter: (params: { value: number }) => formatValue(params.value),
        },
        barWidth: hasMeta ? '35%' : '50%',
      },
      ...(hasMeta ? [{
        name: metaLabel,
        type: 'bar',
        data: metas,
        itemStyle: { color: metaColor },
        label: {
          show: false,
        },
        barWidth: '35%',
      }] : []),
    ],
  }), [title, categories, values, metas, hasMeta, valueLabel, metaLabel, color, metaColor]);

  const chartHeight = useMemo(() => Math.max(300, data.length * 25), [data.length]);

  return (
    <ReactECharts
      option={option}
      style={{ height: `${chartHeight}px`, width: '100%' }}
      notMerge={true}
    />
  );
});

export default HorizontalBarChart;
