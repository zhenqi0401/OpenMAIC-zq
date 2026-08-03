'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useDeferredValue, useMemo, useRef, useState, useEffect } from 'react';
import {
  BookOpen,
  Check,
  ChevronRight,
  LogOut,
  Monitor,
  MessagesSquare,
  Moon,
  Pencil,
  RefreshCw,
  Search,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import type { Slide } from '@openmaic/dsl';
import { SlideThumbnail } from '@/components/slide-renderer/SlideThumbnail';
import { StageExamPanel } from '@/components/assessment/StageExamPanel';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/hooks/use-theme';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useUserProfileStore } from '@/lib/store/user-profile';
import {
  changeHomeCourseCategory,
  changeHomeCourseSource,
  filterHomeCourses,
  isLocalHomeCourse,
  sortHomeCourses,
  type HomeCourse,
  type HomeCourseFilter,
  type HomeCourseCategory,
  type HomeCourseSelection,
  type HomeCourseSort,
} from '@/lib/home/enterprise-course-list';
import type { SessionIdentity } from '@/lib/auth/types';
import { isCoursePopularityEnabled, isForumEnabled } from '@/lib/config/feature-flags';

interface LearnerHomeProps {
  identity: SessionIdentity;
  courses: HomeCourse[];
  categories: HomeCourseCategory[];
  thumbnails: Record<string, Slide>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenCourse: (id: string) => void;
  onRenameCourse: (id: string, name: string) => Promise<void>;
  onDeleteCourse: (id: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

const FILTERS: Array<{ value: HomeCourseFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'enterprise', label: '企业课程' },
  { value: 'local', label: '本地课程' },
];

function formatCourseDate(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((start - target) / 86_400_000);
  if (days === 0) return '今天更新';
  if (days === 1) return '昨天更新';
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日更新`;
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="主题设置" title="主题设置">
          <Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        {(
          [
            ['light', '浅色', Sun],
            ['dark', '深色', Moon],
            ['system', '跟随系统', Monitor],
          ] as const
        ).map(([value, label, OptionIcon]) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => setTheme(value)}
            className={cn('gap-2', theme === value && 'text-violet-600 dark:text-violet-300')}
          >
            <OptionIcon className="size-4" />
            {label}
            {theme === value && <Check className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LearnerHome({
  identity,
  courses,
  categories,
  thumbnails,
  loading,
  error,
  onRetry,
  onOpenCourse,
  onRenameCourse,
  onDeleteCourse,
  onLogout,
}: LearnerHomeProps) {
  const { t } = useI18n();
  const avatar = useUserProfileStore((state) => state.avatar);
  const nickname = useUserProfileStore((state) => state.nickname);
  const [selection, setSelection] = useState<HomeCourseSelection>({
    source: 'all',
    categoryId: null,
  });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<HomeCourseSort>('latest');
  const popularityEnabled = isCoursePopularityEnabled();
  const deferredQuery = useDeferredValue(query);
  const displayName = nickname || t('profile.defaultNickname');

  const filteredCourses = useMemo(
    () =>
      sortHomeCourses(
        filterHomeCourses(courses, selection.source, deferredQuery, selection.categoryId),
        sort,
      ),
    [courses, deferredQuery, selection, sort],
  );
  const selectedCategoryHasCourses = useMemo(
    () =>
      selection.categoryId === null ||
      filterHomeCourses(courses, 'enterprise', '', selection.categoryId).length > 0,
    [courses, selection.categoryId],
  );
  const sourceCounts = useMemo(
    () => ({
      all: courses.length,
      enterprise: courses.filter((course) => course.source === 'enterprise').length,
      local: courses.filter((course) => course.source === 'local').length,
    }),
    [courses],
  );

  return (
    <div className="min-h-[100dvh] bg-[#f4f5f7] text-[#181a22] dark:bg-[#12141a] dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-[#d9dce3] bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-[#1a1d25]/95">
        <div className="mx-auto flex min-h-16 w-[min(1240px,calc(100%-2rem))] items-center justify-between gap-4 md:w-[min(1240px,calc(100%-3rem))]">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLockup variant="compact" priority />
            <span className="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
            <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              学习中心
            </span>
          </div>

          <div className="flex items-center gap-1">
            <div className="mr-1 hidden text-right leading-tight md:block">
              <p className="text-xs font-semibold">{displayName}</p>
              <p className="mt-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                {identity.roleCode}
              </p>
            </div>
            <Image
              src={avatar}
              alt={`${displayName}的头像`}
              width={34}
              height={34}
              unoptimized={avatar.startsWith('data:')}
              className="size-8 rounded-full border border-violet-200 bg-violet-50 object-cover dark:border-violet-800 dark:bg-violet-950"
            />
            <span className="mx-1 hidden h-5 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
            <LanguageSwitcher />
            <ThemeMenu />
            {isForumEnabled() && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/forum" aria-label="进入学习交流区" title="学习交流区">
                  <MessagesSquare className="size-4" />
                  <span className="hidden lg:inline">交流区</span>
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void onLogout()}
              aria-label="退出登录"
              title="退出登录"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-[min(1240px,calc(100%-2rem))] pb-16 pt-10 md:w-[min(1240px,calc(100%-3rem))] md:pt-14">
        <section className="flex flex-col gap-6 border-b border-[#d9dce3] pb-8 dark:border-slate-800 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date())}
            </p>
            <h1 className="text-3xl font-semibold leading-tight md:text-[34px]">
              早上好，{displayName}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              继续完成当前岗位的学习任务。
            </p>
          </div>
          <div className="flex gap-5 text-xs text-slate-500 dark:text-slate-400 sm:gap-7">
            <span>
              <b className="mr-1 font-mono text-base text-slate-950 dark:text-white">
                {courses.length}
              </b>
              门可学课程
            </span>
            <span className="border-l border-slate-300 pl-5 dark:border-slate-700 sm:pl-7">
              角色课程按当前权限更新
            </span>
          </div>
        </section>

        <div className="grid gap-12 pt-9 lg:grid-cols-[244px_minmax(0,1fr)] lg:gap-12">
          <aside className="min-w-0" aria-labelledby="learner-tasks-title">
            <p className="mb-1 font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              TODAY
            </p>
            <h2 id="learner-tasks-title" className="text-xl font-semibold">
              待办事项
            </h2>
            <StageExamPanel identity={identity} />
          </aside>

          <section className="min-w-0" aria-labelledby="learner-courses-title">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="mb-1 font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  COURSES
                </p>
                <h2 id="learner-courses-title" className="text-xl font-semibold">
                  我的课程
                </h2>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid h-10 grid-cols-3 rounded-md border border-[#d9dce3] bg-[#eef0f4] p-1 dark:border-slate-700 dark:bg-slate-800/70">
                {FILTERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={selection.source === item.value}
                    onClick={() => {
                      setSelection((current) => changeHomeCourseSource(current, item.value));
                      if (item.value === 'local') setSort('latest');
                    }}
                    className={cn(
                      'min-w-0 rounded px-2.5 text-xs text-slate-500 transition-colors dark:text-slate-400',
                      selection.source === item.value &&
                        'bg-white text-slate-950 shadow-sm dark:bg-[#1a1d25] dark:text-white',
                    )}
                  >
                    {item.label}{' '}
                    <span className="font-mono text-[10px] opacity-70">
                      {sourceCounts[item.value]}
                    </span>
                  </button>
                ))}
              </div>
              <label className="relative block w-full sm:w-60">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索课程"
                  aria-label="搜索课程"
                  className="h-10 rounded-md border-[#d9dce3] bg-white pl-9 dark:border-slate-700 dark:bg-[#1a1d25]"
                />
              </label>
            </div>

            <div
              className="flex flex-wrap items-center gap-2 border-b border-[#d9dce3] pb-4 dark:border-slate-800"
              role="group"
              aria-label="企业课程分类"
            >
              <span className="mr-1 text-xs text-slate-500 dark:text-slate-400">课程分类</span>
              {[
                { id: null, name: '全部分类' },
                ...categories.map((category) => ({ id: category.id, name: category.name })),
              ].map((category) => {
                const selected = selection.categoryId === category.id;
                return (
                  <button
                    key={category.id ?? 'all-categories'}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setSelection((current) => changeHomeCourseCategory(current, category.id))
                    }
                    className={cn(
                      'max-w-full rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-violet-400 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-[#1a1d25] dark:text-slate-300 dark:hover:border-violet-500 dark:hover:text-violet-300 dark:focus-visible:ring-offset-[#12141a]',
                      selected &&
                        'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/50 dark:text-violet-200',
                    )}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>

            <div className="flex min-h-11 items-center justify-between gap-3 py-3 text-xs text-slate-500 dark:text-slate-400">
              <span role="status">
                {!loading && !error && `当前显示 ${filteredCourses.length} 门课程`}
              </span>
              {popularityEnabled && (
                <div
                  className="inline-flex rounded-md border border-[#d9dce3] bg-white p-0.5 dark:border-slate-700 dark:bg-[#1a1d25]"
                  role="group"
                  aria-label="课程排序"
                >
                  {(
                    [
                      ['latest', '最新'],
                      ['popular', '最热'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={sort === value}
                      disabled={value === 'popular' && selection.source === 'local'}
                      onClick={() => setSort(value)}
                      className={cn(
                        'rounded px-3 py-1 text-xs transition-colors',
                        value === 'popular' &&
                          selection.source === 'local' &&
                          'cursor-not-allowed opacity-40',
                        sort === value
                          ? 'bg-violet-100 font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-200'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loading ? (
              <CourseGridSkeleton />
            ) : error ? (
              <div className="border-y border-red-200 py-12 text-center dark:border-red-950">
                <p className="font-medium text-red-700 dark:text-red-300">课程加载失败</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{error}</p>
                <Button variant="outline" onClick={onRetry} className="mt-5 rounded-md">
                  <RefreshCw className="size-4" />
                  重新加载
                </Button>
              </div>
            ) : filteredCourses.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredCourses.map((course) => (
                  <LearnerCourseCard
                    key={course.id}
                    course={course}
                    slide={thumbnails[course.id]}
                    onOpen={() => onOpenCourse(course.id)}
                    onRename={onRenameCourse}
                    onDelete={onDeleteCourse}
                  />
                ))}
              </div>
            ) : (
              <div className="border-y border-[#d9dce3] py-14 text-center dark:border-slate-800">
                <BookOpen className="mx-auto size-7 text-slate-400" />
                <p className="mt-3 font-medium">
                  {selection.categoryId && !selectedCategoryHasCourses
                    ? '该分类暂无可学课程'
                    : '没有匹配的课程'}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selection.categoryId && !selectedCategoryHasCourses
                    ? '可切换其他分类查看课程。'
                    : courses.length === 0
                      ? '请等待管理员发布岗位课程。'
                      : '调整搜索词或课程来源。'}
                </p>
                {(query || selection.source !== 'all' || selection.categoryId) && (
                  <Button
                    variant="outline"
                    className="mt-5 rounded-md"
                    onClick={() => {
                      setQuery('');
                      setSelection({ source: 'all', categoryId: null });
                    }}
                  >
                    清除筛选
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="mx-auto flex w-[min(1240px,calc(100%-2rem))] justify-between border-t border-[#d9dce3] py-5 text-[11px] text-slate-400 dark:border-slate-800 md:w-[min(1240px,calc(100%-3rem))]">
        <span>元我智脑</span>
        <span>企业学习空间</span>
      </footer>
    </div>
  );
}

function CourseGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="正在加载课程">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-lg border border-[#d9dce3] bg-white dark:border-slate-800 dark:bg-[#1a1d25]"
        >
          <div className="aspect-video w-full animate-pulse bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-5 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LearnerCourseCard({
  course,
  slide,
  onOpen,
  onRename,
  onDelete,
}: {
  course: HomeCourse;
  slide?: Slide;
  onOpen: () => void;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const local = isLocalHomeCourse(course);
  const popularityEnabled = isCoursePopularityEnabled();
  const thumbnailRef = useRef<HTMLDivElement>(null);
  const [thumbnailWidth, setThumbnailWidth] = useState(0);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(course.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const element = thumbnailRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setThumbnailWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  async function commitRename() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === course.name) {
      setNameDraft(course.name);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(course.id, trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setSaving(true);
    try {
      await onDelete(course.id);
    } finally {
      setSaving(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <article className="group flex min-h-[288px] min-w-0 flex-col overflow-hidden rounded-lg border border-[#d9dce3] bg-white transition duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-[0_10px_26px_rgba(24,26,34,0.08)] dark:border-slate-800 dark:bg-[#1a1d25] dark:hover:border-slate-600">
      <div
        ref={thumbnailRef}
        className={cn(
          'relative aspect-video overflow-hidden',
          local ? 'bg-[#e8edfb] dark:bg-[#263355]' : 'bg-[#e3f3ef] dark:bg-[#1d3936]',
        )}
      >
        {slide && thumbnailWidth > 0 ? (
          <SlideThumbnail
            slide={slide}
            size={thumbnailWidth}
            viewportSize={slide.viewportSize ?? 1000}
            viewportRatio={slide.viewportRatio ?? 0.5625}
          />
        ) : (
          <div className="absolute inset-0 flex items-end justify-between p-4" aria-hidden="true">
            <div>
              <BookOpen
                className={cn('mb-3 size-7', local ? 'text-blue-700' : 'text-emerald-700')}
              />
              <span className="font-mono text-[10px] font-semibold">
                {local ? 'LOCAL / ZIP' : 'ENTERPRISE'}
              </span>
            </div>
            <div className="w-2/5 space-y-2 opacity-35">
              <span className="block h-1 bg-current" />
              <span className="block h-1 w-4/5 bg-current" />
              <span className="block h-1 w-3/5 bg-current" />
            </div>
          </div>
        )}

        {confirmingDelete && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/75 p-4 text-center text-white backdrop-blur-sm">
            <p className="text-sm font-medium">删除这门本地课程？</p>
            <p className="mt-1 text-xs text-white/70">课程数据将从当前浏览器移除。</p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
                disabled={saving}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void confirmDelete()}
                disabled={saving}
              >
                {saving ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                删除
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <span
          className={cn(
            'w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold',
            local
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
          )}
        >
          {local ? '本地导入' : course.scope === 'platform' ? '精品课程' : '企业课程'}
        </span>

        {editing ? (
          <div className="mt-3 flex items-center gap-1">
            <Input
              autoFocus
              value={nameDraft}
              maxLength={100}
              onChange={(event) => setNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void commitRename();
                if (event.key === 'Escape') {
                  setNameDraft(course.name);
                  setEditing(false);
                }
              }}
              className="h-8 rounded-md"
              aria-label="本地课程名称"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void commitRename()}
              disabled={saving}
              aria-label="保存名称"
            >
              <Check className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditing(false)}
              disabled={saving}
              aria-label="取消重命名"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <h3
            className="mt-3 line-clamp-2 min-h-10 text-[15px] font-semibold leading-5"
            title={course.name}
          >
            {course.name}
          </h3>
        )}

        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          {course.sceneCount} 个学习场景 ·{' '}
          {local ? '保存在本机' : formatCourseDate(course.updatedAt)}
        </p>
        {!local && popularityEnabled && (
          <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            {course.learnerCount} 人已开始学习
          </p>
        )}

        <div className="mt-auto flex min-h-9 items-end justify-between gap-3 pt-4">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline hover:underline-offset-4 dark:text-violet-300"
          >
            打开课程 <ChevronRight className="size-3.5" />
          </button>
          {local && !editing && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setNameDraft(course.name);
                  setEditing(true);
                }}
                aria-label={`重命名${course.name}`}
                title="重命名"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setConfirmingDelete(true)}
                aria-label={`删除${course.name}`}
                title="删除"
                className="text-red-600 hover:text-red-700 dark:text-red-400"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
