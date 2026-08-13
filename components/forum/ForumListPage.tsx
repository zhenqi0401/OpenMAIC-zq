'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  Pagination,
  Segmented,
  Select,
  Skeleton,
  Space,
} from 'antd';
import { BookOpen, Clock3, Eye, Lock, MessageCircle, PenLine, Pin, Send } from 'lucide-react';
import { getDisplayNameInitial } from '@/components/home/LearnerHeader';
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
const { TextArea } = Input;
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

function ForumTopic({ post, mobile = false }: { post: ForumClientPost; mobile?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        {post.pinned && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <Pin className="size-3" />
            置顶
          </span>
        )}
        {post.locked && (
          <span className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Lock className="size-3" />
            已关闭
          </span>
        )}
        {post.courseName && (
          <span className="inline-flex max-w-full items-center gap-1 truncate rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <BookOpen className="size-3" />
            {post.courseName}
          </span>
        )}
      </div>
      <h3
        className={cn(
          'font-semibold group-hover:text-primary dark:group-hover:text-primary/80',
          mobile ? 'line-clamp-2 text-lg' : 'truncate text-lg',
        )}
      >
        {post.title}
      </h3>
      <p
        className={cn(
          'mt-1.5 whitespace-pre-wrap text-slate-600 dark:text-slate-400',
          mobile ? 'line-clamp-2 text-base leading-7' : 'line-clamp-1 text-sm leading-6',
        )}
      >
        {post.body || '原帖内容已删除，回复仍保留。'}
      </p>
    </div>
  );
}

function ForumAuthorCell({ post }: { post: ForumClientPost }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary dark:bg-primary/20 dark:text-primary">
        {getDisplayNameInitial(post.author.displayName)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{post.author.displayName}</span>
        <span className="block truncate text-xs text-slate-400">{post.author.roleName}</span>
      </span>
    </span>
  );
}

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
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composing, setComposing] = useState(composeRequested);
  const [submitting, setSubmitting] = useState(false);
  const [composerWidth, setComposerWidth] = useState(560);
  const [form] = Form.useForm<{
    scope: 'global' | 'course';
    courseId?: string;
    title: string;
    body: string;
  }>();
  const scope = Form.useWatch('scope', form) ?? 'global';

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
      form.setFieldValue('scope', 'course');
      form.setFieldValue('courseId', courseId);
    }
  }, [composeRequested, courseId, form]);

  useEffect(() => {
    const updateComposerWidth = () => setComposerWidth(Math.min(560, document.body.clientWidth));
    updateComposerWidth();
    window.addEventListener('resize', updateComposerWidth);
    return () => window.removeEventListener('resize', updateComposerWidth);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCourse = useMemo(
    () => courses.find((course) => course.id === courseId),
    [courseId, courses],
  );

  const closeComposer = useCallback(() => {
    setComposing(false);
    setComposeError(null);
    if (composeRequested) setQuery({ compose: null });
  }, [composeRequested, setQuery]);

  async function submitPost(values: {
    scope: 'global' | 'course';
    courseId?: string;
    title: string;
    body: string;
  }) {
    setSubmitting(true);
    setComposeError(null);
    try {
      const result = await forumApi<{ post: ForumClientPost }>('/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: values.scope,
          courseId: values.scope === 'course' ? values.courseId : null,
          title: values.title,
          body: values.body,
        }),
      });
      router.push(`/forum/posts/${result.post.id}`);
    } catch (cause) {
      setComposeError(cause instanceof Error ? cause.message : '发布失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ForumFrame>
      <main className="mx-auto w-[min(1600px,calc(100%-1.25rem))] py-7 sm:w-[min(1600px,calc(100%-2rem))] md:py-10">
        <section className="flex flex-col gap-5 border-b border-slate-200 pb-8 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">学习交流区</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              分享学习心得、提出问题，并围绕课程继续讨论。
            </p>
          </div>
          <Button
            onClick={() => setComposing(true)}
            type="primary"
            size="large"
            icon={<PenLine className="size-4" />}
          >
            发布讨论
          </Button>
        </section>

        <Drawer
          open={composing}
          onClose={closeComposer}
          placement="right"
          width={composerWidth}
          styles={{
            section: {
              width: '100%',
              minWidth: 0,
              maxWidth: '100%',
              boxSizing: 'border-box',
              overflow: 'hidden',
            },
            body: {
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              overflowX: 'hidden',
              padding: composerWidth < 576 ? 16 : 24,
            },
            footer: {
              width: '100%',
              boxSizing: 'border-box',
              padding: composerWidth < 576 ? '12px 16px' : '12px 24px',
            },
          }}
          title="发布讨论"
          destroyOnHidden
          footer={
            <div className="flex justify-end">
              <Space>
                <Button onClick={closeComposer}>取消</Button>
                <Button
                  htmlType="submit"
                  type="primary"
                  loading={submitting}
                  icon={<Send className="size-4" />}
                  form="forum-compose-form"
                >
                  {submitting ? '正在发布' : '立即发布'}
                </Button>
              </Space>
            </div>
          }
        >
          <Form
            id="forum-compose-form"
            form={form}
            onFinish={submitPost}
            layout="vertical"
            size="large"
            requiredMark={false}
            scrollToFirstError={{ focus: true }}
            initialValues={{
              scope: courseId ? 'course' : 'global',
              courseId: courseId || undefined,
            }}
            className="w-full min-w-0 max-w-full"
          >
            <Form.Item
              name="scope"
              className="mb-5"
              rules={[{ required: true, message: '请选择讨论范围' }]}
            >
              <Segmented
                block
                aria-label="讨论范围"
                className="max-w-full"
                options={[
                  { value: 'global', label: '全局讨论' },
                  { value: 'course', label: '关联课程' },
                ]}
              />
            </Form.Item>
            {scope === 'course' && (
              <Form.Item
                name="courseId"
                label="关联课程"
                dependencies={['scope']}
                rules={[{ required: true, message: '请选择要关联的课程' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  allowClear
                  className="w-full max-w-full"
                  placeholder="请选择当前可见课程"
                  options={courses.map((course) => ({ value: course.id, label: course.name }))}
                />
              </Form.Item>
            )}
            <Form.Item
              name="title"
              label="标题"
              className="mb-5"
              rules={[{ required: true, message: '请输入标题' }]}
            >
              <Input
                maxLength={FORUM_TITLE_MAX_LENGTH}
                showCount
                allowClear
                className="max-w-full"
                placeholder="清晰概括你想讨论的内容"
              />
            </Form.Item>
            <Form.Item
              name="body"
              label="正文"
              className="mb-0"
              rules={[{ required: true, message: '请输入正文' }]}
            >
              <TextArea
                maxLength={FORUM_POST_MAX_LENGTH}
                showCount
                placeholder="写下你的观点、问题或学习心得"
                autoSize={{ minRows: 6, maxRows: 12 }}
                className="max-w-full"
              />
            </Form.Item>
            {composeError && <Alert type="error" showIcon message={composeError} />}
          </Form>
        </Drawer>

        <div className="mt-7">
          <aside className="flex flex-col gap-3 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <Segmented
              aria-label="讨论分类"
              onChange={(value) =>
                setQuery({
                  view: value === 'all' ? null : (value as ForumView),
                  page: null,
                  courseId: value === 'course' ? courseId : null,
                })
              }
              options={VIEWS.map((item) => ({ value: item.value, label: item.label }))}
              value={view}
            />
            {view === 'course' && (
              <label className="grid gap-2 text-sm font-medium text-slate-500 sm:min-w-64">
                按课程筛选
                <Select
                  value={courseId}
                  onChange={(value) => setQuery({ courseId: value || null, page: null })}
                  className="min-w-0 sm:min-w-64"
                  options={[
                    { value: '', label: '全部课程' },
                    ...courses.map((course) => ({ value: course.id, label: course.name })),
                  ]}
                />
              </label>
            )}
          </aside>

          <section className="mt-7 min-w-0" aria-labelledby="forum-list-title">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
              <div>
                <h2 id="forum-list-title" className="text-2xl font-semibold">
                  {activeCourse
                    ? `${activeCourse.name} · 课程讨论`
                    : VIEWS.find((item) => item.value === view)?.label}
                </h2>
                {!loading && !error && (
                  <p className="mt-1 text-sm text-slate-500">共 {total} 个讨论</p>
                )}
              </div>
              <Segmented
                aria-label="帖子排序"
                onChange={(value) =>
                  setQuery({ sort: value === 'latest' ? null : (value as ForumSort), page: null })
                }
                options={[
                  { value: 'latest', label: '最新发布' },
                  { value: 'activity', label: '最后回复' },
                ]}
                value={sort}
              />
            </div>

            {error && (
              <Alert
                className="mt-5"
                type="error"
                showIcon
                message={error}
                action={
                  <Button type="link" onClick={() => void loadPosts()}>
                    重试
                  </Button>
                }
              />
            )}
            {loading ? (
              <div className="grid gap-3 py-5" aria-label="正在加载讨论">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} active paragraph={{ rows: 2 }} />
                ))}
              </div>
            ) : posts.length ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-card-solid">
                <div className="hidden grid-cols-[minmax(260px,1fr)_180px_88px_88px_160px] items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 lg:grid">
                  <span>话题</span>
                  <span>用户</span>
                  <span className="text-center">回复</span>
                  <span className="text-center">浏览量</span>
                  <span>发布时间</span>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {posts.map((post) => (
                    <article key={post.id}>
                      <Link
                        href={`/forum/posts/${post.id}`}
                        className="group block px-4 py-5 outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:hover:bg-primary/20 sm:px-5"
                      >
                        <div className="hidden grid-cols-[minmax(260px,1fr)_180px_88px_88px_160px] items-center gap-4 lg:grid">
                          <ForumTopic post={post} />
                          <ForumAuthorCell post={post} />
                          <span
                            className="text-center font-mono text-base text-slate-600 dark:text-slate-300"
                            aria-label={`${post.replyCount} 条回复`}
                          >
                            {post.replyCount}
                          </span>
                          <span
                            className="text-center font-mono text-base text-slate-600 dark:text-slate-300"
                            aria-label={`${post.viewCount} 次浏览`}
                          >
                            {post.viewCount}
                          </span>
                          <time
                            className="text-sm text-slate-500 dark:text-slate-400"
                            dateTime={post.createdAt}
                          >
                            {formatForumTime(post.createdAt)}
                          </time>
                        </div>

                        <div className="lg:hidden">
                          <ForumTopic post={post} mobile />
                          <div className="mt-4">
                            <ForumAuthorCell post={post} />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1.5">
                              <MessageCircle className="size-4" /> {post.replyCount} 回复
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Eye className="size-4" /> {post.viewCount} 浏览
                            </span>
                            <time
                              className="inline-flex items-center gap-1.5"
                              dateTime={post.createdAt}
                            >
                              <Clock3 className="size-4" /> {formatForumTime(post.createdAt)}
                            </time>
                          </div>
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            ) : !error ? (
              <Empty className="py-16" description="这里还没有讨论，发布第一个帖子开始交流吧。" />
            ) : null}

            {!loading && totalPages > 1 && (
              <nav
                className="mt-6 flex justify-end border-t border-slate-200 pt-5 dark:border-slate-800"
                aria-label="帖子分页"
              >
                <Pagination
                  current={page}
                  pageSize={PAGE_SIZE}
                  showSizeChanger={false}
                  total={total}
                  onChange={(nextPage) =>
                    setQuery({ page: nextPage > 1 ? String(nextPage) : null })
                  }
                />
              </nav>
            )}
          </section>
        </div>
      </main>
    </ForumFrame>
  );
}
