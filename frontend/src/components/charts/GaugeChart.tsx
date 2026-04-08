'use client';

import ReactECharts from 'echarts-for-react';

interface GaugeChartProps {
  value: number;
  title: string;
  max?: number;
  target?: number;
  color?: 'blue' | 'green' | 'red' | 'orange';
}

const colorMap = {
  blue: '#294D6D',
  green: '#10B981',
  red: '#DE473C',
  orange: '#F97316',
};

export default function GaugeChart({ value, title, max = 100, target, color = 'blue' }: GaugeChartProps) {
  const mainColor = colorMap[color];

  const option = {
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: max,
        splitNumber: 4,
        itemStyle: {
          color: mainColor,
        },
        progress: {
          show: true,
          width: 20,
        },
        pointer: {
          show: false,
        },
        axisLine: {
          lineStyle: {
            width: 20,
            color: [[1, '#E5E7EB']],
          },
        },
        axisTick: {
          show: false,
        },
        splitLine: {
          show: false,
        },
        axisLabel: {
          distance: 30,
          fontSize: 10,
          color: '#9CA3AF',
          formatter: (value: number) => `${value.toFixed(0)} %`,
        },
        anchor: {
          show: false,
        },
        title: {
          show: true,
          offsetCenter: [0, '30%'],
          fontSize: 11,
          color: '#6B7280',
        },
        detail: {
          valueAnimation: true,
          width: '60%',
          lineHeight: 30,
          borderRadius: 8,
          offsetCenter: [0, '-10%'],
          fontSize: 24,
          fontWeight: 'bold',
          formatter: '{value} %',
          color: mainColor,
        },
        data: [
          {
            value: value,
            name: title,
          },
        ],
      },
    ],
  };

  // Add target line if provided
  if (target !== undefined) {
    const targetAngle = 200 - ((target / max) * 220);
    option.series.push({
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: max,
      itemStyle: { color: 'transparent' },
      progress: { show: false },
      pointer: {
        show: true,
        length: '90%',
        width: 2,
        itemStyle: { color: '#9CA3AF' },
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: { show: false },
      title: { show: false },
      data: [{ value: target }],
    } as never);
  }

  return (
    <div className="text-center">
      <ReactECharts
        option={option}
        style={{ height: '180px', width: '100%' }}
        notMerge={true}
      />
      {target !== undefined && (
        <p className="text-xs text-gray-500 -mt-2">Meta: {target}%</p>
      )}
    </div>
  );
}
