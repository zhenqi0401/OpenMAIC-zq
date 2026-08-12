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

/**
 * G2 对 area/line 等系列图形调用 style 函数时，第一个参数是该系列
 * 的全部数据点数组（seriesIndex 对应的 abstractData 切片），而非单条数据。
 * 这里兼容两种情况，取第一条记录的系列名。
 */
export function seriesNameOf(datum: unknown): string | undefined {
  const first = Array.isArray(datum) ? datum[0] : datum;
  return (first as { series?: string } | undefined)?.series;
}

/** 将 #rrggbb 转为 rgba 字符串（canvas 渐变 stop 用，避免 8 位 hex 解析问题） */
function hexToRgba(hex: string, opacity: number): string {
  const value = hex.replace('#', '');
  return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${opacity})`;
}

/**
 * 按周期控制横轴刻度密度：
 * - 周：每天一个刻度（数据本身 7 天）
 * - 月：每三天一个刻度（1、4、7、…）
 * - 年：每月一个刻度（数据本身 12 个月）
 */
export function buildTickFilter(range: AdminActivityRange) {
  return (tick: unknown) => {
    if (range !== 'month') return true;
    const text = String(tick);
    // 仅对完整日期（YYYY-MM-DD）做密度过滤；非日期标签（如空数据的"暂无数据"）保持显示
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return true;
    const day = Number(text.slice(8, 10));
    return day % 3 === 1;
  };
}

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

  // 周期切换后数据点数量变化，渲染时钳制聚焦索引避免越界
  const safeKeyboardIndex = Math.min(keyboardIndex, points.length - 1);

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
        aria-valuenow={safeKeyboardIndex}
        aria-valuetext={
          points[safeKeyboardIndex]
            ? `${points[safeKeyboardIndex].date}：总互动 ${points[safeKeyboardIndex].interactions}，帖子 ${points[safeKeyboardIndex].posts}，回复 ${points[safeKeyboardIndex].replies}，弹幕 ${points[safeKeyboardIndex].danmaku}`
            : undefined
        }
        className="mt-4 h-72 w-full rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus-ring)]/30"
        data-admin-activity-chart-canvas
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const nextIndex = Math.max(
            0,
            Math.min(safeKeyboardIndex + (event.key === 'ArrowRight' ? 1 : -1), points.length - 1),
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
              // 标签始终水平排布（labelAlign 为 @antv/component 的正确配置，
              // 旧代码的 label.align 无效导致日期被旋转）
              labelAlign: 'horizontal',
              // 标签重叠时隐藏（正确属性名为 labelOverlap，位于轴配置顶层）
              labelOverlap: [{ type: 'hide' }],
              line: true,
              lineStroke: 'var(--admin-border)',
              tick: false,
              // 周/月/年按需求控制刻度密度
              tickFilter: buildTickFilter(range),
            },
            y: {
              title: false,
              labelFill: CHART_TEXT_COLOR,
              // 数值标签保持水平，与横坐标平行
              labelAlign: 'horizontal',
              // 去掉横向网格虚线
              grid: false,
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
          // 图表内不渲染图例：上方统计区已有图例与配色
          legend={false}
          line={{
            // 平滑折线，颜色严格按上方图例（ACTIVITY_SERIES）配色
            style: {
              shape: 'smooth',
              stroke: (datum: unknown) =>
                SERIES_COLOR[seriesNameOf(datum) ?? ''] ?? CHART_TEXT_COLOR,
              lineWidth: 2,
            },
          }}
          point={{
            size: 4,
            style: {
              stroke: (datum: unknown) =>
                SERIES_COLOR[seriesNameOf(datum) ?? ''] ?? CHART_TEXT_COLOR,
              fill: adminBrandTokens['--saas-surface-lowest'],
            },
          }}
          scale={{
            color: {
              range: ACTIVITY_SERIES.map((item) => item.color),
            },
            y: {
              // 纵坐标随数据自动扩展
              nice: true,
            },
          }}
          style={{
            // 仅总互动绘制面积，且渐变从上往下由实色渐浅。
            // g-lite 的角度为数学约定（0°=向右、90°=向下），故 90deg 表示从上到下。
            shape: 'smooth',
            fill: (datum: unknown) => {
              const series = seriesNameOf(datum);
              if (series !== '总互动') return 'transparent';
              const color = SERIES_COLOR[series] ?? CHART_TEXT_COLOR;
              return `linear-gradient(90deg, ${color} 0%, ${hexToRgba(color, 0)} 100%)`;
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
