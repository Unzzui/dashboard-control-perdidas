'use client';

import ReactECharts from 'echarts-for-react';

interface DonutChartProps {
  data: { name: string; value: number }[];
  title?: string;
  colors?: string[];
}

export default function DonutChart({ data, title, colors }: DonutChartProps) {
  const defaultColors = ['#294D6D', '#4A7BA7', '#F97316', '#DE473C', '#10B981'];
  const chartColors = colors || defaultColors;

  const total = data.reduce((acc, item) => acc + item.value, 0);

  const option = {
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
        return `${params.name}: ${params.value.toLocaleString('es-CL')} (${params.percent.toFixed(2)}%)`;
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
        },
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
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: '280px', width: '100%' }}
      notMerge={true}
    />
  );
}
