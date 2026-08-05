'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LearnerHeader } from '@/components/home/LearnerHeader';
import { logoutCurrentSession } from '@/lib/auth/logout-client';
import type { SessionIdentity } from '@/lib/auth/types';

export function ForumFrame({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [displayName, setDisplayName] = useState('学习者');

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/auth/session')
      .then(
        (response) =>
          response.json() as Promise<{
            authenticated?: boolean;
            identity?: SessionIdentity;
            user?: { displayName?: string };
          }>,
      )
      .then((session) => {
        if (cancelled) return;
        if (!session.authenticated || !session.identity) {
          window.location.assign('/login');
          return;
        }
        setIdentity(session.identity);
        if (session.user?.displayName?.trim()) setDisplayName(session.user.displayName.trim());
      })
      .catch(() => {
        if (!cancelled) window.location.assign('/login');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const homeHref = identity?.isAdmin ? '/learn' : '/';

  return (
    <div className="min-h-[100dvh] bg-[#f4f5f7] text-[#181a22] dark:bg-[#12141a] dark:text-slate-100">
      {identity ? (
        <LearnerHeader
          current="forum"
          displayName={displayName}
          identity={identity}
          onLogout={async () => {
            await logoutCurrentSession();
            window.location.assign('/login');
          }}
        />
      ) : (
        <div className="h-16 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-[#171a22]" />
      )}
      {children}
      <footer className="mx-auto mt-14 flex w-[min(1600px,calc(100%-1.25rem))] justify-between border-t border-[#d9dce3] py-5 text-sm text-slate-400 dark:border-slate-800 sm:w-[min(1600px,calc(100%-2rem))]">
        <span>元我智脑</span>
        <Link
          href={homeHref}
          className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <ArrowLeft className="size-3" /> 返回学习中心
        </Link>
      </footer>
    </div>
  );
}
