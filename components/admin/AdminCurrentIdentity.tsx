'use client';

import { useEffect, useState } from 'react';

interface AdminSessionUser {
  id?: string;
  phone?: string | null;
  hostUserId?: string | null;
  displayName?: string | null;
  role?: {
    name?: string;
    code?: string;
  };
}

interface AdminSessionResponse {
  authenticated?: boolean;
  user?: AdminSessionUser;
  tenant?: { name?: string | null };
}

export interface AdminIdentityLabels {
  company: string;
  user: string;
  role: string;
}

export function formatAdminIdentity(
  user: AdminSessionUser | null | undefined,
  tenant: AdminSessionResponse['tenant'] | null | undefined,
): AdminIdentityLabels {
  const companyLabel = tenant?.name?.trim() || '未知公司';
  if (!user) return { company: companyLabel, user: '未知用户', role: '未知角色' };

  const userLabel =
    user.displayName?.trim() ||
    user.phone?.trim() ||
    user.hostUserId?.trim() ||
    user.id ||
    '未知用户';
  const roleName = user.role?.name?.trim();
  const roleCode = user.role?.code?.trim();
  const roleLabel =
    roleName && roleCode ? `${roleName}（${roleCode}）` : roleName || roleCode || '未知角色';

  return { company: companyLabel, user: userLabel, role: roleLabel };
}

export function AdminCurrentIdentity() {
  const [identity, setIdentity] = useState<AdminIdentityLabels>({
    company: '读取中…',
    user: '读取中…',
    role: '读取中…',
  });

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/session')
      .then(async (response) => {
        if (!response.ok) throw new Error('当前用户读取失败');
        return (await response.json()) as AdminSessionResponse;
      })
      .then((session) => {
        if (!cancelled)
          setIdentity(
            formatAdminIdentity(
              session.authenticated ? session.user : null,
              session.authenticated ? session.tenant : null,
            ),
          );
      })
      .catch(() => {
        if (!cancelled) setIdentity({ company: '无法读取', user: '无法读取', role: '无法读取' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="mt-auto grid gap-1 border-t border-[var(--admin-border-subtle)] pt-4 text-xs text-[var(--admin-muted-foreground)]"
      data-admin-current-identity
    >
      <span>
        公司：
        <strong className="font-medium text-[var(--admin-foreground)]">{identity.company}</strong>
      </span>
      <span>
        角色：
        <strong className="font-medium text-[var(--admin-foreground)]">{identity.role}</strong>
      </span>
      <span>
        用户：
        <strong className="font-medium text-[var(--admin-foreground)]">{identity.user}</strong>
      </span>
    </div>
  );
}
