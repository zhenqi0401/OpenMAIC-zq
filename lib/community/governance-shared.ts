export const COMMUNITY_MODERATION_REASON_MAX_LENGTH = 500;

export type CommunityActionKind = 'danmaku' | 'forum_post' | 'forum_reply';

export interface CommunityRatePolicy {
  readonly windowMs: number;
  readonly maxActions: number;
  readonly minIntervalMs: number;
}

export const COMMUNITY_RATE_POLICIES: Record<CommunityActionKind, CommunityRatePolicy> = {
  danmaku: { windowMs: 60_000, maxActions: 20, minIntervalMs: 2_000 },
  forum_post: { windowMs: 10 * 60_000, maxActions: 3, minIntervalMs: 60_000 },
  forum_reply: { windowMs: 5 * 60_000, maxActions: 20, minIntervalMs: 5_000 },
};

export class CommunityGovernanceError extends Error {
  constructor(
    public readonly code: 'RATE_LIMITED' | 'UNSAFE_CONTENT' | 'INVALID_REQUEST',
    message: string,
  ) {
    super(message);
    this.name = 'CommunityGovernanceError';
  }
}

export interface CommunityRateLimiter {
  consume(input: {
    actorId: string;
    actionKind: CommunityActionKind;
    content: string;
  }): Promise<void>;
}

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const BIDI_OVERRIDE_CHARACTERS = /[\u202a-\u202e\u2066-\u2069]/u;
const HTML_TAG = /<\s*\/?\s*[a-z][^>]*>/iu;
const DANGEROUS_PROTOCOL = /(?:^|[\s([<'"])(?:javascript|vbscript|data)\s*:/iu;

/**
 * Community content is deliberately plain text in the MVP. React renders these
 * values as text nodes; rejecting raw HTML and dangerous URL protocols here also
 * keeps stored content safe for future exports and alternate clients.
 */
export function normalizeCommunityText(value: string, field: string, maxLength: number): string {
  const normalized = value.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ').trim();

  if (!normalized || normalized.length > maxLength) {
    throw new CommunityGovernanceError(
      'INVALID_REQUEST',
      `${field} must be between 1 and ${maxLength} characters`,
    );
  }
  if (CONTROL_CHARACTERS.test(normalized) || BIDI_OVERRIDE_CHARACTERS.test(normalized)) {
    throw new CommunityGovernanceError('UNSAFE_CONTENT', `${field} contains unsafe characters`);
  }
  if (HTML_TAG.test(normalized)) {
    throw new CommunityGovernanceError('UNSAFE_CONTENT', `${field} does not allow raw HTML`);
  }
  if (DANGEROUS_PROTOCOL.test(normalized)) {
    throw new CommunityGovernanceError(
      'UNSAFE_CONTENT',
      `${field} contains a disallowed URL protocol`,
    );
  }
  return normalized;
}

export function normalizeModerationReason(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return undefined;
  if (normalized.length > COMMUNITY_MODERATION_REASON_MAX_LENGTH) {
    throw new CommunityGovernanceError(
      'INVALID_REQUEST',
      `reason must not exceed ${COMMUNITY_MODERATION_REASON_MAX_LENGTH} characters`,
    );
  }
  if (CONTROL_CHARACTERS.test(normalized) || BIDI_OVERRIDE_CHARACTERS.test(normalized)) {
    throw new CommunityGovernanceError('UNSAFE_CONTENT', 'reason contains unsafe characters');
  }
  return normalized;
}
