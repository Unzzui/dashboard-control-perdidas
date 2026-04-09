'use client';

import { memo, useMemo } from 'react';
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

const GaugeChart = memo(function GaugeChart({ value, title, max = 100, target, color = 'blue' }: GaugeChartProps) {
  const mainColor = colorMap[color];

  const option = useMemo(() => ({
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        center: ['50%', '60%'],
        radius: '90%',
        min: 0,
        max: max,
        splitNumber: 4,
        itemStyle: {
          color: mainColor,
        },
        progress: {
          show: true,
          width: 12,
          roundCap: true,
        },
        pointer: {
          show: false,
        },
        axisLine: {
          lineStyle: {
            width: 12,
            color: [[1, '#F1F5F9']],
            cap: 'round',
          },
        },
        axisTick: {
          show: false,
        },
        splitLine: {
          show: false,
        },
        axisLabel: {
          show: false,
        },
        anchor: {
          show: false,
        },
        title: {
          show: false,
        },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '-5%'],
          fontSize: 18,
          fontWeight: 'bold',
          fontFamily: 'Inter, system-ui, sans-serif',
          formatter: (val: number) => `${val.toFixed(1)}%`,
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
  }), [value, title, max, mainColor]);

  return (
    <div className="text-center">
      <ReactECharts
        option={option}
        style={{ height: '130px', width: '100%' }}
        notMerge={true}
      />
      <div className="-mt-2">
        <div className="flex items-center justify-center gap-4 text-[9px] text-slate-400">
          <span>0%</span>
          <span className="text-[10px] font-medium text-slate-500">{title}</span>
          <span>{max}%</span>
        </div>
        {target !== undefined && (
          <p className="text-[9px] text-slate-400 mt-0.5">Meta: {target}%</p>
        )}
      </div>
    </div>
  );
});

export default GaugeChart;
