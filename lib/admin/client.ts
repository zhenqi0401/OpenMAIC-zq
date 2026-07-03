import type { AuthRole, PublicUser } from '@/lib/auth/service';
import type { DashboardSummary, HostQueryFilters } from '@/lib/host-api/types';
import type {
  EnterpriseExamPolicy,
  EnterpriseInviteCode,
  EnterpriseProgressDetail,
} from '@/lib/storage/enterprise-service';

export type AdminRole = AuthRole;
export type AdminUser = PublicUser;
export type AdminInviteCode = Omit<EnterpriseInviteCode, 'createdAt' | 'expiresAt'> & {
  createdAt: string | Date;
  expiresAt: string | Date | null;
};
export type AdminExamPolicy = EnterpriseExamPolicy;

export interface ExamPolicyInput {
  title: string;
  targetRoleId: string;
  categoryIds: string[];
  courseIds: string[];
  questionCount: number;
  passThreshold: number;
  timeLimitMinutes?: number | null;
}

export type ExamPolicyPatch = Partial<ExamPolicyInput> & {
  status?: AdminExamPolicy['status'];
};

export interface AdminDashboard {
  summary: DashboardSummary;
  progress: EnterpriseProgressDetail[];
}

export interface RoleOption {
  value: string;
  label: string;
  isAdmin: boolean;
}

export type InviteCodeViewStatus = 'active' | 'disabled' | 'expired';

export interface InviteCodeView {
  id: string;
  roleLabel: string;
  status: InviteCodeViewStatus;
  expiresAtLabel: string;
  cleartextCode: string | null;
}

type AdminFetch = (input: string, init?: RequestInit) => Promise<Response>;

export class AdminClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AdminClientError';
  }
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new AdminClientError(response.status, fallbackMessage);
  }
  return (await response.json()) as T;
}

function jsonRequest(method: 'POST' | 'PATCH', body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function buildQuery(filters?: HostQueryFilters): string {
  if (!filters) return '';
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

export function createAdminClient(fetcher: AdminFetch = fetch) {
  return {
    async getDashboard(filters?: HostQueryFilters): Promise<AdminDashboard> {
      const response = await fetcher(`/api/admin/dashboard${buildQuery(filters)}`);
      return readJson<AdminDashboard>(response, '看板加载失败');
    },

    async listRoles(): Promise<AdminRole[]> {
      const response = await fetcher('/api/admin/roles');
      const data = await readJson<{ roles: AdminRole[] }>(response, '角色列表加载失败');
      return data.roles;
    },

    async createRole(input: { code: string; name: string; isAdmin?: boolean }) {
      const response = await fetcher('/api/admin/roles', jsonRequest('POST', input));
      return readJson<{ role: AdminRole }>(response, '角色创建失败');
    },

    async updateRole(id: string, patch: { code?: string; name?: string; isAdmin?: boolean }) {
      const response = await fetcher(
        `/api/admin/roles/${encodeURIComponent(id)}`,
        jsonRequest('PATCH', patch),
      );
      return readJson<{ role: AdminRole }>(response, '角色保存失败');
    },

    async listInviteCodes(): Promise<AdminInviteCode[]> {
      const response = await fetcher('/api/admin/invite-codes');
      const data = await readJson<{ inviteCodes: AdminInviteCode[] }>(
        response,
        '邀请码列表加载失败',
      );
      return data.inviteCodes;
    },

    async createInviteCode(input: {
      code: string;
      roleId: string;
      enabled?: boolean;
      expiresAt?: string | null;
    }) {
      const response = await fetcher('/api/admin/invite-codes', jsonRequest('POST', input));
      return readJson<{ inviteCode: AdminInviteCode }>(response, '邀请码创建失败');
    },

    async updateInviteCode(
      id: string,
      patch: { roleId?: string; enabled?: boolean; expiresAt?: string | null },
    ) {
      const response = await fetcher(
        `/api/admin/invite-codes/${encodeURIComponent(id)}`,
        jsonRequest('PATCH', patch),
      );
      return readJson<{ inviteCode: AdminInviteCode }>(response, '邀请码保存失败');
    },

    async listUsers(): Promise<AdminUser[]> {
      const response = await fetcher('/api/admin/users');
      const data = await readJson<{ users: AdminUser[] }>(response, '用户列表加载失败');
      return data.users;
    },

    async updateUserRole(userId: string, roleId: string) {
      const response = await fetcher(
        `/api/admin/users/${encodeURIComponent(userId)}/role`,
        jsonRequest('PATCH', { roleId }),
      );
      return readJson<{ user: AdminUser }>(response, '用户角色保存失败');
    },

    async listExamPolicies(): Promise<AdminExamPolicy[]> {
      const response = await fetcher('/api/admin/exam-policies');
      const data = await readJson<{ examPolicies: AdminExamPolicy[] }>(
        response,
        '考核策略列表加载失败',
      );
      return data.examPolicies;
    },

    async createExamPolicy(input: ExamPolicyInput) {
      const response = await fetcher('/api/admin/exam-policies', jsonRequest('POST', input));
      return readJson<{ examPolicy: AdminExamPolicy }>(response, '考核策略创建失败');
    },

    async updateExamPolicy(id: string, patch: ExamPolicyPatch) {
      const response = await fetcher(
        `/api/admin/exam-policies/${encodeURIComponent(id)}`,
        jsonRequest('PATCH', patch),
      );
      return readJson<{ examPolicy: AdminExamPolicy }>(response, '考核策略保存失败');
    },

    async publishExamPolicy(id: string) {
      const response = await fetcher(`/api/admin/exam-policies/${encodeURIComponent(id)}/publish`, {
        method: 'POST',
      });
      return readJson<{ examPolicy: AdminExamPolicy }>(response, '考核策略发布失败');
    },
  };
}

export function buildRoleOptions(roles: readonly AdminRole[]): RoleOption[] {
  return roles.map((role) => ({
    value: role.id,
    label: `${role.name} (${role.code})`,
    isAdmin: role.isAdmin,
  }));
}

export function getRoleLabel(roleId: string, roles: readonly AdminRole[]): string {
  return buildRoleOptions(roles).find((role) => role.value === roleId)?.label ?? roleId;
}

export function createUserRoleDrafts(users: readonly AdminUser[]): Record<string, string> {
  return Object.fromEntries(users.map((user) => [user.id, user.role.id] as const));
}

export function getInviteCodeView(
  inviteCode: AdminInviteCode,
  roles: readonly AdminRole[],
  now = new Date(),
): InviteCodeView {
  const expiresAt = inviteCode.expiresAt ? new Date(inviteCode.expiresAt) : null;
  const status: InviteCodeViewStatus = !inviteCode.enabled
    ? 'disabled'
    : expiresAt && expiresAt.getTime() <= now.getTime()
      ? 'expired'
      : 'active';

  return {
    id: inviteCode.id,
    roleLabel: getRoleLabel(inviteCode.roleId, roles),
    status,
    expiresAtLabel: expiresAt ? expiresAt.toLocaleString() : '长期有效',
    cleartextCode: null,
  };
}
