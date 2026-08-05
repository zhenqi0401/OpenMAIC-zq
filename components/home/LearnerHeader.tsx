'use client';

import Link from 'next/link';
import { Check, LogOut, Menu, Monitor, Moon, Shield, Sun } from 'lucide-react';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SessionIdentity } from '@/lib/auth/types';
import { isForumEnabled } from '@/lib/config/feature-flags';
import { useTheme } from '@/lib/hooks/use-theme';
import { cn } from '@/lib/utils';

const THEME_OPTIONS = [
  ['light', '浅色', Sun],
  ['dark', '深色', Moon],
  ['system', '跟随系统', Monitor],
] as const;

export function getDisplayNameInitial(displayName: string): string {
  return Array.from(displayName.trim())[0] ?? '用';
}

function UserIdentity({ displayName }: { displayName: string }) {
  return (
    <div className="mr-1 flex min-w-0 items-center gap-2.5">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full border border-violet-200 bg-violet-100 text-base font-semibold text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200"
        aria-hidden="true"
      >
        {getDisplayNameInitial(displayName)}
      </span>
      <span className="max-w-36 truncate text-base font-medium">{displayName}</span>
    </div>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 gap-2 px-3 text-sm"
          aria-label="主题设置"
        >
          <Icon className="size-4" />
          <span>主题</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-40">
        {THEME_OPTIONS.map(([value, label, OptionIcon]) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => setTheme(value)}
            className={cn(
              'min-h-11 gap-2',
              theme === value && 'text-violet-600 dark:text-violet-300',
            )}
          >
            <OptionIcon className="size-4" />
            {label}
            {theme === value && <Check className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileAccountMenu({
  identity,
  displayName,
  onLogout,
}: {
  identity: SessionIdentity;
  displayName: string;
  onLogout: () => Promise<void>;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label="打开用户菜单">
          <Menu className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-100 font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-200">
            {getDisplayNameInitial(displayName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {identity.roleCode}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="min-h-11">
            {theme === 'dark' ? (
              <Moon className="size-4" />
            ) : theme === 'light' ? (
              <Sun className="size-4" />
            ) : (
              <Monitor className="size-4" />
            )}
            主题
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-40">
            {THEME_OPTIONS.map(([value, label, OptionIcon]) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => setTheme(value)}
                className="min-h-11 gap-2"
              >
                <OptionIcon className="size-4" />
                {label}
                {theme === value && <Check className="ml-auto size-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {identity.isAdmin && (
          <DropdownMenuItem asChild className="min-h-11">
            <Link href="/admin">
              <Shield className="size-4" />
              管理后台
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="min-h-11"
          onSelect={() => void onLogout()}
        >
          <LogOut className="size-4" />
          退出
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LearnerHeader({
  identity,
  displayName,
  current,
  onLogout,
}: {
  identity: SessionIdentity;
  displayName: string;
  current: 'home' | 'forum';
  onLogout: () => Promise<void>;
}) {
  const homeHref = identity.isAdmin ? '/learn' : '/';
  const forumEnabled = isForumEnabled();
  const linkClass =
    'relative inline-flex min-h-11 items-center px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 sm:px-4 sm:text-base';
  const currentClass =
    'text-slate-950 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-blue-600 after:to-violet-600 dark:text-white sm:after:inset-x-4';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-[#171a22]/95">
      <div className="mx-auto flex min-h-16 w-[min(1600px,calc(100%-1rem))] items-center gap-0.5 sm:w-[min(1600px,calc(100%-2rem))] sm:gap-3">
        <Link
          href={homeHref}
          className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#171a22]"
          aria-label="元我智脑学习首页"
        >
          <BrandLockup variant="compact" priority />
        </Link>

        <nav className="ml-auto flex h-16 items-stretch sm:ml-4" aria-label="学员端主导航">
          <Link
            href={homeHref}
            aria-current={current === 'home' ? 'page' : undefined}
            className={cn(
              linkClass,
              current === 'home'
                ? currentClass
                : 'text-slate-600 hover:text-violet-700 dark:text-slate-300 dark:hover:text-violet-300',
            )}
          >
            首页
          </Link>
          {forumEnabled && (
            <Link
              href="/forum"
              aria-current={current === 'forum' ? 'page' : undefined}
              className={cn(
                linkClass,
                current === 'forum'
                  ? currentClass
                  : 'text-slate-600 hover:text-violet-700 dark:text-slate-300 dark:hover:text-violet-300',
              )}
            >
              <span className="sm:hidden">交流</span>
              <span className="hidden sm:inline">交流社区</span>
            </Link>
          )}
        </nav>

        <div className="ml-auto hidden items-center gap-1 lg:flex">
          <UserIdentity displayName={displayName} />
          <ThemeMenu />
          {identity.isAdmin && (
            <Button asChild variant="ghost" size="sm" className="min-h-11 gap-2 px-3">
              <Link href="/admin" aria-label="进入管理后台">
                <Shield className="size-4" />
                <span>管理后台</span>
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 gap-2 px-3"
            onClick={() => void onLogout()}
            aria-label="退出登录"
          >
            <LogOut className="size-4" />
            <span>退出</span>
          </Button>
        </div>

        <div className="lg:hidden">
          <MobileAccountMenu identity={identity} displayName={displayName} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}
