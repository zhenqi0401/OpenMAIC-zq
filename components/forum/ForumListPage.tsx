'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Lock,
  MessageCircle,
  PenLine,
  Pin,
  RefreshCw,
  Send,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  FORUM_POST_MAX_LENGTH,
  FORUM_TITLE_MAX_LENGTH,
  type ForumSort,
} from '@/lib/community/forum';
import {
  formatForumTime,
  forumApi,
  type ForumClientPost,
  type ForumCourseOption,
} from '@/lib/community/forum-client';
import { ForumFrame } from './ForumFrame';

type ForumView = 'all' | 'course' | 'mine';
const PAGE_SIZE = 10;

interface ListResponse {
  items: ForumClientPost[];
  total: number;
  page: number;
  pageSize: number;
}

interface CoursesResponse {
  courses?: Array<{ id: string; name: string }>;
}

const VIEWS: Array<{ value: ForumView; label: string }> = [
  { value: 'all', label: '全部讨论' },
  { value: 'course', label: '课程讨论' },
  { value: 'mine', label: '我发布的' },
];

export function ForumListPage() {
  const router = useRouter();
  const search = useSearchParams();
  const view = (
    ['all', 'course', 'mine'].includes(search.get('view') ?? '') ? search.get('view') : 'all'
  ) as ForumView;
  const sort = (search.get('sort') === 'activity' ? 'activity' : 'latest') as ForumSort;
  const courseId = search.get('courseId') ?? '';
  const page = Math.max(1, Number(search.get('page')) || 1);
  const composeRequested = search.get('compose') === 'true';
  const [posts, setPosts] = useState<ForumClientPost[]>([]);
  const [total, setTotal] = useState(0);
  const [courses, setCourses] = useState<ForumCourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(composeRequested);
  const [scope, setScope] = useState<'global' | 'course'>(courseId ? 'course' : 'global');
  const [draftCourseId, setDraftCourseId] = useState(courseId);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setQuery = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(search.toString());
      Object.entries(changes).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      router.push(`/forum${next.size ? `?${next.toString()}` : ''}`);
    },
    [router, search],
  );

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ sort, page: String(page), pageSize: String(PAGE_SIZE) });
    if (view === 'course') params.set('scope', 'course');
    if (view === 'mine') params.set('mine', 'true');
    if (courseId) params.set('courseId', courseId);
    try {
      const result = await forumApi<ListResponse>(`/api/forum/posts?${params.toString()}`);
      setPosts(result.items);
      setTotal(result.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '讨论加载失败');
    } finally {
      setLoading(false);
    }
  }, [courseId, page, sort, view]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    void forumApi<CoursesResponse>('/api/courses')
      .then((result) => setCourses(result.courses?.map(({ id, name }) => ({ id, name })) ?? []))
      .catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    if (composeRequested) setComposing(true);
    if (courseId) {
      setScope('course');
      setDraftCourseId(courseId);
    }
  }, [composeRequested, courseId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCourse = useMemo(
    () => courses.find((course) => course.id === courseId),
    [courseId, courses],
  );

  async function submitPost(event: FormEvent) {
    event.preventDefault();
    if (scope === 'course' && !draftCourseId) {
      setError('请选择要关联的课程');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await forumApi<{ post: ForumClientPost }>('/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          courseId: scope === 'course' ? draftCourseId : null,
          title,
          body,
        }),
      });
      router.push(`/forum/posts/${result.post.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '发布失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ForumFrame>
      <main className="mx-auto w-[min(1120px,calc(100%-2rem))] py-10 md:w-[min(1120px,calc(100%-3rem))] md:py-14">
        <section className="flex flex-col gap-5 border-b border-[#d9dce3] pb-8 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 font-mono text-[11px] font-semibold text-violet-600 dark:text-violet-300">
              COMMUNITY
            </p>
            <h1 className="text-3xl font-semibold">学习交流区</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              分享学习心得、提出问题，并围绕课程继续讨论。
            </p>
          </div>
          <Button
            onClick={() => setComposing((value) => !value)}
            className="bg-violet-600 text-white hover:bg-violet-700"
          >
            <PenLine className="size-4" />
            {composing ? '收起发帖' : '发布讨论'}
          </Button>
        </section>

        {composing && (
          <form
            onSubmit={submitPost}
            className="mt-7 rounded-xl border border-violet-200 bg-white p-5 shadow-sm dark:border-violet-900 dark:bg-[#1a1d25] sm:p-6"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="帖子类型">
                {(['global', 'course'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={scope === value}
                    onClick={() => setScope(value)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs transition-colors',
                      scope === value
                        ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200'
                        : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300',
                    )}
                  >
                    {value === 'global' ? '全局讨论' : '关联课程'}
                  </button>
                ))}
              </div>
              {scope === 'course' && (
                <label className="grid gap-1.5 text-sm font-medium">
                  关联课程
                  <select
                    value={draftCourseId}
                    required
                    onChange={(event) => setDraftCourseId(event.target.value)}
                    className="h-10 rounded-md border border-[#d9dce3] bg-white px-3 text-sm dark:border-slate-700 dark:bg-[#12141a]"
                  >
                    <option value="">请选择当前可见课程</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="grid gap-1.5 text-sm font-medium">
                标题
                <Input
                  value={title}
                  required
                  maxLength={FORUM_TITLE_MAX_LENGTH}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="清晰概括你想讨论的内容"
                />
                <span className="text-right text-[11px] font-normal text-slate-400">
                  {title.length}/{FORUM_TITLE_MAX_LENGTH}
                </span>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                正文
                <Textarea
                  value={body}
                  required
                  maxLength={FORUM_POST_MAX_LENGTH}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="写下你的观点、问题或学习心得"
                  className="min-h-36 resize-y"
                />
                <span className="text-right text-[11px] font-normal text-slate-400">
                  {body.length}/{FORUM_POST_MAX_LENGTH}
                </span>
              </label>
              <div className="flex justify-end">
                <Button type="submit" disabled={submitting || !title.trim() || !body.trim()}>
                  {submitting ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {submitting ? '正在发布' : '立即发布'}
                </Button>
              </div>
            </div>
          </form>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)]">
          <aside>
            <nav className="grid gap-1" aria-label="讨论分类">
              {VIEWS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() =>
                    setQuery({
                      view: item.value === 'all' ? null : item.value,
                      page: null,
                      courseId: item.value === 'course' ? courseId : null,
                    })
                  }
                  className={cn(
                    'rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    view === item.value
                      ? 'bg-violet-100 font-semibold text-violet-800 dark:bg-violet-950/60 dark:text-violet-200'
                      : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            {view === 'course' && (
              <label className="mt-5 grid gap-2 text-xs font-medium text-slate-500">
                按课程筛选
                <select
                  value={courseId}
                  onChange={(event) =>
                    setQuery({ courseId: event.target.value || null, page: null })
                  }
                  className="h-10 min-w-0 rounded-md border border-[#d9dce3] bg-white px-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-[#1a1d25] dark:text-slate-100"
                >
                  <option value="">全部课程</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </aside>

          <section className="min-w-0" aria-labelledby="forum-list-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9dce3] pb-4 dark:border-slate-800">
              <div>
                <h2 id="forum-list-title" className="text-xl font-semibold">
                  {activeCourse
                    ? `${activeCourse.name} · 课程讨论`
                    : VIEWS.find((item) => item.value === view)?.label}
                </h2>
                {!loading && !error && (
                  <p className="mt-1 text-xs text-slate-500">共 {total} 个讨论</p>
                )}
              </div>
              <div
                className="inline-flex rounded-md border border-[#d9dce3] bg-white p-0.5 dark:border-slate-700 dark:bg-[#1a1d25]"
                role="group"
                aria-label="帖子排序"
              >
                {(
                  [
                    ['latest', '最新发布'],
                    ['activity', '最后回复'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={sort === value}
                    onClick={() =>
                      setQuery({ sort: value === 'latest' ? null : value, page: null })
                    }
                    className={cn(
                      'rounded px-3 py-1.5 text-xs',
                      sort === value
                        ? 'bg-violet-100 font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-200'
                        : 'text-slate-500',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300"
              >
                {error}{' '}
                <button type="button" onClick={() => void loadPosts()} className="ml-2 underline">
                  重试
                </button>
              </div>
            )}
            {loading ? (
              <div className="grid gap-3 py-5" aria-label="正在加载讨论">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    className="h-32 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800"
                  />
                ))}
              </div>
            ) : posts.length ? (
              <div className="divide-y divide-[#e1e3e8] dark:divide-slate-800">
                {posts.map((post) => (
                  <article key={post.id} className="py-5">
                    <Link
                      href={`/forum/posts/${post.id}`}
                      className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-[#12141a]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            {post.pinned && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                <Pin className="size-3" />
                                置顶
                              </span>
                            )}
                            {post.locked && (
                              <span className="inline-flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                <Lock className="size-3" />
                                已关闭
                              </span>
                            )}
                            {post.courseName && (
                              <span className="inline-flex max-w-full items-center gap-1 truncate rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <BookOpen className="size-3" />
                                {post.courseName}
                              </span>
                            )}
                          </div>
                          <h3 className="truncate text-base font-semibold group-hover:text-violet-700 dark:group-hover:text-violet-300">
                            {post.title}
                          </h3>
                          <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-400">
                            {post.body || '原帖内容已删除，回复仍保留。'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500 dark:bg-slate-800">
                          <MessageCircle className="mr-1 inline size-3.5" />
                          {post.replyCount}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="size-3" />
                          {post.author.displayName} · {post.author.roleName}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="size-3" />
                          {sort === 'activity' ? '最后活动' : '发布于'}{' '}
                          {formatForumTime(
                            sort === 'activity' ? post.lastActivityAt : post.createdAt,
                          )}
                        </span>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            ) : !error ? (
              <div className="py-16 text-center">
                <MessageCircle className="mx-auto size-8 text-slate-300" />
                <p className="mt-3 font-medium">这里还没有讨论</p>
                <p className="mt-1 text-sm text-slate-500">发布第一个帖子，开始交流吧。</p>
              </div>
            ) : null}

            {!loading && totalPages > 1 && (
              <nav
                className="mt-6 flex items-center justify-between border-t border-[#d9dce3] pt-5 text-sm dark:border-slate-800"
                aria-label="帖子分页"
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setQuery({ page: page > 2 ? String(page - 1) : null })}
                >
                  <ChevronLeft className="size-4" />
                  上一页
                </Button>
                <span className="text-xs text-slate-500">
                  第 {page} / {totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setQuery({ page: String(page + 1) })}
                >
                  下一页
                  <ChevronRight className="size-4" />
                </Button>
              </nav>
            )}
          </section>
        </div>
      </main>
    </ForumFrame>
  );
}
