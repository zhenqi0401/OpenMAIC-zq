'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAuthRedirect } from '@/lib/auth/route-policy';
import type { SessionIdentity } from '@/lib/auth/types';

interface SessionResponse {
  authenticated: boolean;
  identity?: SessionIdentity;
}

export function AuthSessionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/session')
      .then((response) => response.json() as Promise<SessionResponse>)
      .then((session) => {
        if (cancelled) return;
        setIdentity(session.authenticated ? (session.identity ?? null) : null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIdentity(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (loading) return;
    const redirect = getAuthRedirect(pathname, identity);
    if (redirect && redirect !== pathname) router.replace(redirect);
  }, [identity, loading, pathname, router]);

  const redirect = loading ? null : getAuthRedirect(pathname, identity);
  if (loading || (redirect && redirect !== pathname)) {
    return <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950" aria-busy="true" />;
  }

  return <>{children}</>;
}
