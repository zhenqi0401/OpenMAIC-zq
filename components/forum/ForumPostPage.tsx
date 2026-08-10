'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  Edit3,
  Lock,
  LockOpen,
  MessageCircle,
  Pin,
  PinOff,
  RefreshCw,
  Send,
  Shield,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { SessionIdentity } from '@/lib/auth/types';
import {
  FORUM_POST_MAX_LENGTH,
  FORUM_REPLY_MAX_DEPTH,
  FORUM_REPLY_MAX_LENGTH,
  FORUM_TITLE_MAX_LENGTH,
} from '@/lib/community/forum';
import {
  buildForumReplyTree,
  formatForumTime,
  forumApi,
  wasForumContentEdited,
  type ForumClientPost,
  type ForumClientReply,
  type ForumClientReplyNode,
} from '@/lib/community/forum-client';
import { ForumFrame } from './ForumFrame';

const REPLY_PAGE_SIZE = 20;

interface SessionResponse {
  authenticated: boolean;
  identity?: SessionIdentity;
}

export function ForumPostPage({ postId }: { postId: string }) {
  const router = useRouter();
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [post, setPost] = useState<ForumClientPost | null>(null);
  const [replies, setReplies] = useState<ForumClientReply[]>([]);
  const [replyPage, setReplyPage] = useState(1);
  const [replyTotal, setReplyTotal] = useState(0);
  const [replyRootTotal, setReplyRootTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [nestedReplyBody, setNestedReplyBody] = useState('');
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyBody, setEditReplyBody] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [session, postResult, replyResult] = await Promise.all([
        forumApi<SessionResponse>('/api/auth/session'),
        forumApi<{ post: ForumClientPost }>(`/api/forum/posts/${encodeURIComponent(postId)}`),
        forumApi<{ items: ForumClientReply[]; total: number; rootTotal: number }>(
          `/api/forum/posts/${encodeURIComponent(postId)}/replies?page=1&pageSize=${REPLY_PAGE_SIZE}`,
        ),
      ]);
      setIdentity(session.identity ?? null);
      setPost(postResult.post);
      setReplies(replyResult.items);
      setReplyTotal(replyResult.total);
      setReplyRootTotal(replyResult.rootTotal);
      setReplyPage(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '讨论加载失败');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadMoreReplies() {
    const nextPage = replyPage + 1;
    setPendingAction('load-more');
    try {
      const result = await forumApi<{
        items: ForumClientReply[];
        total: number;
        rootTotal: number;
      }>(
        `/api/forum/posts/${encodeURIComponent(postId)}/replies?page=${nextPage}&pageSize=${REPLY_PAGE_SIZE}`,
      );
      setReplies((current) => {
        const known = new Set(current.map((reply) => reply.id));
        return [...current, ...result.items.filter((reply) => !known.has(reply.id))];
      });
      setReplyTotal(result.total);
      setReplyRootTotal(result.rootTotal);
      setReplyPage(nextPage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '回复加载失败');
    } finally {
      setPendingAction(null);
    }
  }

  async function publishReply(body: string, parentReplyId: string | null) {
    return forumApi<{ reply: ForumClientReply }>(
      `/api/forum/posts/${encodeURIComponent(postId)}/replies`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, parentReplyId }),
      },
    );
  }

  function appendCreatedReply(reply: ForumClientReply) {
    setReplies((current) => [...current, reply]);
    setReplyTotal((current) => current + 1);
    if (!reply.parentReplyId) setReplyRootTotal((current) => current + 1);
    setPost((current) =>
      current
        ? {
            ...current,
            replyCount: current.replyCount + 1,
            lastActivityAt: reply.createdAt,
          }
        : current,
    );
  }

  async function submitTopLevelReply(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await publishReply(replyBody, null);
      appendCreatedReply(result.reply);
      setReplyBody('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '回复发布失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNestedReply(event: FormEvent, parent: ForumClientReply) {
    event.preventDefault();
    setSubmittingReplyId(parent.id);
    setError(null);
    try {
      const result = await publishReply(nestedReplyBody, parent.id);
      appendCreatedReply(result.reply);
      setReplyingToId(null);
      setNestedReplyBody('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '回复发布失败');
    } finally {
      setSubmittingReplyId(null);
    }
  }

  async function savePost() {
    setPendingAction('edit-post');
    try {
      const result = await forumApi<{ post: ForumClientPost }>(
        `/api/forum/posts/${encodeURIComponent(postId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: editTitle, body: editBody }),
        },
      );
      setPost(result.post);
      setEditingPost(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '帖子保存失败');
    } finally {
      setPendingAction(null);
    }
  }

  async function deletePost() {
    if (!window.confirm('确定删除这篇帖子吗？有回复时将保留讨论结构。')) return;
    setPendingAction('delete-post');
    try {
      const result = await forumApi<{ post: ForumClientPost }>(
        `/api/forum/posts/${encodeURIComponent(postId)}`,
        { method: 'DELETE' },
      );
      if (result.post.replyCount > 0) {
        setPost({ ...result.post, title: '原帖已由作者删除', body: '' });
      } else router.push('/forum?view=mine');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '帖子删除失败');
    } finally {
      setPendingAction(null);
    }
  }

  async function saveReply(replyId: string) {
    setPendingAction(`edit-reply-${replyId}`);
    try {
      const result = await forumApi<{ reply: ForumClientReply }>(
        `/api/forum/replies/${encodeURIComponent(replyId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: editReplyBody }),
        },
      );
      setReplies((current) =>
        current.map((reply) => (reply.id === replyId ? result.reply : reply)),
      );
      setEditingReplyId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '回复保存失败');
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteReply(replyId: string) {
    if (!window.confirm('确定删除这条回复吗？')) return;
    setPendingAction(`delete-reply-${replyId}`);
    try {
      const result = await forumApi<{ reply: ForumClientReply }>(
        `/api/forum/replies/${encodeURIComponent(replyId)}`,
        { method: 'DELETE' },
      );
      setReplies((current) =>
        current.map((reply) => (reply.id === replyId ? result.reply : reply)),
      );
      setReplyTotal((current) => Math.max(0, current - 1));
      setPost((current) =>
        current ? { ...current, replyCount: Math.max(0, current.replyCount - 1) } : current,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '回复删除失败');
    } finally {
      setPendingAction(null);
    }
  }

  async function moderatePost(action: 'hide' | 'restore' | 'pin' | 'unpin' | 'lock' | 'unlock') {
    if (action === 'hide' && !window.confirm('确定隐藏这篇帖子吗？隐藏后普通用户将无法查看。'))
      return;
    const reason = window.prompt('请输入本次管理操作原因（可留空）：', '');
    if (reason === null) return;
    setPendingAction(`moderate-${action}`);
    try {
      const result = await forumApi<{ post: ForumClientPost }>(
        `/api/admin/forum/posts/${encodeURIComponent(postId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason }),
        },
      );
      setPost(result.post);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '管理操作失败');
    } finally {
      setPendingAction(null);
    }
  }

  async function moderateReply(replyId: string, action: 'hide' | 'restore') {
    if (action === 'hide' && !window.confirm('确定隐藏这条回复吗？')) return;
    const reason = window.prompt('请输入本次管理操作原因（可留空）：', '');
    if (reason === null) return;
    setPendingAction(`${action}-reply-${replyId}`);
    try {
      const result = await forumApi<{ reply: ForumClientReply }>(
        `/api/admin/forum/replies/${encodeURIComponent(replyId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason }),
        },
      );
      setReplies((current) =>
        current.map((reply) => (reply.id === replyId ? result.reply : reply)),
      );
      setReplyTotal((current) => (action === 'hide' ? Math.max(0, current - 1) : current + 1));
      setPost((current) =>
        current
          ? {
              ...current,
              replyCount:
                action === 'hide' ? Math.max(0, current.replyCount - 1) : current.replyCount + 1,
            }
          : current,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '回复管理操作失败');
    } finally {
      setPendingAction(null);
    }
  }

  const replyTree = useMemo(() => buildForumReplyTree(replies), [replies]);
  const loadedRootCount = replyTree.length;
  const ownsPost = Boolean(identity && post && identity.userId === post.authorId);

  function renderReply(reply: ForumClientReplyNode): ReactNode {
    const ownsReply = identity?.userId === reply.authorId;
    const deletedByAuthor = reply.status === 'deleted_by_author';
    const hiddenByAdmin = reply.status === 'hidden';
    const deletedByAdmin = reply.status === 'deleted_by_admin';
    const unavailableByAdmin = hiddenByAdmin || deletedByAdmin;
    const canReply =
      post?.status === 'visible' &&
      !post.locked &&
      reply.status === 'visible' &&
      reply.depth < FORUM_REPLY_MAX_DEPTH;

    return (
      <article
        key={reply.id}
        className={
          reply.depth === 1
            ? 'py-5'
            : 'mt-4 border-l border-primary/20 pl-3 dark:border-primary/30 md:pl-5'
        }
      >
        <div className="flex gap-3 sm:gap-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary dark:bg-primary/20 dark:text-primary sm:size-9">
            {reply.author.displayName.slice(0, 1) || '用'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {reply.author.displayName}{' '}
                <span className="ml-1 text-[11px] font-normal text-slate-400">
                  {reply.author.roleName} · 第 {reply.depth} 层
                </span>
              </p>
              <time className="text-[11px] text-slate-400">
                {formatForumTime(reply.createdAt)}
                {wasForumContentEdited(reply.createdAt, reply.updatedAt) && ' · 已编辑'}
              </time>
            </div>

            {editingReplyId === reply.id ? (
              <div className="mt-3">
                <Textarea
                  value={editReplyBody}
                  maxLength={FORUM_REPLY_MAX_LENGTH}
                  onChange={(event) => setEditReplyBody(event.target.value)}
                  className="min-h-24"
                  aria-label="编辑回复"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingReplyId(null)}>
                    取消
                  </Button>
                  <Button
                    size="sm"
                    disabled={!editReplyBody.trim() || pendingAction === `edit-reply-${reply.id}`}
                    onClick={() => void saveReply(reply.id)}
                  >
                    保存
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-300">
                {deletedByAuthor ? (
                  <span className="italic text-slate-400">该回复已由作者删除</span>
                ) : unavailableByAdmin ? (
                  <span className="italic text-amber-700 dark:text-amber-300">
                    {deletedByAdmin ? '该回复已被管理员删除' : '该回复已被管理员隐藏'}
                  </span>
                ) : (
                  reply.body
                )}
              </p>
            )}

            {editingReplyId !== reply.id && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {canReply && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setReplyingToId(reply.id);
                      setNestedReplyBody('');
                    }}
                  >
                    <MessageCircle className="size-3" />
                    回复
                  </Button>
                )}
                {reply.status === 'visible' && reply.depth >= FORUM_REPLY_MAX_DEPTH && (
                  <span className="px-2 text-[11px] text-slate-400">已达到最多 5 层</span>
                )}
                {ownsReply && reply.status === 'visible' && (
                  <>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setEditingReplyId(reply.id);
                        setEditReplyBody(reply.body);
                      }}
                    >
                      <Edit3 className="size-3" />
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-red-600"
                      onClick={() => void deleteReply(reply.id)}
                    >
                      <Trash2 className="size-3" />
                      删除
                    </Button>
                  </>
                )}
                {identity?.isAdmin && !ownsReply && reply.status === 'visible' && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-red-600"
                    onClick={() => void moderateReply(reply.id, 'hide')}
                  >
                    <Shield className="size-3" />
                    隐藏
                  </Button>
                )}
                {identity?.isAdmin && unavailableByAdmin && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => void moderateReply(reply.id, 'restore')}
                  >
                    <Shield className="size-3" />
                    恢复
                  </Button>
                )}
              </div>
            )}

            {replyingToId === reply.id && canReply && (
              <form
                onSubmit={(event) => void submitNestedReply(event, reply)}
                className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 dark:border-primary/30 dark:bg-primary/20"
              >
                <p className="mb-2 text-xs text-slate-500">
                  回复 @{reply.author.displayName}，将作为第 {reply.depth + 1} 层回复发布
                </p>
                <Textarea
                  autoFocus
                  value={nestedReplyBody}
                  required
                  maxLength={FORUM_REPLY_MAX_LENGTH}
                  onChange={(event) => setNestedReplyBody(event.target.value)}
                  placeholder={`回复 @${reply.author.displayName}`}
                  className="min-h-20 resize-y bg-white dark:bg-card-solid"
                  aria-label={`回复 ${reply.author.displayName}`}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">
                    {nestedReplyBody.length}/{FORUM_REPLY_MAX_LENGTH}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setReplyingToId(null);
                        setNestedReplyBody('');
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={submittingReplyId === reply.id || !nestedReplyBody.trim()}
                    >
                      {submittingReplyId === reply.id ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      {submittingReplyId === reply.id ? '正在回复' : '发布回复'}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>

        {reply.children.length > 0 && (
          <div>{reply.children.map((child) => renderReply(child))}</div>
        )}
      </article>
    );
  }

  return (
    <ForumFrame>
      <main className="mx-auto w-[min(920px,calc(100%-2rem))] py-9 md:w-[min(920px,calc(100%-3rem))] md:py-12">
        <Button asChild variant="ghost" size="sm" className="mb-5 -ml-2 text-slate-500">
          <Link
            href={
              post?.courseId
                ? `/forum?view=course&courseId=${encodeURIComponent(post.courseId)}`
                : '/forum'
            }
          >
            <ArrowLeft className="size-4" />
            返回讨论列表
          </Link>
        </Button>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300"
          >
            {error}
          </div>
        )}
        {loading ? (
          <div className="space-y-4">
            <div className="h-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-36 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
        ) : !post ? (
          <div className="py-20 text-center">
            <MessageCircle className="mx-auto size-8 text-slate-300" />
            <h1 className="mt-4 text-xl font-semibold">无法打开这个讨论</h1>
            <p className="mt-2 text-sm text-slate-500">
              内容可能已删除，或你没有关联课程的访问权限。
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link href="/forum">返回交流区</Link>
            </Button>
          </div>
        ) : (
          <>
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card-solid sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                {post.pinned && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    <Pin className="size-3" />
                    置顶
                  </span>
                )}
                {post.locked && (
                  <span className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Lock className="size-3" />
                    已关闭回复
                  </span>
                )}
                {post.courseName && (
                  <Link
                    href={`/forum?view=course&courseId=${encodeURIComponent(post.courseId ?? '')}`}
                    className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 hover:underline dark:bg-emerald-950/60 dark:text-emerald-300"
                  >
                    <BookOpen className="size-3" />
                    {post.courseName}
                  </Link>
                )}
              </div>

              {editingPost ? (
                <div className="mt-5 grid gap-4">
                  <Input
                    value={editTitle}
                    maxLength={FORUM_TITLE_MAX_LENGTH}
                    onChange={(event) => setEditTitle(event.target.value)}
                    aria-label="帖子标题"
                  />
                  <Textarea
                    value={editBody}
                    maxLength={FORUM_POST_MAX_LENGTH}
                    onChange={(event) => setEditBody(event.target.value)}
                    className="min-h-44 resize-y"
                    aria-label="帖子正文"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setEditingPost(false)}>
                      取消
                    </Button>
                    <Button
                      disabled={
                        !editTitle.trim() || !editBody.trim() || pendingAction === 'edit-post'
                      }
                      onClick={() => void savePost()}
                    >
                      {pendingAction === 'edit-post' && (
                        <RefreshCw className="size-4 animate-spin" />
                      )}
                      保存修改
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">
                    {post.title}
                  </h1>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3.5" />
                      {post.author.displayName} · {post.author.roleName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3.5" />
                      {formatForumTime(post.createdAt)}
                      {wasForumContentEdited(post.createdAt, post.updatedAt) && ' · 已编辑'}
                    </span>
                  </div>
                  <div className="mt-7 whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-700 dark:text-slate-300">
                    {post.body || <span className="italic text-slate-400">原帖已由作者删除</span>}
                  </div>
                </>
              )}

              {!editingPost && (post.status === 'visible' || identity?.isAdmin) && (
                <div className="mt-7 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  {ownsPost && post.status === 'visible' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditTitle(post.title);
                          setEditBody(post.body);
                          setEditingPost(true);
                        }}
                      >
                        <Edit3 className="size-3.5" />
                        编辑
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={pendingAction === 'delete-post'}
                        onClick={() => void deletePost()}
                      >
                        <Trash2 className="size-3.5" />
                        删除
                      </Button>
                    </>
                  )}
                  {identity?.isAdmin && post.status === 'visible' && (
                    <div className="ml-auto flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void moderatePost(post.pinned ? 'unpin' : 'pin')}
                      >
                        {post.pinned ? (
                          <PinOff className="size-3.5" />
                        ) : (
                          <Pin className="size-3.5" />
                        )}
                        {post.pinned ? '取消置顶' : '置顶'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void moderatePost(post.locked ? 'unlock' : 'lock')}
                      >
                        {post.locked ? (
                          <LockOpen className="size-3.5" />
                        ) : (
                          <Lock className="size-3.5" />
                        )}
                        {post.locked ? '重新开放' : '关闭回复'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void moderatePost('hide')}
                      >
                        <Shield className="size-3.5" />
                        隐藏
                      </Button>
                    </div>
                  )}
                  {identity?.isAdmin && post.status === 'hidden' && (
                    <div className="ml-auto flex items-center gap-3">
                      <span className="text-xs text-amber-700 dark:text-amber-300">此帖已隐藏</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void moderatePost('restore')}
                      >
                        <Shield className="size-3.5" />
                        恢复显示
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </article>

            <section className="mt-8" aria-labelledby="replies-title">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <h2 id="replies-title" className="text-lg font-semibold">
                  全部回复 <span className="font-mono text-sm text-slate-400">{replyTotal}</span>
                </h2>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {replyTree.map((reply) => renderReply(reply))}
              </div>
              {loadedRootCount < replyRootTotal && (
                <div className="border-t border-slate-200 pt-4 text-center dark:border-slate-800">
                  <Button
                    variant="outline"
                    disabled={pendingAction === 'load-more'}
                    onClick={() => void loadMoreReplies()}
                  >
                    {pendingAction === 'load-more' && <RefreshCw className="size-4 animate-spin" />}
                    加载更多回复
                  </Button>
                </div>
              )}
              {!replyTree.length && (
                <div className="py-10 text-center text-sm text-slate-500">
                  还没有回复，来分享你的看法吧。
                </div>
              )}
            </section>

            <section
              className="mt-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-card-solid"
              aria-labelledby="reply-form-title"
            >
              <h2 id="reply-form-title" className="font-semibold">
                参与讨论
              </h2>
              {post.locked || post.status !== 'visible' ? (
                <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500">
                  <Lock className="size-4" />
                  该帖子已关闭，暂时不能新增回复。
                </p>
              ) : (
                <form onSubmit={submitTopLevelReply} className="mt-4">
                  <Textarea
                    value={replyBody}
                    required
                    maxLength={FORUM_REPLY_MAX_LENGTH}
                    onChange={(event) => setReplyBody(event.target.value)}
                    placeholder="写下你的回复"
                    className="min-h-28 resize-y"
                    aria-label="回复内容"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {replyBody.length}/{FORUM_REPLY_MAX_LENGTH}
                    </span>
                    <Button type="submit" disabled={submitting || !replyBody.trim()}>
                      {submitting ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      {submitting ? '正在回复' : '发布回复'}
                    </Button>
                  </div>
                </form>
              )}
            </section>
          </>
        )}
      </main>
    </ForumFrame>
  );
}
