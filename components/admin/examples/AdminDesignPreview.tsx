import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareText,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AdminModuleId } from '@/components/admin/AdminShell';
import {
  AdminCard,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  adminInputClassName,
  adminPrimaryButtonClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';
import {
  AdminDataTable,
  AdminEntityCard,
  AdminFilterBar,
  AdminMetricCard,
} from '@/components/admin/AdminPatterns';
import { AdminSessionActions } from '@/components/admin/AdminSessionActions';

const moduleCopy: Record<AdminModuleId, { title: string; description: string }> = {
  dashboard: { title: '数据看板', description: '集中查看平台学员、课程、考核和社区运行情况' },
  courses: { title: '课程管理', description: '维护课程从草稿到发布的全流程，并管理分类与可见范围' },
  exams: { title: '考核管理', description: '管理阶段考核配置、题库准备情况和学员考核结果' },
  community: { title: '社区管理', description: '查看社区活跃情况，并统一管理帖子、回复和弹幕内容' },
  access: { title: '用户管理', description: '集中管理用户资料、角色分配和邀请码' },
};

function PreviewHeader({ module }: { module: AdminModuleId }) {
  const copy = moduleCopy[module];
  return (
    <AdminPageHeader
      action={
        <AdminSessionActions
          leading={
            <Button className={adminSecondaryButtonClassName} type="button" variant="outline">
              <RefreshCw aria-hidden="true" />
              刷新
            </Button>
          }
        />
      }
      description={copy.description}
      title={copy.title}
    />
  );
}

function PreviewNote() {
  return (
    <p className="rounded-[var(--admin-radius-control)] bg-[var(--admin-selection-background)] px-3 py-2 text-xs text-[var(--admin-selection-foreground)]">
      阶段 1 静态布局样例，不连接业务 API，数值仅用于验证信息层级。
    </p>
  );
}

function DashboardPreview() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard icon={<Users className="size-5" />} label="总学员数" value="2,486" />
        <AdminMetricCard icon={<BookOpen className="size-5" />} label="活跃课程数" value="86" />
        <AdminMetricCard
          detail={
            <span className="block h-1.5 rounded-full bg-[var(--admin-surface-selected)]">
              <span className="block h-full w-3/4 rounded-full bg-[var(--admin-interactive-accent)]" />
            </span>
          }
          icon={<CheckCircle2 className="size-5" />}
          label="课程完成率"
          value="74.8%"
        />
        <AdminMetricCard
          icon={<ClipboardCheck className="size-5" />}
          label="考核通过率"
          value="81.6%"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <AdminCard className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold leading-6">社区活跃趋势</h3>
              <p className="mt-1 text-sm text-[var(--admin-muted-foreground)]">
                总互动、帖子、回复和弹幕
              </p>
            </div>
            <div className="flex rounded-[var(--admin-radius-control)] bg-[var(--admin-surface-subtle)] p-1 text-xs">
              <span className="px-3 py-1.5">周</span>
              <span className="rounded-md bg-[var(--admin-surface)] px-3 py-1.5 text-[var(--admin-link)] shadow-sm">
                月
              </span>
              <span className="px-3 py-1.5">年</span>
            </div>
          </div>
          <div
            className="mt-8 grid h-56 grid-cols-6 items-end gap-3 border-b border-l border-[var(--admin-border)] px-4 pb-0"
            aria-label="社区活跃趋势静态图"
          >
            {[42, 64, 50, 78, 60, 88].map((height, index) => (
              <span
                className="rounded-t bg-[var(--admin-interactive-accent)] opacity-80"
                key={index}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </AdminCard>
        <AdminCard className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold leading-6">待处理事项</h3>
            <AdminStatusBadge tone="danger">3 项</AdminStatusBadge>
          </div>
          <div className="mt-4 grid gap-3">
            {['课程内容未完成', '考核题库不足', '邀请码配置缺失'].map((item, index) => (
              <AdminEntityCard className="p-3" key={item}>
                <div className="flex items-start gap-3">
                  <span className="mt-1 size-2 rounded-full bg-[var(--admin-danger)]" />
                  <div>
                    <p className="text-sm font-medium">{item}</p>
                    <p className="mt-1 text-xs text-[var(--admin-muted-foreground)]">
                      {index + 1} 项需要管理员确认
                    </p>
                  </div>
                </div>
              </AdminEntityCard>
            ))}
          </div>
        </AdminCard>
      </div>
    </>
  );
}

function CoursePreview() {
  return (
    <>
      <AdminCard className="overflow-hidden">
        <div className="flex gap-6 border-b border-[var(--admin-border-subtle)] px-4 pt-4 text-sm">
          <span className="border-b-2 border-[var(--admin-selection-indicator)] px-1 pb-3 font-medium text-[var(--admin-link)]">
            全部
          </span>
          {['已发布', '草稿', '已归档', '待复核'].map((tab) => (
            <span className="px-1 pb-3" key={tab}>
              {tab}
            </span>
          ))}
        </div>
        <AdminFilterBar>
          <label className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-3 size-4 text-[var(--admin-muted-foreground)]" />
            <Input
              aria-label="搜索课程"
              className={`${adminInputClassName} pl-9`}
              placeholder="搜索课程名称或描述"
            />
          </label>
          <select className="h-10 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm">
            <option>全部分类</option>
          </select>
          <select className="h-10 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm">
            <option>全部可见范围</option>
          </select>
        </AdminFilterBar>
      </AdminCard>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ['新员工合规入门', '已发布', 'success'],
          ['管理者沟通训练', '草稿', 'neutral'],
          ['信息安全规范', '待复核', 'warning'],
        ].map(([name, status, tone], index) => (
          <AdminEntityCard className="overflow-hidden p-0" key={name}>
            <div className="grid aspect-[16/8] place-items-center bg-[linear-gradient(135deg,var(--admin-selection-background),var(--admin-surface-subtle))]">
              <BookOpen className="size-10 text-[var(--admin-interactive-accent)]" />
            </div>
            <div className="grid gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold leading-6">{name}</h3>
                <AdminStatusBadge tone={tone as 'success' | 'neutral' | 'warning'}>
                  {status}
                </AdminStatusBadge>
              </div>
              <p className="text-sm leading-5 text-[var(--admin-muted-foreground)]">
                企业培训课程静态说明，用于检查三列、两列和单列布局。
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-[var(--admin-surface-subtle)] px-2 py-1">示例分类</span>
                <span className="rounded bg-[var(--admin-selection-background)] px-2 py-1 text-[var(--admin-selection-foreground)]">
                  {index === 1 ? '指定角色' : '全员可见'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--admin-border-subtle)] pt-3 text-xs text-[var(--admin-muted-foreground)]">
                <span>{120 + index * 34} 人学习</span>
                <span>更新于 7 月 22 日</span>
              </div>
            </div>
          </AdminEntityCard>
        ))}
      </div>
    </>
  );
}

function ExamPreview() {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard className="p-6">
          <h3 className="text-lg font-semibold">题库准备</h3>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[var(--admin-muted-foreground)]">已发布课程</p>
              <strong className="mt-2 block text-2xl">42</strong>
            </div>
            <div>
              <p className="text-xs text-[var(--admin-muted-foreground)]">题库已就绪</p>
              <strong className="mt-2 block text-2xl text-[var(--admin-success)]">38</strong>
            </div>
            <div>
              <p className="text-xs text-[var(--admin-muted-foreground)]">缺少题目</p>
              <strong className="mt-2 block text-2xl text-[var(--admin-danger)]">4</strong>
            </div>
          </div>
        </AdminCard>
        <AdminCard className="p-6">
          <h3 className="text-lg font-semibold">全局考核统计</h3>
          <div className="mt-6 flex items-center gap-6">
            <div className="grid size-24 place-items-center rounded-full border-[10px] border-[var(--admin-interactive-accent)] text-xl font-semibold">
              82%
            </div>
            <div>
              <p className="text-sm text-[var(--admin-muted-foreground)]">考核次数</p>
              <strong className="text-2xl">1,264</strong>
              <p className="mt-3 text-sm">平均分 84.2</p>
            </div>
          </div>
        </AdminCard>
      </div>
      <SimpleTable type="exam" />
    </>
  );
}

function CommunityPreview() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard
          icon={<MessageSquareText className="size-5" />}
          label="今日新帖"
          trend={<AdminStatusBadge tone="success">较上期 +8%</AdminStatusBadge>}
          value="36"
        />
        <AdminMetricCard
          label="今日回复"
          trend={<AdminStatusBadge tone="success">较上期 +5%</AdminStatusBadge>}
          value="148"
        />
        <AdminMetricCard
          label="管理操作"
          trend={<span className="text-xs text-[var(--admin-muted-foreground)]">较上期持平</span>}
          value="12"
        />
      </div>
      <AdminCard className="overflow-hidden">
        <div className="flex gap-6 border-b border-[var(--admin-border-subtle)] px-4 pt-4 text-sm">
          <span className="border-b-2 border-[var(--admin-selection-indicator)] pb-3 text-[var(--admin-link)]">
            帖子
          </span>
          <span>回复</span>
          <span>弹幕</span>
          <span>操作审计</span>
        </div>
        <AdminFilterBar>
          <Input aria-label="搜索社区内容" className={adminInputClassName} placeholder="关键词…" />
          <Input aria-label="作者 ID" className={adminInputClassName} placeholder="作者 ID" />
          <Button className={adminPrimaryButtonClassName}>刷新</Button>
        </AdminFilterBar>
        <div className="grid gap-3 p-3">
          {['课程学习计划如何安排？', '关于考核时间的补充说明'].map((title, index) => (
            <AdminEntityCard key={title}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[var(--admin-muted-foreground)]">
                    示例用户 · 2026-07-22 14:3{index}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-5 text-[var(--admin-muted-foreground)]">
                    这是用于验证社区内容卡片层级和管理操作位置的静态内容。
                  </p>
                </div>
                <AdminStatusBadge tone={index ? 'warning' : 'success'}>
                  {index ? '已隐藏' : '正常显示'}
                </AdminStatusBadge>
              </div>
            </AdminEntityCard>
          ))}
        </div>
      </AdminCard>
    </>
  );
}

function SimpleTable({ type }: { type: 'exam' | 'access' }) {
  const headers =
    type === 'exam'
      ? ['考核名称', '目标角色', '题量', '通过线', '状态', '操作']
      : ['显示名称', '手机号', 'Host User ID', '角色', '状态', '操作'];
  return (
    <AdminCard
      className={type === 'access' ? 'hidden overflow-hidden md:block' : 'overflow-hidden'}
    >
      <AdminFilterBar>
        <Input
          aria-label="搜索"
          className={`${adminInputClassName} max-w-sm`}
          placeholder={type === 'exam' ? '搜索考核名称或课程' : '搜索名称、手机号或 Host User ID'}
        />
      </AdminFilterBar>
      <AdminDataTable>
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-[var(--admin-surface-subtle)] text-[var(--admin-muted-foreground)]">
            <tr>
              {headers.map((header) => (
                <th className="px-4 py-3 font-medium" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((row) => (
              <tr className="border-t border-[var(--admin-border-subtle)]" key={row}>
                {headers.map((header, column) => (
                  <td className="px-4 py-4" key={header}>
                    {column === 0 ? (
                      type === 'exam' ? (
                        `阶段考核样例 ${row + 1}`
                      ) : (
                        `示例用户 ${row + 1}`
                      )
                    ) : column === headers.length - 2 ? (
                      <AdminStatusBadge tone={row === 1 ? 'warning' : 'success'}>
                        {row === 1
                          ? type === 'exam'
                            ? '草稿'
                            : '已冻结'
                          : type === 'exam'
                            ? '已发布'
                            : '正常'}
                      </AdminStatusBadge>
                    ) : column === headers.length - 1 ? (
                      <button className="font-medium text-[var(--admin-link)]">查看</button>
                    ) : (
                      `示例 ${row + 1}`
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </AdminDataTable>
      <div className="flex items-center justify-between border-t border-[var(--admin-border-subtle)] p-4 text-xs text-[var(--admin-muted-foreground)]">
        <span>共 3 条静态记录</span>
        <span>第 1 / 1 页</span>
      </div>
    </AdminCard>
  );
}

function AccessPreview() {
  return (
    <>
      <AdminCard className="overflow-hidden">
        <div className="flex gap-6 border-b border-[var(--admin-border-subtle)] px-4 pt-4 text-sm">
          <span className="border-b-2 border-[var(--admin-selection-indicator)] pb-3 text-[var(--admin-link)]">
            用户
          </span>
          <span>角色</span>
          <span>邀请码</span>
        </div>
      </AdminCard>
      <SimpleTable type="access" />
      <div className="grid gap-3 md:hidden">
        {['示例用户 1', '示例用户 2'].map((name, index) => (
          <AdminEntityCard key={name}>
            <div className="flex justify-between">
              <h3 className="font-semibold">{name}</h3>
              <AdminStatusBadge tone={index ? 'warning' : 'success'}>
                {index ? '已冻结' : '正常'}
              </AdminStatusBadge>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-[var(--admin-muted-foreground)]">手机号</dt>
                <dd className="mt-1">1380000000{index}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--admin-muted-foreground)]">角色</dt>
                <dd className="mt-1">普通用户</dd>
              </div>
            </dl>
          </AdminEntityCard>
        ))}
      </div>
    </>
  );
}

export function AdminDesignPreview({ module }: { module: AdminModuleId }) {
  return (
    <AdminPage data-admin-design-preview={module}>
      <PreviewHeader module={module} />
      <PreviewNote />
      {module === 'dashboard' ? <DashboardPreview /> : null}
      {module === 'courses' ? <CoursePreview /> : null}
      {module === 'exams' ? <ExamPreview /> : null}
      {module === 'community' ? <CommunityPreview /> : null}
      {module === 'access' ? <AccessPreview /> : null}
    </AdminPage>
  );
}
