'use client';

import { memo, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';

export interface LineChartClickEvent {
  type: 'point';
  label: string;
  seriesName: string;
  value: number;
  dataIndex: number;
}

interface LineChartProps {
  data: {
    labels: string[];
    series: {
      name: string;
      data: number[];
      color?: string;
    }[];
  };
  title?: string;
  yAxisFormat?: 'percent' | 'number';
  onElementClick?: (event: LineChartClickEvent) => void;
}

const LineChart = memo(function LineChart({
  data,
  title,
  yAxisFormat = 'percent',
  onElementClick
}: LineChartProps) {
  const defaultColors = ['#294D6D', '#4A7BA7', '#F97316', '#DE473C', '#10B981'];

  const handleClick = useCallback((params: { name: string; seriesName: string; value: number; dataIndex: number }) => {
    if (!onElementClick) return;
    onElementClick({
      type: 'point',
      label: params.name,
      seriesName: params.seriesName,
      value: params.value,
      dataIndex: params.dataIndex,
    });
  }, [onElementClick]);

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
      backgroundColor: '#fff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
      formatter: (params: Array<{ seriesName: string; value: number; marker: string; axisValue?: string }>) => {
        let result = `<div class="font-medium">${params[0]?.axisValue || ''}</div>`;
        params.forEach((param) => {
          const value = yAxisFormat === 'percent'
            ? `${param.value.toFixed(2)}%`
            : param.value.toLocaleString('es-CL');
          result += `<div>${param.marker} ${param.seriesName}: ${value}</div>`;
        });
        if (onElementClick) {
          result += `<div style="margin-top:4px;font-size:10px;color:#6b7280;text-align:center">Click para filtrar por mes</div>`;
        }
        return result;
      },
    },
    legend: {
      data: data.series.map((s) => s.name),
      bottom: 0,
      textStyle: { fontSize: 11 },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: title ? '15%' : '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.labels,
      boundaryGap: false,
      axisLabel: { fontSize: 10 },
      triggerEvent: true,
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontSize: 10,
        formatter: yAxisFormat === 'percent' ? '{value} %' : '{value}',
      },
    },
    series: data.series.map((s, idx) => ({
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: true,
      symbol: 'circle',
      symbolSize: onElementClick ? 8 : 6,
      lineStyle: {
        width: 2,
        color: s.color || defaultColors[idx % defaultColors.length],
      },
      itemStyle: {
        color: s.color || defaultColors[idx % defaultColors.length],
      },
      cursor: onElementClick ? 'pointer' : 'default',
      emphasis: onElementClick ? {
        scale: true,
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
        },
      } : undefined,
    })),
  }), [data, title, yAxisFormat, onElementClick, defaultColors]);

  return (
    <ReactECharts
      option={option}
      style={{ height: '300px', width: '100%' }}
      notMerge={true}
      onEvents={onEvents}
    />
  );
});

export default LineChart;
