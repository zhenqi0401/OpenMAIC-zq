import { describe, expect, test } from 'vitest';

import {
  getInviteCodeValidationIssue,
  INVITE_CODE_MAX_LENGTH,
  INVITE_CODE_MIN_LENGTH,
  normalizeInviteCode,
} from '@/lib/auth/invite-code';

describe('invite code rules', () => {
  test('normalizes whitespace and letter case consistently', () => {
    expect(normalizeInviteCode(' learn - 2026 ')).toBe('LEARN-2026');
  });

  test('requires 4 to 16 characters after normalization', () => {
    expect(getInviteCodeValidationIssue(' \t ')).toBe('REQUIRED');
    expect(getInviteCodeValidationIssue('A B C')).toBe('TOO_SHORT');
    expect(getInviteCodeValidationIssue('A'.repeat(INVITE_CODE_MIN_LENGTH))).toBeNull();
    expect(getInviteCodeValidationIssue('A'.repeat(INVITE_CODE_MAX_LENGTH))).toBeNull();
    expect(getInviteCodeValidationIssue('A'.repeat(INVITE_CODE_MAX_LENGTH + 1))).toBe('TOO_LONG');
  });
});
