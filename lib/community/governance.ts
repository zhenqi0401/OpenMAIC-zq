import { createHash } from 'node:crypto';
import { and, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';

import { getDb } from '@/lib/storage/db';
import { communityRateLimits } from '@/lib/storage/schema';
import {
  COMMUNITY_RATE_POLICIES,
  CommunityGovernanceError,
  type CommunityActionKind,
  type CommunityRateLimiter,
} from './governance-shared';

export * from './governance-shared';

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export class DrizzleCommunityRateLimiter implements CommunityRateLimiter {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async consume(input: {
    actorId: string;
    actionKind: CommunityActionKind;
    content: string;
  }): Promise<void> {
    const policy = COMMUNITY_RATE_POLICIES[input.actionKind];
    const now = this.now();
    const windowBoundary = new Date(now.getTime() - policy.windowMs);
    const intervalBoundary = new Date(now.getTime() - policy.minIntervalMs);
    const contentHash = hashContent(input.content);

    const [accepted] = await getDb()
      .insert(communityRateLimits)
      .values({
        actorId: input.actorId,
        actionKind: input.actionKind,
        windowStartedAt: now,
        actionCount: 1,
        lastActionAt: now,
        lastContentHash: contentHash,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [communityRateLimits.actorId, communityRateLimits.actionKind],
        set: {
          windowStartedAt: sql`case when ${communityRateLimits.windowStartedAt} <= ${windowBoundary} then ${now} else ${communityRateLimits.windowStartedAt} end`,
          actionCount: sql`case when ${communityRateLimits.windowStartedAt} <= ${windowBoundary} then 1 else ${communityRateLimits.actionCount} + 1 end`,
          lastActionAt: now,
          lastContentHash: contentHash,
          updatedAt: now,
        },
        setWhere: and(
          or(
            lte(communityRateLimits.windowStartedAt, windowBoundary),
            lt(communityRateLimits.actionCount, policy.maxActions),
          ),
          lte(communityRateLimits.lastActionAt, intervalBoundary),
          or(
            lte(communityRateLimits.windowStartedAt, windowBoundary),
            isNull(communityRateLimits.lastContentHash),
            ne(communityRateLimits.lastContentHash, contentHash),
          ),
        ),
      })
      .returning({ actorId: communityRateLimits.actorId });

    if (!accepted) {
      throw new CommunityGovernanceError(
        'RATE_LIMITED',
        'Community content was sent too quickly, too often, or duplicates recent content',
      );
    }
  }
}

let rateLimiter: CommunityRateLimiter | null = null;

export function getCommunityRateLimiter(): CommunityRateLimiter {
  if (!rateLimiter) rateLimiter = new DrizzleCommunityRateLimiter();
  return rateLimiter;
}
