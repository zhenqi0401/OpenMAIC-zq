'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { logoutCurrentSession } from '@/lib/auth/logout-client';

export function AdminSessionActions({ leading }: { leading?: ReactNode }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logoutCurrentSession();
      window.location.assign('/');
    } catch {
      setLoggingOut(false);
      toast.error('退出登录失败');
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {leading}
      <Link
        className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-[#d8c8b9] bg-[#fffaf2] px-3 text-sm font-medium text-[#2b211d] transition-colors hover:border-[#c96f54]/70 hover:bg-[#f1e2d0]"
        href="/"
      >
        返回首页
      </Link>
      <button
        className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-[#d8c8b9] bg-[#fffaf2] px-3 text-sm font-medium text-[#2b211d] transition-colors hover:border-[#c96f54]/70 hover:bg-[#f1e2d0] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loggingOut}
        onClick={handleLogout}
        type="button"
      >
        {loggingOut ? '退出中' : '退出登录'}
      </button>
    </div>
  );
}
