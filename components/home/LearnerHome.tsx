'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, GraduationCap, PlayCircle, RefreshCw, Search, UserRound } from 'lucide-react';
import type { Slide } from '@openmaic/dsl';
import { SlideThumbnail } from '@/components/slide-renderer/SlideThumbnail';
import { StageExamPanel } from '@/components/assessment/StageExamPanel';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { LearnerHeader } from '@/components/home/LearnerHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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
import { isCoursePopularityEnabled } from '@/lib/config/feature-flags';
import {
  isSystemCourseCategoryKey,
  SYSTEM_COURSE_CATEGORIES,
} from '@/lib/courses/system-categories';

interface LearnerHomeProps {
  identity: SessionIdentity;
  displayName: string;
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

export function LearnerHome({
  identity,
  displayName,
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
  const requestedCategoryKey = enableCategoryDeepLink ? searchParams.get('category') : null;
  const [selection, setSelection] = useState<HomeCourseSelection>({
    scope: 'all',
    categoryKey:
      requestedCategoryKey && isSystemCourseCategoryKey(requestedCategoryKey)
        ? requestedCategoryKey
        : null,
    categoryId: null,
  });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<HomeCourseSort>('latest');
  const customTenantCategories = useMemo(
    () => categories.filter((category) => category.scope === 'tenant' && !category.categoryKey),
    [categories],
  );
  const categoryDeepLinkError =
    !!requestedCategoryKey && !isSystemCourseCategoryKey(requestedCategoryKey);

  useEffect(() => {
    if (!enableCategoryDeepLink || !requestedCategoryKey || loading) return;
    const update = window.setTimeout(() => {
      setSelection((current) =>
        changeHomeCourseCategory(
          current,
          isSystemCourseCategoryKey(requestedCategoryKey)
            ? { id: `fixed:${requestedCategoryKey}`, categoryKey: requestedCategoryKey }
            : null,
        ),
      );
    }, 0);
    return () => window.clearTimeout(update);
  }, [enableCategoryDeepLink, loading, requestedCategoryKey]);

  const replaceCategoryParameter = (categoryKey: string | null) => {
    if (!enableCategoryDeepLink) return;
    const next = new URLSearchParams(searchParams.toString());
    if (categoryKey) next.set('category', categoryKey);
    else next.delete('category');
    const queryString = next.toString();
    router.replace(queryString ? `/learn?${queryString}` : '/learn');
  };
  const popularityEnabled = isCoursePopularityEnabled();
  const deferredQuery = useDeferredValue(query);
  const visibleCategories = useMemo(
    () => [
      ...SYSTEM_COURSE_CATEGORIES.map((category) => ({
        id: `fixed:${category.categoryKey}`,
        name: category.name,
        categoryKey: category.categoryKey,
      })),
      ...(selection.scope === 'platform'
        ? []
        : customTenantCategories.map((category) => ({
            id: category.id,
            name: category.name,
            categoryKey: null,
          }))),
    ],
    [customTenantCategories, selection.scope],
  );

  const filteredCourses = useMemo(
    () =>
      sortHomeCourses(
        filterHomeCourses(
          courses,
          selection.scope,
          deferredQuery,
          selection.categoryKey,
          selection.categoryId,
        ),
        sort,
      ),
    [courses, deferredQuery, selection, sort],
  );
  const selectedCategoryHasCourses = useMemo(
    () =>
      (!selection.categoryKey && !selection.categoryId) ||
      filterHomeCourses(courses, selection.scope, '', selection.categoryKey, selection.categoryId)
        .length > 0,
    [courses, selection],
  );
  const requiredCourses = useMemo(
    () =>
      courses
        .filter((course) => course.learningRequirement === 'required')
        .sort((a, b) => (a.pathPosition ?? 0) - (b.pathPosition ?? 0)),
    [courses],
  );
  const scopeCounts = useMemo(
    () => ({
      all: courses.length,
      platform: courses.filter((course) => course.scope === 'platform').length,
      tenant: courses.filter((course) => course.scope === 'tenant').length,
    }),
    [courses],
  );
  const continueCourses = useMemo(
    () =>
      courses.filter(
        (course) =>
          course.learningStatus === 'learning' || course.learningStatus === 'assessment_pending',
      ),
    [courses],
  );
  const completedCount = useMemo(
    () => courses.filter((course) => course.learningStatus === 'completed').length,
    [courses],
  );

  return (
    <div className="min-h-[100dvh] bg-page text-foreground dark:bg-page dark:text-slate-100">
      <LearnerHeader
        current="home"
        displayName={displayName}
        identity={identity}
        onLogout={onLogout}
      />

      <main className="mx-auto w-[min(1600px,calc(100%-1.25rem))] pb-16 pt-5 sm:w-[min(1600px,calc(100%-2rem))] sm:pt-7">
        {!loading && !error ? (
          <section
            aria-label="学习概览"
            className="relative mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-primary/5 px-6 py-7 sm:px-8 sm:py-8 dark:border-slate-800 dark:from-card-solid dark:via-card-solid dark:to-primary/10"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full border-[28px] border-primary/10 dark:border-primary/15"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 right-24 size-40 rounded-full border-[20px] border-slate-200/70 dark:border-slate-700/40"
            />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <GraduationCap className="size-4 text-primary dark:text-primary/80" aria-hidden="true" />
                  <BrandLockup variant="compact" priority />
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                  欢迎回来，{displayName}
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-300">
                  保持节奏，积少成多。从最近的学习继续，或浏览新的课程。
                </p>
              </div>
              <div className="grid shrink-0 grid-cols-3 gap-3 sm:gap-4">
                {[
                  { label: '全部课程', value: courses.length, icon: BookOpen },
                  { label: '学习中', value: continueCourses.length, icon: PlayCircle },
                  { label: '已完成', value: completedCount, icon: CheckCircle2 },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      className="grid min-w-24 gap-1 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-center shadow-sm backdrop-blur dark:border-slate-700 dark:bg-card-solid/80"
                      key={item.label}
                    >
                      <Icon
                        aria-hidden="true"
                        className="mx-auto size-4 text-primary dark:text-primary/80"
                      />
                      <span className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                        {item.value}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {!loading && !error && continueCourses.length > 0 ? (
          <section className="mb-8 min-w-0" aria-labelledby="learner-continue-title">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2
                id="learner-continue-title"
                className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white"
              >
                <PlayCircle className="size-5 text-primary dark:text-primary/80" aria-hidden="true" />
                继续学习
              </h2>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {continueCourses.length} 门课程进行中
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {continueCourses.map((course) => (
                <ContinueCourseCard
                  key={`continue-${course.id}`}
                  course={course}
                  slide={thumbnails[course.id]}
                  href={getCourseHref(course.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        <StageExamPanel identity={identity} />

        <section className="mt-7 min-w-0" aria-labelledby="learner-courses-title">
          <h1
            id="learner-courses-title"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
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
                  }}
                  className={cn(
                    'min-h-10 min-w-0 whitespace-nowrap rounded-md px-2 text-sm font-medium text-slate-600 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-300 dark:hover:text-primary/80 sm:px-5 sm:text-base',
                    selection.scope === item.value &&
                      'bg-white text-primary shadow-sm dark:bg-card-solid dark:text-primary/80',
                  )}
                >
                  {item.label}
                  <span className="ml-1 font-mono text-xs opacity-65">
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
                  className="h-11 rounded-lg border-slate-200 bg-white pl-9 dark:border-slate-700 dark:bg-card-solid"
                />
              </label>
              {popularityEnabled && (
                <div
                  className="ml-auto inline-flex min-h-11 shrink-0 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-card-solid"
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
                        'min-h-9 rounded-md px-4 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        sort === value
                          ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
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

          <div
            className="mt-4 flex flex-wrap items-center gap-2.5 border-b border-slate-200 pb-4 dark:border-slate-800"
            role="group"
            aria-label="课程分类"
          >
            {[
              { id: 'all-categories', name: '全部分类', categoryKey: null },
              ...visibleCategories,
            ].map((category) => {
              const isCustom = category.id !== 'all-categories' && !category.categoryKey;
              const selected = category.categoryKey
                ? selection.categoryKey === category.categoryKey
                : isCustom
                  ? selection.categoryId === category.id
                  : !selection.categoryKey && !selection.categoryId;
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setSelection((current) =>
                      changeHomeCourseCategory(
                        current,
                        category.id === 'all-categories'
                          ? null
                          : { id: category.id, categoryKey: category.categoryKey },
                      ),
                    );
                    replaceCategoryParameter(category.categoryKey);
                  }}
                  className={cn(
                    'min-h-11 max-w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-card-solid dark:text-slate-300 dark:hover:border-primary dark:hover:text-primary/80 dark:focus-visible:ring-offset-page sm:px-5 sm:text-base',
                    selected &&
                      'border-primary bg-primary/5 text-primary dark:border-primary dark:bg-primary/30 dark:text-primary',
                  )}
                >
                  {category.name}
                </button>
              );
            })}
          </div>

          {categoryDeepLinkError && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <p>指定的课程分类不存在或不可用</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 min-h-11"
                onClick={() => {
                  setSelection({ scope: 'all', categoryKey: null, categoryId: null });
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
              <div className="rounded-lg border border-red-200 bg-white py-12 text-center dark:border-red-950 dark:bg-card-solid">
                <p className="font-medium text-red-700 dark:text-red-300">课程加载失败</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{error}</p>
                <Button variant="outline" onClick={onRetry} className="mt-5 min-h-11 rounded-lg">
                  <RefreshCw className="size-4" />
                  重新加载
                </Button>
              </div>
            ) : filteredCourses.length > 0 ? (
              <>
                {requiredCourses.length > 0 && selection.scope === 'all' && !query ? (
                  <section className="mb-8" aria-labelledby="my-required-courses">
                    <div className="mb-3 flex items-baseline justify-between">
                      <h2 id="my-required-courses" className="text-lg font-semibold">
                        我的必修
                      </h2>
                      <span className="text-sm text-slate-500">
                        已完成{' '}
                        {
                          requiredCourses.filter((course) => course.learningStatus === 'completed')
                            .length
                        }{' '}
                        / 共 {requiredCourses.length} 门
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {requiredCourses.map((course) => (
                        <LearnerCourseCard
                          key={`required-${course.id}`}
                          course={course}
                          slide={thumbnails[course.id]}
                          href={getCourseHref(course.id)}
                          popularityEnabled={popularityEnabled}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
                <div
                  className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                  data-testid="learner-course-grid"
                >
                  {filteredCourses
                    .filter(
                      (course) =>
                        !(requiredCourses.includes(course) && selection.scope === 'all' && !query),
                    )
                    .map((course) => (
                      <LearnerCourseCard
                        key={course.id}
                        course={course}
                        slide={thumbnails[course.id]}
                        href={getCourseHref(course.id)}
                        popularityEnabled={popularityEnabled}
                      />
                    ))}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white py-14 text-center dark:border-slate-800 dark:bg-card-solid">
                <BookOpen className="mx-auto size-7 text-slate-400" />
                <p className="mt-3 font-medium">
                  {(selection.categoryKey || selection.categoryId) && !selectedCategoryHasCourses
                    ? '该分类暂无可学课程'
                    : '没有匹配的课程'}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {(selection.categoryKey || selection.categoryId) && !selectedCategoryHasCourses
                    ? '可切换其他分类查看课程。'
                    : courses.length === 0
                      ? '请等待管理员发布课程。'
                      : '请调整搜索词或课程来源。'}
                </p>
                {(query ||
                  selection.scope !== 'all' ||
                  selection.categoryKey ||
                  selection.categoryId) && (
                  <Button
                    variant="outline"
                    className="mt-5 min-h-11 rounded-lg"
                    onClick={() => {
                      setQuery('');
                      setSelection({ scope: 'all', categoryKey: null, categoryId: null });
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
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="正在加载课程">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-card-solid"
        >
          <div className="aspect-video w-full animate-pulse bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-3 p-5">
            <div className="h-6 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ContinueCourseCard({
  course,
  slide,
  href,
}: {
  course: EnterpriseHomeCourse;
  slide?: Slide;
  href: string;
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

  const pendingAssessment = course.learningStatus === 'assessment_pending';

  return (
    <article className="min-w-0">
      <Link
        href={href}
        aria-label={`继续学习：${course.name}`}
        data-continue-course-id={course.id}
        className="group flex min-w-0 gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_28px_rgba(48,41,92,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-card-solid dark:hover:border-primary dark:focus-visible:ring-offset-page"
      >
        <div
          ref={thumbnailRef}
          className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-indigo-100 via-blue-50 to-primary/10 sm:w-40 dark:from-indigo-950 dark:via-slate-900 dark:to-primary/20"
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
              className="absolute inset-0 flex items-center justify-center"
              aria-hidden="true"
            >
              <BookOpen className="size-6 text-primary/70 dark:text-primary/40" />
            </div>
          )}
          <span
            className={cn(
              'absolute left-2 top-2 rounded-md px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm',
              pendingAssessment
                ? 'bg-amber-500'
                : 'bg-gradient-to-r from-blue-600 to-primary',
            )}
          >
            {pendingAssessment ? '待考核' : '学习中'}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1">
          <h3
            className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900 transition-colors group-hover:text-primary dark:text-white dark:group-hover:text-primary/80"
            title={course.name}
          >
            {course.name}
          </h3>
          {course.categoryName ? (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {course.categoryName}
            </p>
          ) : null}
          <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary dark:bg-primary/25 dark:text-primary">
            <PlayCircle className="size-3.5" aria-hidden="true" />
            {pendingAssessment ? '去完成考核' : '继续学习'}
          </span>
        </div>
      </Link>
    </article>
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
        className="group block min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_16px_34px_rgba(48,41,92,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-card-solid dark:hover:border-primary dark:focus-visible:ring-offset-page"
      >
        <div
          ref={thumbnailRef}
          className="relative aspect-video overflow-hidden bg-gradient-to-br from-indigo-100 via-blue-50 to-primary/10 dark:from-indigo-950 dark:via-slate-900 dark:to-primary/20"
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
              <span className="absolute -bottom-14 -left-12 size-40 rounded-full border-[24px] border-primary/30 dark:border-primary/10" />
              <div className="relative flex items-center gap-3 text-[#155fa8] dark:text-blue-300">
                <span className="grid size-11 place-items-center rounded-xl bg-white/75 shadow-sm dark:bg-white/10">
                  <BookOpen className="size-6" />
                </span>
                <span className="text-lg font-semibold tracking-wide">元我智脑</span>
              </div>
            </div>
          )}

          {course.scope === 'platform' && (
            <span className="absolute left-3 top-3 rounded-md bg-gradient-to-r from-blue-600 to-primary px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
              精品课程
            </span>
          )}
          {course.learningRequirement === 'required' && (
            <span className="absolute right-3 top-3 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
              必修{typeof course.pathPosition === 'number' ? ` · ${course.pathPosition + 1}` : ''}
            </span>
          )}
        </div>

        <div className="flex min-h-28 flex-col p-5">
          <h2
            className="line-clamp-2 text-lg font-semibold leading-7 transition-colors group-hover:text-primary dark:group-hover:text-primary/80 sm:text-xl"
            title={course.name}
          >
            {course.name}
          </h2>
          {popularityEnabled && course.learnerCount > 0 && (
            <span
              className="mt-auto inline-flex items-center justify-end gap-1.5 pt-3 text-sm text-slate-500 dark:text-slate-400"
              aria-label={`已有 ${course.learnerCount} 人开始学习`}
            >
              <UserRound className="size-4" aria-hidden="true" />
              <span aria-hidden="true">已有 {course.learnerCount} 人开始学习</span>
            </span>
          )}
        </div>
      </Link>
    </article>
  );
}
