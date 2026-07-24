import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CommunityContentList,
  formatDanmakuOffset,
} from '@/components/admin/community/CommunityContentList';
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

  it('renders posts as an author-led content flow with the latest moderation details', () => {
    const markup = renderToStaticMarkup(
      React.createElement(CommunityContentList, {
        type: 'posts',
        pendingItemId: null,
        onModerate: () => undefined,
        items: [
          {
            id: 'post-1',
            status: 'visible',
            title: '如何完成课程',
            body: '这是帖子正文摘要。',
            courseName: '入职课程',
            replyCount: 3,
            locked: false,
            pinned: true,
            action: 'lock',
            reason: null,
            moderator: { id: 'admin-1', displayName: '系统管理员' },
            createdAt: '2026-07-23T08:09:10.000Z',
            author: {
              id: 'user-1',
              displayName: '张三',
              roleName: '学员',
              roleCode: 'learner',
            },
          },
        ],
      }),
    );

    expect(markup).toContain('data-community-post-flow');
    expect(markup).toContain('张三');
    expect(markup).toContain('学员');
    expect(markup).toContain('如何完成课程');
    expect(markup).toContain('这是帖子正文摘要');
    expect(markup).toContain('所属课程：入职课程');
    expect(markup).toContain('回复数：3');
    expect(markup).toContain('关闭回复');
    expect(markup).toContain('data-community-post-moderation');
    expect(markup).toContain('操作类型：关闭回复');
    expect(markup).toContain('操作原因：未填写');
    expect(markup).toContain('操作人：系统管理员');
    expect(markup).not.toContain('置顶');
  });

  it('does not render moderation details for untouched posts', () => {
    const markup = renderToStaticMarkup(
      React.createElement(CommunityContentList, {
        type: 'posts',
        pendingItemId: null,
        onModerate: () => undefined,
        items: [
          {
            id: 'post-untouched',
            status: 'visible',
            title: '普通帖子',
            body: '尚未经过管理员操作。',
            createdAt: '2026-07-23T08:09:10.000Z',
          },
        ],
      }),
    );

    expect(markup).not.toContain('data-community-post-moderation');
    expect(markup).not.toContain('操作原因：');
  });

  it('renders a six-column danmaku table and matching mobile fields with actionOffsetMs', () => {
    expect(formatDanmakuOffset(0)).toBe('00:00');
    expect(formatDanmakuOffset(65_432)).toBe('01:05');
    expect(formatDanmakuOffset(3_665_000)).toBe('01:01:05');
    expect(formatDanmakuOffset(undefined)).toBe('—');

    const markup = renderToStaticMarkup(
      React.createElement(CommunityContentList, {
        type: 'danmaku',
        pendingItemId: null,
        onModerate: () => undefined,
        items: [
          {
            id: 'dm-1',
            status: 'visible',
            content: '重点来了',
            actionOffsetMs: 65_432,
            courseName: '入职课程',
            createdAt: '2026-07-23T08:09:10.000Z',
            author: {
              id: 'user-1',
              displayName: '李四',
              roleName: '学员',
              roleCode: 'learner',
            },
          },
        ],
      }),
    );

    for (const heading of ['发送者', '弹幕文本', '播放时间点', '所属课程', '状态', '操作']) {
      expect(markup).toContain(heading);
    }
    expect(markup).toContain('data-community-danmaku-table');
    expect(markup).toContain('data-community-danmaku-cards');
    expect(markup).toContain('01:05');
    expect(markup).toContain('正常');
    expect(markup).toContain('下架');
  });

  it('renders replies and audit records as semantic desktop tables with mobile cards', () => {
    const replyMarkup = renderToStaticMarkup(
      React.createElement(CommunityContentList, {
        type: 'replies',
        pendingItemId: null,
        onModerate: () => undefined,
        items: [
          {
            id: 'reply-1',
            status: 'visible',
            body: '这是一条回复',
            postTitle: '课程讨论帖',
            courseName: '入职课程',
            createdAt: '2026-07-23T08:09:10.000Z',
            author: {
              id: 'user-2',
              displayName: '王五',
              roleName: '学员',
              roleCode: 'learner',
            },
          },
        ],
      }),
    );
    for (const heading of [
      '回复者',
      '回复内容',
      '所属帖子',
      '所属课程',
      '回复时间',
      '状态',
      '操作',
    ]) {
      expect(replyMarkup).toContain(heading);
    }
    expect(replyMarkup).toContain('data-community-reply-table');
    expect(replyMarkup).toContain('data-community-reply-cards');

    const auditMarkup = renderToStaticMarkup(
      React.createElement(CommunityContentList, {
        type: 'audit',
        pendingItemId: null,
        onModerate: () => undefined,
        items: [
          {
            id: 'audit-1',
            targetType: 'forum_post',
            action: 'hide',
            reason: null,
            createdAt: '2026-07-23T08:09:10.000Z',
            moderator: { id: 'admin-1', displayName: '系统管理员' },
          },
        ],
      }),
    );
    for (const heading of ['操作人', '操作对象', '操作类型', '操作原因', '操作时间']) {
      expect(auditMarkup).toContain(heading);
    }
    expect(auditMarkup).toContain('data-community-audit-table');
    expect(auditMarkup).toContain('data-community-audit-cards');
    expect(auditMarkup).toContain('未填写');
  });

  it('keeps feature flags in control of the available tabs', () => {
    expect(availableCommunityTabs(true, true).map((tab) => tab.label)).toEqual([
      '帖子',
      '回复',
      '弹幕',
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
    const contentSource = readFileSync(
      'components/admin/community/CommunityContentList.tsx',
      'utf8',
    );
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
    expect(panelSource).not.toContain('moderationScrollPosition');
    expect(panelSource).toContain('data-community-workbench');
    expect(panelSource.indexOf('label="今日新帖"')).toBeLessThan(
      panelSource.indexOf('data-community-workbench'),
    );
    expect(panelSource.indexOf('ariaLabel="社区内容类型"')).toBeLessThan(
      panelSource.indexOf('data-community-filters'),
    );
    expect(panelSource.indexOf('data-community-filters')).toBeLessThan(
      panelSource.indexOf('data-community-content'),
    );
    expect(panelSource).toContain(
      "isForumEnabled() ? 'posts' : isDanmakuEnabled() ? 'danmaku' : 'audit'",
    );
    expect(panelSource).toContain('aria-label="关键词"');
    expect(panelSource).toContain(
      "aria-label={type === 'audit' ? '管理员用户 ID' : '作者用户 ID'}",
    );
    expect(panelSource).toContain('aria-label="课程 ID"');
    expect(panelSource).toContain("aria-label={type === 'audit' ? '审计目标类型' : '内容状态'}");
    expect(panelSource).toContain('选择日期范围');
    expect(panelSource).toContain('setKeyword(keywordDraft.trim())');
    expect(panelSource).not.toContain('社区正文按纯文本安全输出');
    expect(contentSource).not.toContain("onModerate('pin')");
    expect(contentSource).not.toContain("onModerate('unpin')");
    expect(contentSource).toContain('min-h-[var(--admin-control-height)]');
    expect(dialogSource).toContain('modal={false}');
    expect(dialogSource).toContain('focus({ preventScroll: true })');
    expect(dialogSource).toContain('value={detail}');
    expect(dialogSource).toContain('{error ? <AdminNotice');
  });
});
