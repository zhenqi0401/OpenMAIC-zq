'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password, inviteCode }),
    });

    setSubmitting(false);
    if (!response.ok) {
      setError('注册失败，请检查手机号、密码和邀请码');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-950">
            <UserPlus className="size-4" />
          </div>
          <h1 className="text-lg font-semibold text-slate-950 dark:text-slate-50">学员注册</h1>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">手机号</Label>
            <Input id="phone" placeholder="请输入手机号" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="至少6位密码"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inviteCode">邀请码</Label>
            <Input
              id="inviteCode"
              placeholder="请输入邀请码"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
            />
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={submitting}>
          注册
        </Button>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          返回登录
        </button>
      </form>
    </main>
  );
}
