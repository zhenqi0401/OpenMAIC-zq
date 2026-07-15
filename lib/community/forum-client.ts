import type { ForumAuthor, ForumPostStatus, ForumReplyStatus, ForumScope } from './forum';

export interface ForumClientPost {
  id: string;
  authorId: string;
  scope: ForumScope;
  courseId: string | null;
  courseName: string | null;
  title: string;
  body: string;
  status: ForumPostStatus;
  pinned: boolean;
  locked: boolean;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  author: ForumAuthor;
}

export interface ForumClientReply {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  status: ForumReplyStatus;
  createdAt: string;
  updatedAt: string;
  author: ForumAuthor;
}

export interface ForumCourseOption {
  id: string;
  name: string;
}

interface ApiErrorPayload {
  error?: unknown;
  details?: unknown;
}

export async function forumApi<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as (T & ApiErrorPayload) | null;
  if (!response.ok) {
    const message =
      (typeof payload?.error === 'string' && payload.error) ||
      (typeof payload?.details === 'string' && payload.details) ||
      `请求失败（${response.status}）`;
    throw new Error(message);
  }
  if (!payload) throw new Error('服务器返回了无效响应');
  return payload;
}

export function formatForumTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function wasForumContentEdited(createdAt: string, updatedAt: string): boolean {
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1_000;
}
