import type { AdminInviteCode, AdminRole, AdminUser } from '@/lib/admin/client';
import type { EnterpriseProgressDetail } from '@/lib/storage/enterprise-service';

export interface DashboardMetricDisplay {
  value: string;
  note: string;
  progress: number | null;
}

export interface DashboardPendingItem {
  id: string;
  severity: 'high' | 'medium' | 'info';
  title: string;
  description?: string;
  href: string;
  actionLabel: string;
}

function clampDashboardPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Math.round(value), 100));
}

export function formatDashboardPercent(value: number): string {
  return `${clampDashboardPercent(value)}%`;
}

export function toDashboardProgressRatio(value: number): number {
  return clampDashboardPercent(value) / 100;
}

export function getDashboardPassRateDisplay(
  passRate: number,
  attemptCount: number,
  attemptLabel: '测评' | '考核',
): DashboardMetricDisplay {
  if (attemptCount === 0) {
    return {
      value: '—',
      note: `暂无${attemptLabel}记录`,
      progress: null,
    };
  }

  return {
    value: formatDashboardPercent(passRate),
    note: `${attemptLabel} ${attemptCount} 次`,
    progress: toDashboardProgressRatio(passRate),
  };
}

export function isActiveDashboardInviteCode(
  inviteCode: AdminInviteCode,
  now = new Date(),
): boolean {
  if (!inviteCode.enabled) return false;
  if (!inviteCode.expiresAt) return true;

  const expiresAt = new Date(inviteCode.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export function buildDashboardPendingItems(
  dashboard: { progress: EnterpriseProgressDetail[] } | null,
  roles: readonly AdminRole[],
  inviteCodes: readonly AdminInviteCode[],
  users: readonly AdminUser[],
  now = new Date(),
): DashboardPendingItem[] {
  const items: DashboardPendingItem[] = [];

  if (roles.length === 0) {
    items.push({
      id: 'roles-empty',
      severity: 'high',
      title: '尚未创建可分配角色',
      description: '先配置角色，才能为用户和邀请码分配访问权限。',
      href: '/admin?module=access&section=roles',
      actionLabel: '配置角色',
    });
  }

  if (!inviteCodes.some((inviteCode) => isActiveDashboardInviteCode(inviteCode, now))) {
    items.push({
      id: 'invites-empty',
      severity: 'medium',
      title: '暂无可用邀请码',
      description: '已停用或已过期的邀请码不能用于注册。',
      href: '/admin?module=access&section=invites',
      actionLabel: '创建邀请码',
    });
  }

  if (users.length === 0) {
    items.push({
      id: 'users-empty',
      severity: 'medium',
      title: '尚无用户记录',
      href: '/admin?module=access&section=users',
      actionLabel: '查看用户管理',
    });
  }

  if (dashboard && dashboard.progress.length === 0) {
    items.push({
      id: 'progress-empty',
      severity: 'info',
      title: '当前筛选没有学习记录',
      description: '可调整筛选条件，或前往用户管理查看当前用户。',
      href: '/admin?module=access&section=users',
      actionLabel: '查看用户管理',
    });
  }

  return items;
}

export function getDashboardRoleName(
  roleId: string,
  roleCode: string,
  roles: readonly AdminRole[],
): string {
  return roles.find((role) => role.id === roleId)?.name ?? roleCode;
}

export function getDashboardLastActivity<T extends { lastViewedAt?: Date; updatedAt: Date }>(
  progress: T,
): Date {
  return progress.lastViewedAt ?? progress.updatedAt;
}
