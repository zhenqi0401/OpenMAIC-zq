'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  LogOut,
  Menu,
  Monitor,
  Moon,
  RefreshCw,
  Search,
  Shield,
  Sun,
  UserRound,
} from 'lucide-react';
import type { Slide } from '@openmaic/dsl';
import { SlideThumbnail } from '@/components/slide-renderer/SlideThumbnail';
import { StageExamPanel } from '@/components/assessment/StageExamPanel';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/hooks/use-theme';
import { useUserProfileStore } from '@/lib/store/user-profile';
import {
  changeHomeCourseCategory,
  changeHomeCourseScope,
  filterHomeCourses,
  sortHomeCourses,
  type EnterpriseHomeCourse,
  type HomeCourseFilter,
  type HomeCourseCategory,
  type HomeCourseSelection,
  type HomeCourseSort,
} from '@/lib/home/enterprise-course-list';
import type { SessionIdentity } from '@/lib/auth/types';
import { isCoursePopularityEnabled, isForumEnabled } from '@/lib/config/feature-flags';
import { isSystemCourseCategoryKey } from '@/lib/courses/system-categories';

interface LearnerHomeProps {
  identity: SessionIdentity;
  courses: EnterpriseHomeCourse[];
  categories: HomeCourseCategory[];
  thumbnails: Record<string, Slide>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  getCourseHref: (id: string) => string;
  onLogout: () => Promise<void>;
  enableCategoryDeepLink?: boolean;
}

const COURSE_FILTERS: Array<{ value: HomeCourseFilter; label: string }> = [
  { value: 'all', label: '全部课程' },
  { value: 'platform', label: '精品课程' },
  { value: 'tenant', label: '企业课程' },
];

const THEME_OPTIONS = [
  ['light', '浅色', Sun],
  ['dark', '深色', Moon],
  ['system', '跟随系统', Monitor],
] as const;

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="min-h-11 gap-2 px-3" aria-label="主题设置">
          <Icon className="size-4" />
          <span>主题</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-40">
        {THEME_OPTIONS.map(([value, label, OptionIcon]) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => setTheme(value)}
            className={cn(
              'min-h-11 gap-2',
              theme === value && 'text-violet-600 dark:text-violet-300',
            )}
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

function MobileAccountMenu({
  identity,
  displayName,
  onLogout,
}: {
  identity: SessionIdentity;
  displayName: string;
  onLogout: () => Promise<void>;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label="打开用户菜单">
          <Menu className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-52">
        <div className="px-2 py-2">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {identity.roleCode}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="min-h-11">
            {theme === 'dark' ? (
              <Moon className="size-4" />
            ) : theme === 'light' ? (
              <Sun className="size-4" />
            ) : (
              <Monitor className="size-4" />
            )}
            主题
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-40">
            {THEME_OPTIONS.map(([value, label, OptionIcon]) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => setTheme(value)}
                className="min-h-11 gap-2"
              >
                <OptionIcon className="size-4" />
                {label}
                {theme === value && <Check className="ml-auto size-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {identity.isAdmin && (
          <DropdownMenuItem asChild className="min-h-11">
            <Link href="/admin">
              <Shield className="size-4" />
              管理后台
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="min-h-11"
          onSelect={() => void onLogout()}
        >
          <LogOut className="size-4" />
          退出
        </DropdownMenuItem>
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
  getCourseHref,
  onLogout,
  enableCategoryDeepLink = false,
}: LearnerHomeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const avatar = useUserProfileStore((state) => state.avatar);
  const nickname = useUserProfileStore((state) => state.nickname);
  const requestedCategoryKey = enableCategoryDeepLink ? searchParams.get('category') : null;
  const [selection, setSelection] = useState<HomeCourseSelection>({
    scope: requestedCategoryKey ? 'tenant' : 'all',
    categoryId: null,
  });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<HomeCourseSort>('latest');
  const tenantCategories = useMemo(
    () => categories.filter((category) => category.scope === 'tenant'),
    [categories],
  );
  const requestedCategory = tenantCategories.find(
    (category) => category.categoryKey === requestedCategoryKey,
  );
  const categoryDeepLinkError =
    !!requestedCategoryKey &&
    (!isSystemCourseCategoryKey(requestedCategoryKey) || (!loading && !requestedCategory));

  useEffect(() => {
    if (!enableCategoryDeepLink || !requestedCategoryKey || loading) return;
    const update = window.setTimeout(() => {
      setSelection({ scope: 'tenant', categoryId: requestedCategory?.id ?? null });
    }, 0);
    return () => window.clearTimeout(update);
  }, [enableCategoryDeepLink, loading, requestedCategory?.id, requestedCategoryKey]);

  const replaceCategoryParameter = (categoryKey: string | null) => {
    if (!enableCategoryDeepLink) return;
    const next = new URLSearchParams(searchParams.toString());
    if (categoryKey) next.set('category', categoryKey);
    else next.delete('category');
    const queryString = next.toString();
    router.replace(queryString ? `/learn?${queryString}` : '/learn');
  };
  const popularityEnabled = isCoursePopularityEnabled();
  const forumEnabled = isForumEnabled();
  const deferredQuery = useDeferredValue(query);
  const displayName = nickname || '学习者';
  const homeHref = enableCategoryDeepLink ? '/learn' : '/';

  const filteredCourses = useMemo(
    () =>
      sortHomeCourses(
        filterHomeCourses(courses, selection.scope, deferredQuery, selection.categoryId),
        sort,
      ),
    [courses, deferredQuery, selection, sort],
  );
  const selectedCategoryHasCourses = useMemo(
    () =>
      selection.categoryId === null ||
      filterHomeCourses(courses, 'tenant', '', selection.categoryId).length > 0,
    [courses, selection.categoryId],
  );
  const scopeCounts = useMemo(
    () => ({
      all: courses.length,
      platform: courses.filter((course) => course.scope === 'platform').length,
      tenant: courses.filter((course) => course.scope === 'tenant').length,
    }),
    [courses],
  );

  return (
    <div className="min-h-[100dvh] bg-[#f5f7fb] text-[#171a24] dark:bg-[#11131a] dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-[#171a22]/95">
        <div className="mx-auto flex min-h-16 w-[min(1440px,calc(100%-1.5rem))] items-center gap-1 sm:w-[min(1440px,calc(100%-3rem))] sm:gap-4">
          <Link
            href={homeHref}
            className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#171a22]"
            aria-label="元我智脑学习首页"
          >
            <BrandLockup variant="compact" priority />
          </Link>

          <nav className="ml-auto flex h-16 items-stretch sm:ml-5" aria-label="学习中心主导航">
            <Link
              href={homeHref}
              aria-current="page"
              className="relative inline-flex min-h-11 items-center px-2 text-sm font-medium text-slate-950 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-blue-600 after:to-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 dark:text-white sm:px-4 sm:after:inset-x-4"
            >
              首页
            </Link>
            {forumEnabled && (
              <Link
                href="/forum"
                className="inline-flex min-h-11 items-center px-2 text-sm text-slate-600 transition-colors hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 dark:text-slate-300 dark:hover:text-violet-300 sm:px-4"
              >
                <span className="sm:hidden">交流</span>
                <span className="hidden sm:inline">交流社区</span>
              </Link>
            )}
          </nav>

          <div className="ml-auto hidden items-center gap-1 md:flex">
            <div className="mr-1 flex min-w-0 items-center gap-2.5">
              <Image
                src={avatar}
                alt={`${displayName}的头像`}
                width={36}
                height={36}
                unoptimized={avatar.startsWith('data:')}
                className="size-9 rounded-full border border-violet-200 bg-violet-50 object-cover dark:border-violet-800 dark:bg-violet-950"
              />
              <span className="max-w-32 truncate text-sm font-medium">{displayName}</span>
            </div>
            <ThemeMenu />
            {identity.isAdmin && (
              <Button asChild variant="ghost" size="sm" className="min-h-11 gap-2 px-3">
                <Link href="/admin" aria-label="进入管理后台">
                  <Shield className="size-4" />
                  <span>管理后台</span>
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 gap-2 px-3"
              onClick={() => void onLogout()}
              aria-label="退出登录"
            >
              <LogOut className="size-4" />
              <span>退出</span>
            </Button>
          </div>

          <div className="ml-0.5 md:hidden">
            <MobileAccountMenu identity={identity} displayName={displayName} onLogout={onLogout} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-[min(1440px,calc(100%-2rem))] pb-16 pt-5 sm:w-[min(1440px,calc(100%-3rem))] sm:pt-7">
        <StageExamPanel identity={identity} />

        <section className="mt-7 min-w-0" aria-labelledby="learner-courses-title">
          <h1 id="learner-courses-title" className="text-2xl font-semibold tracking-tight">
            课程中心
          </h1>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="grid min-h-11 w-full grid-cols-3 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800/70 sm:w-fit"
              role="group"
              aria-label="课程来源"
            >
              {COURSE_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={selection.scope === item.value}
                  onClick={() => {
                    setSelection((current) => changeHomeCourseScope(current, item.value));
                    if (item.value !== 'tenant') replaceCategoryParameter(null);
                  }}
                  className={cn(
                    'min-h-9 min-w-0 whitespace-nowrap rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-slate-300 dark:hover:text-violet-300 sm:px-4 sm:text-sm',
                    selection.scope === item.value &&
                      'bg-white text-violet-700 shadow-sm dark:bg-[#171a22] dark:text-violet-300',
                  )}
                >
                  {item.label}
                  <span className="ml-1 font-mono text-[10px] opacity-65">
                    {scopeCounts[item.value]}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:max-w-xl">
              <label className="relative block w-full sm:min-w-64 sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索课程"
                  aria-label="搜索课程"
                  className="h-11 rounded-lg border-slate-200 bg-white pl-9 dark:border-slate-700 dark:bg-[#171a22]"
                />
              </label>
              {popularityEnabled && (
                <div
                  className="ml-auto inline-flex min-h-11 shrink-0 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-[#171a22]"
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
                      onClick={() => setSort(value)}
                      className={cn(
                        'min-h-9 rounded-md px-4 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                        sort === value
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200'
                          : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selection.scope === 'tenant' && (
            <div
              className="mt-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4 dark:border-slate-800"
              role="group"
              aria-label="企业课程分类"
            >
              {[
                { id: null, name: '全部分类', categoryKey: null },
                ...tenantCategories.map((category) => ({
                  id: category.id,
                  name: category.name,
                  categoryKey: category.categoryKey ?? null,
                })),
              ].map((category) => {
                const selected = selection.categoryId === category.id;
                return (
                  <button
                    key={category.id ?? 'all-categories'}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelection((current) => changeHomeCourseCategory(current, category.id));
                      replaceCategoryParameter(category.categoryKey);
                    }}
                    className={cn(
                      'min-h-11 max-w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 transition-colors hover:border-violet-400 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-[#171a22] dark:text-slate-300 dark:hover:border-violet-500 dark:hover:text-violet-300 dark:focus-visible:ring-offset-[#11131a]',
                      selected &&
                        'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/50 dark:text-violet-200',
                    )}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          )}

          {categoryDeepLinkError && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <p>指定的课程分类不存在或不可用</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 min-h-11"
                onClick={() => {
                  setSelection({ scope: 'all', categoryId: null });
                  replaceCategoryParameter(null);
                }}
              >
                查看全部课程
              </Button>
            </div>
          )}

          <div className="mt-5">
            {loading ? (
              <CourseGridSkeleton />
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-white py-12 text-center dark:border-red-950 dark:bg-[#171a22]">
                <p className="font-medium text-red-700 dark:text-red-300">课程加载失败</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{error}</p>
                <Button variant="outline" onClick={onRetry} className="mt-5 min-h-11 rounded-lg">
                  <RefreshCw className="size-4" />
                  重新加载
                </Button>
              </div>
            ) : filteredCourses.length > 0 ? (
              <div
                className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                data-testid="learner-course-grid"
              >
                {filteredCourses.map((course) => (
                  <LearnerCourseCard
                    key={course.id}
                    course={course}
                    slide={thumbnails[course.id]}
                    href={getCourseHref(course.id)}
                    popularityEnabled={popularityEnabled}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white py-14 text-center dark:border-slate-800 dark:bg-[#171a22]">
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
                      ? '请等待管理员发布课程。'
                      : '请调整搜索词或课程来源。'}
                </p>
                {(query || selection.scope !== 'all' || selection.categoryId) && (
                  <Button
                    variant="outline"
                    className="mt-5 min-h-11 rounded-lg"
                    onClick={() => {
                      setQuery('');
                      setSelection({ scope: 'all', categoryId: null });
                      replaceCategoryParameter(null);
                    }}
                  >
                    清除筛选
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function CourseGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-label="正在加载课程"
    >
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#171a22]"
        >
          <div className="aspect-video w-full animate-pulse bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LearnerCourseCard({
  course,
  slide,
  href,
  popularityEnabled,
}: {
  course: EnterpriseHomeCourse;
  slide?: Slide;
  href: string;
  popularityEnabled: boolean;
}) {
  const thumbnailRef = useRef<HTMLDivElement>(null);
  const [thumbnailWidth, setThumbnailWidth] = useState(0);

  useEffect(() => {
    const element = thumbnailRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setThumbnailWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <article className="min-w-0">
      <Link
        href={href}
        aria-label={`学习课程：${course.name}`}
        data-course-id={course.id}
        data-course-scope={course.scope}
        className="group block min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_16px_34px_rgba(48,41,92,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-[#171a22] dark:hover:border-violet-700 dark:focus-visible:ring-offset-[#11131a]"
      >
        <div
          ref={thumbnailRef}
          className="relative aspect-video overflow-hidden bg-gradient-to-br from-indigo-100 via-blue-50 to-violet-100 dark:from-indigo-950 dark:via-slate-900 dark:to-violet-950"
        >
          {slide && thumbnailWidth > 0 ? (
            <SlideThumbnail
              slide={slide}
              size={thumbnailWidth}
              viewportSize={slide.viewportSize ?? 1000}
              viewportRatio={slide.viewportRatio ?? 0.5625}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center overflow-hidden p-5"
              aria-hidden="true"
            >
              <span className="absolute -right-10 -top-12 size-36 rounded-full border-[22px] border-white/35 dark:border-white/5" />
              <span className="absolute -bottom-14 -left-12 size-40 rounded-full border-[24px] border-violet-300/30 dark:border-violet-400/10" />
              <div className="relative flex items-center gap-3 text-[#155fa8] dark:text-blue-300">
                <span className="grid size-11 place-items-center rounded-xl bg-white/75 shadow-sm dark:bg-white/10">
                  <BookOpen className="size-6" />
                </span>
                <span className="text-lg font-semibold tracking-wide">元我智脑</span>
              </div>
            </div>
          )}

          {course.scope === 'platform' && (
            <span className="absolute left-3 top-3 rounded-md bg-gradient-to-r from-blue-600 to-violet-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
              精品课程
            </span>
          )}
        </div>

        <div className="flex min-h-24 flex-col p-4">
          <h2
            className="line-clamp-2 text-base font-semibold leading-6 transition-colors group-hover:text-violet-700 dark:group-hover:text-violet-300"
            title={course.name}
          >
            {course.name}
          </h2>
          {popularityEnabled && (
            <span
              className="mt-auto inline-flex items-center justify-end gap-1.5 pt-3 text-xs text-slate-500 dark:text-slate-400"
              aria-label={`${course.learnerCount} 人已开始学习`}
            >
              <UserRound className="size-4" aria-hidden="true" />
              <span aria-hidden="true">{course.learnerCount}</span>
            </span>
          )}
        </div>
      </Link>
    </article>
  );
}
