import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_ACTION_LABELS,
  COMMUNITY_STATUS_LABELS,
  COMMUNITY_TARGET_LABELS,
  availableCommunityTabs,
  communityActionLabel,
  communityStatusLabel,
  communityTargetLabel,
  composeModerationReason,
  moderationEndpoint,
  moderationRequiresReason,
} from '@/lib/admin/community-presentation';

describe('community admin panel presentation', () => {
  it('maps every content status to Chinese copy', () => {
    expect(COMMUNITY_STATUS_LABELS).toEqual({
      visible: '可见',
      hidden: '已隐藏',
      deleted_by_author: '作者已删除',
      deleted_by_admin: '管理员已删除',
      archived: '已归档',
    });
    expect(Object.keys(COMMUNITY_STATUS_LABELS).map(communityStatusLabel)).toEqual([
      '可见',
      '已隐藏',
      '作者已删除',
      '管理员已删除',
      '已归档',
    ]);
  });

  it('maps every audit target and action to Chinese copy', () => {
    expect(COMMUNITY_TARGET_LABELS).toEqual({
      danmaku: '弹幕',
      forum_post: '帖子',
      forum_reply: '回复',
    });
    expect(COMMUNITY_ACTION_LABELS).toEqual({
      hide: '隐藏',
      restore: '恢复',
      delete: '删除',
      pin: '置顶',
      unpin: '取消置顶',
      lock: '关闭回复',
      unlock: '重新开放回复',
    });
    expect(communityTargetLabel('forum_post')).toBe('帖子');
    expect(communityActionLabel('unlock')).toBe('重新开放回复');
  });

  it('requires a reason for hiding and deleting but not restoring', () => {
    expect(moderationRequiresReason('hide')).toBe(true);
    expect(moderationRequiresReason('delete')).toBe(true);
    expect(moderationRequiresReason('restore')).toBe(false);
    expect(composeModerationReason('广告营销', '重复发布')).toBe('广告营销：重复发布');
    expect(composeModerationReason('其他', '自定义原因')).toBe('自定义原因');
    expect(composeModerationReason('', '')).toBe('');
  });

  it('keeps the three existing moderation API paths', () => {
    expect(moderationEndpoint('danmaku', 'dm/1')).toBe('/api/admin/danmaku/dm%2F1');
    expect(moderationEndpoint('posts', 'post/1')).toBe('/api/admin/forum/posts/post%2F1');
    expect(moderationEndpoint('replies', 'reply/1')).toBe('/api/admin/forum/replies/reply%2F1');
  });

  it('keeps feature flags in control of the available tabs', () => {
    expect(availableCommunityTabs(true, true).map((tab) => tab.label)).toEqual([
      '弹幕',
      '帖子',
      '回复',
      '操作审计',
    ]);
    expect(availableCommunityTabs(false, true).map((tab) => tab.label)).toEqual([
      '帖子',
      '回复',
      '操作审计',
    ]);
    expect(availableCommunityTabs(true, false).map((tab) => tab.label)).toEqual([
      '弹幕',
      '操作审计',
    ]);
    expect(availableCommunityTabs(false, false).map((tab) => tab.label)).toEqual(['操作审计']);
  });

  it('uses a stable in-page dialog, hides technical IDs, and retains data on failure', () => {
    const panelSource = readFileSync('components/admin/community/CommunityAdminPanel.tsx', 'utf8');
    const rowSource = readFileSync('components/admin/community/CommunityItemRow.tsx', 'utf8');
    const dialogSource = readFileSync(
      'components/admin/community/CommunityModerationDialog.tsx',
      'utf8',
    );

    expect(panelSource).not.toContain('window.prompt');
    expect(panelSource).toContain('<CommunityModerationDialog');
    expect(panelSource.indexOf('if (!response.ok)')).toBeLessThan(
      panelSource.indexOf('setItems(data.items)'),
    );
    expect(rowSource).toContain('menuModal={false}');
    expect(rowSource).not.toContain('<details');
    expect(rowSource).not.toContain('记录 ID：{item.id}');
    expect(rowSource).not.toContain('作者 ID：{item.author.id}');
    expect(panelSource).toContain('moderationScrollPosition');
    expect(panelSource).toContain("window.scrollTo({ ...position, behavior: 'auto' })");
    expect(dialogSource).toContain('focus({ preventScroll: true })');
    expect(dialogSource).toContain('value={detail}');
    expect(dialogSource).toContain('{error ? <AdminNotice');
  });
});
