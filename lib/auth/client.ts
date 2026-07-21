import {
  getInviteCodeValidationIssue,
  INVITE_CODE_MAX_LENGTH,
  normalizeInviteCode,
} from './invite-code';

export type AuthFieldName = 'name' | 'phone' | 'password' | 'inviteCode';
export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>;
export type AuthOperation = 'login' | 'register';

export interface LoginValues {
  phone: string;
  password: string;
}

export interface RegisterValues extends LoginValues {
  name: string;
  inviteCode: string;
}

interface AuthApiErrorPayload {
  error?: string;
  errorCode?: string;
}

export interface AuthIssue {
  field?: AuthFieldName;
  message: string;
}

export class AuthClientError extends Error {
  constructor(public readonly issue: AuthIssue) {
    super(issue.message);
    this.name = 'AuthClientError';
  }
}

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export function normalizePhoneInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

export function normalizeInviteCodeInput(value: string): string {
  return normalizeInviteCode(value);
}

function validateName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return '请输入姓名';
  if (name.length < 2) return '姓名至少需要 2 个字符';
  if (name.length > 20) return '姓名不能超过 20 个字符';
  return undefined;
}

function validatePhone(value: string): string | undefined {
  if (!value.trim()) return '请输入手机号';
  if (!PHONE_PATTERN.test(value)) return '请输入有效的 11 位手机号';
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (!value) return '请输入密码';
  if (value.length < 6) return '密码至少需要 6 位字符';
  return undefined;
}

function validateInviteCode(value: string): string | undefined {
  const issue = getInviteCodeValidationIssue(value);
  if (issue === 'REQUIRED') return '请输入企业邀请码';
  if (issue === 'TOO_SHORT') return '请检查邀请码是否完整';
  if (issue === 'TOO_LONG') return `邀请码不能超过 ${INVITE_CODE_MAX_LENGTH} 个字符`;
  return undefined;
}

export function validateAuthField(name: AuthFieldName, value: string): string | undefined {
  if (name === 'name') return validateName(value);
  if (name === 'phone') return validatePhone(value);
  if (name === 'password') return validatePassword(value);
  return validateInviteCode(value);
}

export function validateLoginValues(values: LoginValues): AuthFieldErrors {
  return {
    ...(validatePhone(values.phone) ? { phone: validatePhone(values.phone) } : {}),
    ...(validatePassword(values.password) ? { password: validatePassword(values.password) } : {}),
  };
}

export function validateRegisterValues(values: RegisterValues): AuthFieldErrors {
  return {
    ...(validateName(values.name) ? { name: validateName(values.name) } : {}),
    ...validateLoginValues(values),
    ...(validateInviteCode(values.inviteCode)
      ? { inviteCode: validateInviteCode(values.inviteCode) }
      : {}),
  };
}

export function mapAuthApiError(operation: AuthOperation, payload: AuthApiErrorPayload): AuthIssue {
  const code = payload.error;
  const fallback = operation === 'login' ? '登录失败，请稍后重试' : '账号创建失败，请稍后重试';

  const issues: Partial<Record<string, AuthIssue>> = {
    INVALID_DISPLAY_NAME: { field: 'name', message: '请输入 2–20 个字符的姓名' },
    INVALID_PHONE: { field: 'phone', message: '请输入有效的 11 位手机号' },
    WEAK_PASSWORD: { field: 'password', message: '密码至少需要 6 位字符' },
    PHONE_ALREADY_REGISTERED: {
      field: 'phone',
      message: '该手机号已注册，请直接登录',
    },
    INVALID_INVITE_CODE: {
      field: 'inviteCode',
      message: '邀请码不正确，请重新输入',
    },
    INVITE_CODE_DISABLED: {
      field: 'inviteCode',
      message: '邀请码已停用，请联系企业管理员',
    },
    INVITE_CODE_EXPIRED: {
      field: 'inviteCode',
      message: '邀请码已过期，请联系企业管理员',
    },
    INVITE_ROLE_NOT_FOUND: {
      field: 'inviteCode',
      message: '邀请码关联的角色不存在，请联系企业管理员',
    },
    INVITE_ROLE_NOT_ALLOWED: {
      field: 'inviteCode',
      message: '该邀请码不能用于员工注册',
    },
    INVALID_CREDENTIALS: { field: 'password', message: '手机号或密码不正确' },
    USER_DISABLED: { message: '账号已停用，请联系企业管理员' },
  };

  return (code && issues[code]) || { message: fallback };
}

async function authRequest<T>(operation: AuthOperation, body: T): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthClientError({ message: '网络连接失败，请检查网络后重试' });
  }

  if (response.ok) return;

  const payload = (await response.json().catch(() => ({}))) as AuthApiErrorPayload;
  throw new AuthClientError(mapAuthApiError(operation, payload));
}

export function login(values: LoginValues): Promise<void> {
  return authRequest('login', values);
}

export function register(values: RegisterValues): Promise<void> {
  return authRequest('register', {
    ...values,
    name: values.name.trim(),
  });
}
