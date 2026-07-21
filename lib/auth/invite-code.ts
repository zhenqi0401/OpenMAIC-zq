export const INVITE_CODE_MIN_LENGTH = 4;
export const INVITE_CODE_MAX_LENGTH = 16;

export type InviteCodeValidationIssue = 'REQUIRED' | 'TOO_SHORT' | 'TOO_LONG';

export function normalizeInviteCode(value: string): string {
  return value.replace(/\s/g, '').toUpperCase();
}

export function getInviteCodeValidationIssue(value: string): InviteCodeValidationIssue | null {
  const length = normalizeInviteCode(value).length;
  if (length === 0) return 'REQUIRED';
  if (length < INVITE_CODE_MIN_LENGTH) return 'TOO_SHORT';
  if (length > INVITE_CODE_MAX_LENGTH) return 'TOO_LONG';
  return null;
}
