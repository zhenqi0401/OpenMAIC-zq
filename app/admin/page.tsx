'use client';

import { useEffect, useState } from 'react';
import { Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AdminUser {
  id: string;
  phone: string | null;
  hostUserId: string | null;
  displayName: string;
  status: string;
  role: {
    id: string;
    code: string;
    name: string;
    isAdmin: boolean;
  };
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function loadUsers() {
    const response = await fetch('/api/admin/users');
    if (!response.ok) {
      setError('没有后台访问权限');
      return;
    }
    const data = (await response.json()) as { users: AdminUser[] };
    setUsers(data.users);
    setRoleDrafts(Object.fromEntries(data.users.map((user) => [user.id, user.role.id] as const)));
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/users')
      .then((response) => {
        if (!response.ok) throw new Error('forbidden');
        return response.json() as Promise<{ users: AdminUser[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setUsers(data.users);
        setRoleDrafts(
          Object.fromEntries(data.users.map((user) => [user.id, user.role.id] as const)),
        );
      })
      .catch(() => {
        if (!cancelled) setError('没有后台访问权限');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateRole(userId: string) {
    const response = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: roleDrafts[userId] }),
    });
    if (!response.ok) {
      setError('角色更新失败');
      return;
    }
    await loadUsers();
  }

  return (
    <main className="min-h-[100dvh] bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-950">
            <Shield className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950 dark:text-slate-50">管理后台</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">用户与当前角色</p>
          </div>
        </div>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1.4fr_auto] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase text-slate-500 dark:border-slate-800">
            <span>用户</span>
            <span>手机号</span>
            <span>Host ID</span>
            <span>角色 ID</span>
            <span />
          </div>
          {users.map((user) => (
            <div
              key={user.id}
              className="grid grid-cols-[1.2fr_1fr_1fr_1.4fr_auto] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 dark:border-slate-800"
            >
              <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                <Users className="size-4 text-slate-400" />
                {user.displayName}
              </span>
              <span className="text-slate-500">{user.phone ?? '-'}</span>
              <span className="truncate text-slate-500">{user.hostUserId ?? '-'}</span>
              <Input
                value={roleDrafts[user.id] ?? ''}
                onChange={(event) =>
                  setRoleDrafts((drafts) => ({ ...drafts, [user.id]: event.target.value }))
                }
              />
              <Button variant="outline" onClick={() => updateRole(user.id)}>
                保存
              </Button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
