export type CommunityContentType = 'danmaku' | 'posts' | 'replies' | 'audit';

export type CommunityModerationAction =
  | 'hide'
  | 'restore'
  | 'delete'
  | 'pin'
  | 'unpin'
  | 'lock'
  | 'unlock';

export interface AdminCommunityItem {
  id: string;
  status?: string;
  content?: string;
  title?: string;
  body?: string;
  postId?: string;
  postTitle?: string;
  courseId?: string | null;
  courseName?: string | null;
  sceneKey?: string;
  actionOffsetMs?: number;
  actionId?: string;
  pinned?: boolean;
  locked?: boolean;
  replyCount?: number;
  targetType?: string;
  targetId?: string;
  action?: string;
  reason?: string | null;
  moderationReason?: string | null;
  createdAt: string;
  author?: { id: string; displayName: string; roleName: string; roleCode: string };
  moderator?: { id: string; displayName: string };
}

export const COMMUNITY_STATUS_LABELS = {
  visible: '可见',
  hidden: '已隐藏',
  deleted_by_author: '作者已删除',
  deleted_by_admin: '管理员已删除',
  archived: '已归档',
} as const;

export const COMMUNITY_TARGET_LABELS = {
  danmaku: '弹幕',
  forum_post: '帖子',
  forum_reply: '回复',
} as const;

export const COMMUNITY_ACTION_LABELS = {
  hide: '隐藏',
  restore: '恢复',
  delete: '删除',
  pin: '置顶',
  unpin: '取消置顶',
  lock: '关闭回复',
  unlock: '重新开放回复',
} as const;

export const COMMUNITY_REASON_PRESETS = [
  '广告营销',
  '人身攻击',
  '无关内容',
  '违规信息',
  '其他',
] as const;

const COMMUNITY_TABS: Array<{ value: CommunityContentType; label: string }> = [
  { value: 'posts', label: '帖子' },
  { value: 'replies', label: '回复' },
  { value: 'danmaku', label: '弹幕' },
  { value: 'audit', label: '操作审计' },
];

export function availableCommunityTabs(danmakuEnabled: boolean, forumEnabled: boolean) {
  return COMMUNITY_TABS.filter(
    (tab) => tab.value === 'audit' || (tab.value === 'danmaku' ? danmakuEnabled : forumEnabled),
  );
}

function mappedLabel(map: Record<string, string>, value: string | undefined, fallback: string) {
  return value ? (map[value] ?? fallback) : fallback;
}

export function communityStatusLabel(status: string | undefined) {
  return mappedLabel(COMMUNITY_STATUS_LABELS, status, '未知状态');
}

export function communityTargetLabel(target: string | undefined) {
  return mappedLabel(COMMUNITY_TARGET_LABELS, target, '未知类型');
}

export function communityActionLabel(action: string | undefined) {
  return mappedLabel(COMMUNITY_ACTION_LABELS, action, '未知操作');
}

export function contentTypeLabel(type: CommunityContentType) {
  if (type === 'posts') return '帖子';
  if (type === 'replies') return '回复';
  if (type === 'audit') return '操作审计';
  return '弹幕';
}

export function moderationRequiresReason(action: CommunityModerationAction) {
  return action === 'hide' || action === 'delete';
}

export function moderationEndpoint(type: Exclude<CommunityContentType, 'audit'>, id: string) {
  const encodedId = encodeURIComponent(id);
  if (type === 'danmaku') return `/api/admin/danmaku/${encodedId}`;
  if (type === 'posts') return `/api/admin/forum/posts/${encodedId}`;
  return `/api/admin/forum/replies/${encodedId}`;
}

export function communityItemSummary(item: AdminCommunityItem) {
  return item.title ?? item.content ?? item.body ?? item.postTitle ?? '无文本内容';
}

export function composeModerationReason(preset: string, detail: string) {
  const cleanDetail = detail.trim();
  if (!preset || preset === '其他') return cleanDetail;
  return cleanDetail ? `${preset}：${cleanDetail}` : preset;
}
