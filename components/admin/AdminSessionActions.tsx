'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, CircleUserRound, Home, LoaderCircle, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { adminSecondaryButtonClassName, adminThemeStyle } from '@/components/admin/AdminSurface';
import { logoutCurrentSession } from '@/lib/auth/logout-client';

export const adminAccountMenuLabels = {
  trigger: '账户',
  home: '返回首页',
  logout: '退出登录',
  loggingOut: '退出中',
} as const;

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-busy={loggingOut}
            aria-label={
              loggingOut ? adminAccountMenuLabels.loggingOut : adminAccountMenuLabels.trigger
            }
            className={adminSecondaryButtonClassName}
            disabled={loggingOut}
            type="button"
            variant="outline"
          >
            {loggingOut ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <CircleUserRound aria-hidden="true" />
            )}
            {loggingOut ? adminAccountMenuLabels.loggingOut : adminAccountMenuLabels.trigger}
            {!loggingOut ? <ChevronDown aria-hidden="true" className="size-3.5" /> : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          aria-label="账户操作"
          className="min-w-40 border-[#d8c8b9] bg-[#fffaf2] text-[#2b211d]"
          style={adminThemeStyle}
        >
          <DropdownMenuItem asChild>
            <Link href="/">
              <Home aria-hidden="true" />
              {adminAccountMenuLabels.home}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#eaded1]" />
          <DropdownMenuItem
            disabled={loggingOut}
            onSelect={() => void handleLogout()}
            variant="destructive"
          >
            {loggingOut ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <LogOut aria-hidden="true" />
            )}
            {loggingOut ? adminAccountMenuLabels.loggingOut : adminAccountMenuLabels.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
