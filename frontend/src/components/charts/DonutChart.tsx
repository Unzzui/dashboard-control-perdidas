'use client';

import { memo, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';

export interface DonutClickEvent {
  type: 'segment';
  name: string;
  value: number;
  percent: number;
}

interface DonutChartProps {
  data: { name: string; value: number }[];
  title?: string;
  colors?: string[];
  onElementClick?: (event: DonutClickEvent) => void;
}

const DonutChart = memo(function DonutChart({ data, title, colors, onElementClick }: DonutChartProps) {
  const defaultColors = ['#294D6D', '#4A7BA7', '#F97316', '#DE473C', '#10B981'];
  const chartColors = colors || defaultColors;

  const total = useMemo(() => data.reduce((acc, item) => acc + item.value, 0), [data]);

  const handleClick = useCallback((params: { name: string; value: number; percent: number }) => {
    if (!onElementClick) return;
    onElementClick({
      type: 'segment',
      name: params.name,
      value: params.value,
      percent: params.percent,
    });
  }, [onElementClick]);

  const onEvents = useMemo(() => onElementClick ? {
    click: handleClick,
  } : undefined, [handleClick, onElementClick]);

  const option = useMemo(() => ({
    title: title ? {
      text: title,
      left: 'center',
      top: 0,
      textStyle: {
        fontSize: 13,
        fontWeight: 600,
        color: '#374151',
      },
    } : undefined,
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number; percent: number }) => {
        let html = `${params.name}: ${params.value.toLocaleString('es-CL')} (${params.percent.toFixed(2)}%)`;
        if (onElementClick) {
          html += `<div style="margin-top:4px;font-size:10px;color:#6b7280;text-align:center">Click para filtrar</div>`;
        }
        return html;
      },
      backgroundColor: '#fff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
    },
    legend: {
      orient: 'horizontal',
      bottom: 0,
      textStyle: { fontSize: 11 },
      selectedMode: onElementClick ? false : true,
    },
    series: [
      {
        type: 'pie',
        radius: ['50%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          position: 'outside',
          formatter: (params: { name: string; percent: number; value: number }) => {
            const formattedValue = params.value >= 1000
              ? `${(params.value / 1000).toFixed(1)} mil`
              : params.value.toString();
            return `${formattedValue} (${params.percent.toFixed(2)}%)`;
          },
          fontSize: 10,
        },
        labelLine: {
          show: true,
          length: 10,
          length2: 15,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 12,
            fontWeight: 'bold',
          },
          itemStyle: onElementClick ? {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          } : undefined,
        },
        cursor: onElementClick ? 'pointer' : 'default',
        data: data.map((item, idx) => ({
          ...item,
          itemStyle: { color: chartColors[idx % chartColors.length] },
        })),
      },
    ],
    graphic: {
      type: 'text',
      left: 'center',
      top: '40%',
      style: {
        text: total >= 1000 ? `${(total / 1000).toFixed(1)} mil` : total.toString(),
        fontSize: 18,
        fontWeight: 'bold',
        fill: '#374151',
        textAlign: 'center',
      },
    },
  }), [data, title, chartColors, total, onElementClick]);

  return (
    <ReactECharts
      option={option}
      style={{ height: '280px', width: '100%' }}
      notMerge={true}
      onEvents={onEvents}
    />
  );
});

export default DonutChart;
