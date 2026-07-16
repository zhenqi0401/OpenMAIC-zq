import { afterEach, describe, expect, test } from 'vitest';

import { getDanmakuService } from '@/lib/community/danmaku-route-utils';
import { getForumService } from '@/lib/community/forum-route-utils';

describe('QA independent community feature gates', () => {
  const originalDanmaku = process.env.NEXT_PUBLIC_DANMAKU_ENABLED;
  const originalForum = process.env.NEXT_PUBLIC_FORUM_ENABLED;

  afterEach(() => {
    if (originalDanmaku === undefined) delete process.env.NEXT_PUBLIC_DANMAKU_ENABLED;
    else process.env.NEXT_PUBLIC_DANMAKU_ENABLED = originalDanmaku;
    if (originalForum === undefined) delete process.env.NEXT_PUBLIC_FORUM_ENABLED;
    else process.env.NEXT_PUBLIC_FORUM_ENABLED = originalForum;
  });

  test('disabling danmaku does not disable the forum service boundary', () => {
    process.env.NEXT_PUBLIC_DANMAKU_ENABLED = 'false';
    process.env.NEXT_PUBLIC_FORUM_ENABLED = 'true';

    expect(() => getDanmakuService()).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND', message: 'Danmaku is disabled' }),
    );
    expect(() => getForumService()).not.toThrow();
  });

  test('disabling the forum does not disable the danmaku service boundary', () => {
    process.env.NEXT_PUBLIC_DANMAKU_ENABLED = 'true';
    process.env.NEXT_PUBLIC_FORUM_ENABLED = 'false';

    expect(() => getForumService()).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND', message: 'Forum is disabled' }),
    );
    expect(() => getDanmakuService()).not.toThrow();
  });
});
