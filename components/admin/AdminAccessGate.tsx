'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { LogIn, ShieldAlert } from 'lucide-react';
import { AdminCard, AdminNotice } from '@/components/admin/AdminSurface';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Button } from '@/components/ui/button';

type GateState =
  | { status: 'checking' }
  | { status: 'allowed' }
  | { status: 'login-required' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string };

interface SessionResponse {
  authenticated?: boolean;
  identity?: {
    isAdmin?: boolean;
  };
}

export function AdminAccessGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<GateState>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/session')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('后台权限检查失败');
        }
        return (await response.json()) as SessionResponse;
      })
      .then((session) => {
        if (cancelled) return;
        if (!session.authenticated) {
          setGate({ status: 'login-required' });
          return;
        }
        if (!session.identity?.isAdmin) {
          setGate({ status: 'forbidden' });
          return;
        }
        setGate({ status: 'allowed' });
      })
      .catch((error) => {
        if (!cancelled) {
          setGate({
            status: 'error',
            message: error instanceof Error ? error.message : '后台权限检查失败',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (gate.status === 'allowed') return children;

  if (gate.status === 'checking') {
    return (
      <AdminCard className="p-4">
        <div className="text-sm text-[#75665d]" role="status">
          正在检查后台权限...
        </div>
      </AdminCard>
    );
  }

  if (gate.status === 'error') {
    return <AdminNotice tone="error">{gate.message}</AdminNotice>;
  }

  const loginRequired = gate.status === 'login-required';

  return (
    <AdminCard className="grid gap-4 p-6">
      <BrandLockup variant="compact" />
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[4px] border border-[#d8c8b9] bg-[#f1e2d0] text-[#9b5b47]">
          {loginRequired ? <LogIn className="size-5" /> : <ShieldAlert className="size-5" />}
        </div>
        <div>
          <h2 className="text-2xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
            {loginRequired ? '请先登录管理员账号' : '当前账号没有后台权限'}
          </h2>
          <p className="mt-2 max-w-[64ch] text-sm leading-6 text-[#75665d]">
            {loginRequired
              ? '后台数据接口需要元我智脑管理员会话。登录后再进入管理后台，页面才会加载看板、课程、考核和权限数据。'
              : '后台仅管理员角色可访问。请切换到管理员账号，或联系管理员调整当前用户角色。'}
          </p>
        </div>
      </div>
      {loginRequired ? (
        <Button
          className="w-fit rounded-[4px] bg-[#c96f54] text-[#fffaf2]"
          onClick={() => {
            window.location.href = '/login';
          }}
          type="button"
        >
          去登录
        </Button>
      ) : null}
    </AdminCard>
  );
}
