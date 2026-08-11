'use client';

import { useMemo, useState } from 'react';
import { Area } from '@ant-design/charts';
import { Segmented } from 'antd';
import { AdminCard } from '@/components/admin/AdminSurface';
import { adminBrandTokens } from '@/components/admin/admin-theme';
import type { AdminDashboard } from '@/lib/admin/client';

export type AdminActivityRange = 'week' | 'month' | 'year';
type CommunityActivity = AdminDashboard['communityActivity'];
type ActivityPoint = CommunityActivity['points'][number];
type ActivityKey = keyof CommunityActivity['totals'];

// 图表走 canvas 渲染，无法解析 var() —— 使用品牌原始色值保证线色稳定
const CHART_TEXT_COLOR = adminBrandTokens['--saas-on-surface-variant'];
const ACTIVITY_SERIES = [
  {
    key: 'interactions',
    label: '总互动',
    color: adminBrandTokens['--saas-chart-interactions'],
  },
  { key: 'posts', label: '帖子', color: adminBrandTokens['--saas-primary-container'] },
  { key: 'replies', label: '回复', color: adminBrandTokens['--saas-success'] },
  { key: 'danmaku', label: '弹幕', color: adminBrandTokens['--saas-danger'] },
] as const satisfies ReadonlyArray<{ key: ActivityKey; label: string; color: string }>;

const SERIES_COLOR: Record<string, string> = Object.fromEntries(
  ACTIVITY_SERIES.map((item) => [item.label, item.color]),
);

const EMPTY_POINT: ActivityPoint = {
  date: '暂无数据',
  interactions: 0,
  posts: 0,
  replies: 0,
  danmaku: 0,
};

export function formatActivityTooltip(point: ActivityPoint): string {
  const values = ACTIVITY_SERIES.map(
    (item) =>
      `<div style="display:flex;align-items:center;justify-content:space-between;gap:24px;margin-top:6px"><span><i style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${item.color};margin-right:8px"></i>${item.label}</span><strong>${point[item.key]}</strong></div>`,
  ).join('');
  return `<div style="min-width:156px"><strong>${point.date}</strong>${values}</div>`;
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
  const [keyboardIndex, setKeyboardIndex] = useState(0);
  const points = useMemo(
    () => (activity.points.length ? activity.points : [EMPTY_POINT]),
    [activity.points],
  );

  const data = useMemo(
    () =>
      points.flatMap((point) =>
        ACTIVITY_SERIES.map((item) => ({
          date: point.date,
          series: item.label,
          value: point[item.key],
        })),
      ),
    [points],
  );

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
        {ACTIVITY_SERIES.map((item) => (
          <div data-admin-activity-legend={item.key} key={item.key}>
            <dt className="inline-flex items-center gap-2 text-sm font-medium text-[var(--admin-foreground)]">
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
        aria-valuemax={points.length - 1}
        aria-valuemin={0}
        aria-valuenow={keyboardIndex}
        aria-valuetext={
          points[keyboardIndex]
            ? `${points[keyboardIndex].date}：总互动 ${points[keyboardIndex].interactions}，帖子 ${points[keyboardIndex].posts}，回复 ${points[keyboardIndex].replies}，弹幕 ${points[keyboardIndex].danmaku}`
            : undefined
        }
        className="mt-4 h-72 w-full rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus-ring)]/30"
        data-admin-activity-chart-canvas
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const nextIndex = Math.max(
            0,
            Math.min(keyboardIndex + (event.key === 'ArrowRight' ? 1 : -1), points.length - 1),
          );
          setKeyboardIndex(nextIndex);
        }}
        role="slider"
        tabIndex={0}
      >
        <Area
          autoFit
          axis={{
            x: {
              title: false,
              labelFill: CHART_TEXT_COLOR,
              line: true,
              lineStroke: 'var(--admin-border)',
              tick: false,
            },
            y: {
              title: false,
              labelFill: CHART_TEXT_COLOR,
              grid: true,
              gridStroke: 'var(--admin-border-subtle)',
              gridStrokeOpacity: 1,
            },
          }}
          colorField="series"
          data={data}
          height={288}
          interaction={{
            tooltip: {
              marker: false,
            },
          }}
          legend={{
            color: {
              position: 'bottom',
              label: {
                fill: CHART_TEXT_COLOR,
                fontSize: 13,
              },
            },
          }}
          line={{
            style: {
              stroke: (datum: { series?: string }) =>
                SERIES_COLOR[datum?.series ?? ''] ?? CHART_TEXT_COLOR,
              lineWidth: 2,
            },
          }}
          point={{
            size: 4,
            style: {
              stroke: (datum: { series?: string }) =>
                SERIES_COLOR[datum?.series ?? ''] ?? CHART_TEXT_COLOR,
              fill: adminBrandTokens['--saas-surface-lowest'],
            },
          }}
          scale={{
            color: {
              range: ACTIVITY_SERIES.map((item) => item.color),
            },
            y: {
              nice: true,
            },
          }}
          style={{
            fill: (datum: { series?: string }) => {
              const color = SERIES_COLOR[datum?.series ?? ''] ?? CHART_TEXT_COLOR;
              return `linear-gradient(-90deg, ${color} 0%, ${color}26 100%)`;
            },
          }}
          theme={{
            type: 'classic',
          }}
          tooltip={{
            title: 'date',
            items: [
              {
                channel: 'y',
                name: 'value',
              },
            ],
          }}
          xField="date"
          yField="value"
        />
      </div>
    </AdminCard>
  );
}
