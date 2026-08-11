'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { AriaComponent, GridComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { Segmented } from 'antd';
import { AdminCard } from '@/components/admin/AdminSurface';
import type { AdminDashboard } from '@/lib/admin/client';

echarts.use([LineChart, AriaComponent, GridComponent, TooltipComponent, SVGRenderer]);

export type AdminActivityRange = 'week' | 'month' | 'year';
type CommunityActivity = AdminDashboard['communityActivity'];
type ActivityPoint = CommunityActivity['points'][number];
type ActivityKey = keyof CommunityActivity['totals'];

const ACTIVITY_SERIES = [
  { key: 'interactions', label: '总互动', color: 'var(--admin-chart-interactions)' },
  { key: 'posts', label: '帖子', color: 'var(--admin-chart-posts)' },
  { key: 'replies', label: '回复', color: 'var(--admin-chart-replies)' },
  { key: 'danmaku', label: '弹幕', color: 'var(--admin-chart-danmaku)' },
] as const satisfies ReadonlyArray<{ key: ActivityKey; label: string; color: string }>;

const EMPTY_POINT: ActivityPoint = {
  date: '暂无数据',
  interactions: 0,
  posts: 0,
  replies: 0,
  danmaku: 0,
};

function activityAreaGradient() {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: 'var(--admin-chart-interactions-fill)' },
      { offset: 0.68, color: 'var(--admin-chart-interactions-fill-soft)' },
      { offset: 1, color: 'var(--admin-chart-interactions-fill-transparent)' },
    ],
  };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ??
      character,
  );
}

export function formatActivityTooltip(point: ActivityPoint): string {
  const values = ACTIVITY_SERIES.map(
    (item) =>
      `<div style="display:flex;align-items:center;justify-content:space-between;gap:24px;margin-top:6px"><span><i style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${item.color};margin-right:8px"></i>${item.label}</span><strong>${point[item.key]}</strong></div>`,
  ).join('');
  return `<div style="min-width:156px"><strong>${escapeHtml(point.date)}</strong>${values}</div>`;
}

export function buildAdminActivityChartOption(
  activity: CommunityActivity,
): echarts.EChartsCoreOption {
  const points = activity.points.length ? activity.points : [EMPTY_POINT];
  return {
    // SVG gradient paths can throw inside zrender's array interpolator when a
    // highlighted series is replaced during a period switch. The admin chart
    // prioritizes stable, immediate data updates over transition animation.
    animation: false,
    aria: {
      enabled: true,
      decal: { show: false },
      description:
        '社区活跃趋势图，包含总互动、帖子、回复和弹幕四项真实数据。可使用左右方向键查看各日期精确值。',
    },
    grid: { top: 18, right: 18, bottom: 12, left: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      triggerOn: 'mousemove|click',
      confine: true,
      axisPointer: {
        type: 'line',
        snap: true,
        lineStyle: { color: 'var(--admin-border)', width: 1 },
      },
      backgroundColor: 'var(--admin-surface)',
      borderColor: 'var(--admin-border)',
      borderWidth: 1,
      textStyle: { color: 'var(--admin-foreground)', fontSize: 12 },
      formatter: (params: unknown) => {
        const entries = Array.isArray(params) ? params : [params];
        const first = entries[0] as { dataIndex?: number } | undefined;
        return formatActivityTooltip(points[first?.dataIndex ?? 0] ?? points[0]);
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map((point) => point.date),
      axisLine: { lineStyle: { color: 'var(--admin-border)' } },
      axisTick: { show: false },
      axisLabel: {
        color: 'var(--admin-muted-foreground)',
        fontSize: 11,
        hideOverlap: true,
        margin: 12,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      minInterval: 1,
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: 'var(--admin-muted-foreground)',
        fontSize: 11,
        formatter: (value: number) =>
          value >= 10_000
            ? `${Number((value / 10_000).toFixed(1))}万`
            : value >= 1_000
              ? `${Number((value / 1_000).toFixed(1))}k`
              : String(value),
      },
      splitLine: {
        lineStyle: { color: 'var(--admin-border-subtle)', type: 'dashed' },
      },
    },
    series: ACTIVITY_SERIES.map((item, index) => ({
      name: item.label,
      type: 'line',
      data: points.map((point) => point[item.key]),
      symbol: 'circle',
      symbolSize: index === 0 ? 7 : 5,
      showSymbol: false,
      smooth: 0.25,
      lineStyle: {
        color: item.color,
        width: index === 0 ? 3 : 1.75,
        opacity: index === 0 ? 1 : 0.78,
      },
      itemStyle: {
        color: item.color,
        borderColor: 'var(--admin-surface)',
        borderWidth: 1.5,
      },
      emphasis: {
        focus: 'series',
        blurScope: 'coordinateSystem',
        lineStyle: {
          color: item.color,
          width: index === 0 ? 4 : 2.75,
          opacity: 1,
        },
        itemStyle: { color: item.color, opacity: 1 },
        areaStyle: index === 0 ? { color: activityAreaGradient(), opacity: 1 } : undefined,
      },
      blur: {
        lineStyle: { color: item.color, opacity: 0.16 },
        itemStyle: { color: item.color, opacity: 0.16 },
        areaStyle: index === 0 ? { color: activityAreaGradient(), opacity: 0.08 } : undefined,
      },
      areaStyle:
        index === 0
          ? {
              opacity: 1,
              color: activityAreaGradient(),
            }
          : undefined,
    })),
  };
}

export function AdminActivityChart({
  activity,
  loading,
  onRangeChange,
  range,
}: {
  activity: CommunityActivity;
  loading: boolean;
  onRangeChange: (range: AdminActivityRange) => void;
  range: AdminActivityRange;
}) {
  const chartElementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [keyboardIndex, setKeyboardIndex] = useState(0);
  const option = useMemo(() => buildAdminActivityChartOption(activity), [activity]);

  useEffect(() => {
    if (!chartElementRef.current) return;
    const chart = echarts.init(chartElementRef.current, null, { renderer: 'svg' });
    chartRef.current = chart;
    chart.setOption(option, true);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(chartElementRef.current);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
    // The chart is initialized once; the next effect owns option updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
    setKeyboardIndex((current) => Math.min(current, Math.max(0, activity.points.length - 1)));
  }, [activity.points.length, option]);

  function showKeyboardPoint(index: number) {
    const pointCount = Math.max(1, activity.points.length);
    const nextIndex = Math.max(0, Math.min(index, pointCount - 1));
    chartRef.current?.dispatchAction({
      type: 'updateAxisPointer',
      seriesIndex: 0,
      dataIndex: nextIndex,
    });
    setKeyboardIndex(nextIndex);
  }

  function focusLegendSeries(seriesIndex: number) {
    const chart = chartRef.current;
    if (!chart) return;
    chart.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' });
    chart.dispatchAction({ type: 'hideTip' });
    chart.dispatchAction({ type: 'downplay' });
    chart.dispatchAction({ type: 'highlight', seriesIndex });
  }

  function clearLegendSeries() {
    chartRef.current?.dispatchAction({ type: 'downplay' });
  }

  function clearChartPoint() {
    const chart = chartRef.current;
    if (!chart) return;
    chart.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' });
    chart.dispatchAction({ type: 'hideTip' });
  }

  return (
    <AdminCard className="min-w-0 p-5 sm:p-6" data-admin-community-chart>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">社区活跃趋势</h2>
          <p className="mt-1 text-sm text-[var(--admin-muted-foreground)]">
            真实帖子、回复和弹幕聚合；关闭的功能类型不计入互动。
          </p>
        </div>
        <Segmented
          aria-label="趋势周期"
          disabled={loading}
          options={[
            { value: 'week', label: '周' },
            { value: 'month', label: '月' },
            { value: 'year', label: '年' },
          ]}
          value={range}
          onChange={(value) => onRangeChange(value as AdminActivityRange)}
        />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-y border-[var(--admin-border-subtle)] py-4 sm:grid-cols-4">
        {ACTIVITY_SERIES.map((item, index) => (
          <div
            data-admin-activity-legend={item.key}
            key={item.key}
            onMouseEnter={() => focusLegendSeries(index)}
            onMouseLeave={clearLegendSeries}
          >
            <dt className="inline-flex items-center gap-2 text-xs text-[var(--admin-muted-foreground)]">
              <i
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ background: item.color }}
              />
              {item.label}
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-[var(--admin-foreground)]">
              {activity.totals[item.key]}
            </dd>
          </div>
        ))}
      </dl>

      <div
        aria-label="社区活跃趋势图。聚焦后使用左右方向键查看数据点。"
        className="mt-4 h-72 w-full rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus-ring)]/30"
        data-admin-activity-chart-canvas
        onBlur={clearChartPoint}
        onFocus={() => showKeyboardPoint(keyboardIndex)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          showKeyboardPoint(keyboardIndex + (event.key === 'ArrowRight' ? 1 : -1));
        }}
        ref={chartElementRef}
        role="img"
        tabIndex={0}
      />
    </AdminCard>
  );
}
