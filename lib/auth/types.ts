export type AuthSource = 'password' | 'host-sso' | 'api-key';

export interface SessionIdentity {
  userId: string;
  tenantId: string;
  roleId: string;
  roleCode: string;
  isAdmin: boolean;
  authSource: AuthSource;
}

export interface TenantAccessContext {
  userId: string;
  tenantId: string;
  roleId: string;
  isAdmin: boolean;
}

export function toTenantAccessContext(identity: SessionIdentity): TenantAccessContext {
  return {
    userId: identity.userId,
    tenantId: identity.tenantId,
    roleId: identity.roleId,
    isAdmin: identity.isAdmin,
  };
}

export type CourseVisibility =
  | { mode: 'all'; roleIds: readonly string[] }
  | { mode: 'roles'; roleIds: readonly string[] };

export type InviteCodeStatus = 'active' | 'disabled' | 'expired';

export function canManageCourses(identity: SessionIdentity): boolean {
  return identity.isAdmin;
}

export function isVisibleToRole(visibility: CourseVisibility, roleId: string): boolean {
  if (visibility.mode === 'all') return true;
  return visibility.roleIds.includes(roleId);
}
