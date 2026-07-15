'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, Home, MessagesSquare } from 'lucide-react';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Button } from '@/components/ui/button';

export function ForumFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#f4f5f7] text-[#181a22] dark:bg-[#12141a] dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-[#d9dce3] bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-[#1a1d25]/95">
        <div className="mx-auto flex min-h-16 w-[min(1120px,calc(100%-2rem))] items-center justify-between gap-4 md:w-[min(1120px,calc(100%-3rem))]">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLockup variant="compact" priority />
            <span className="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
            <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <MessagesSquare className="size-3.5" />
              交流区
            </span>
          </div>
          <nav className="flex items-center gap-1" aria-label="交流区导航">
            <Button asChild variant="ghost" size="sm">
              <Link href="/forum">
                <BookOpen className="size-4" />
                <span className="hidden sm:inline">全部讨论</span>
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <Home className="size-4" />
                <span className="hidden sm:inline">学习中心</span>
              </Link>
            </Button>
          </nav>
        </div>
      </header>
      {children}
      <footer className="mx-auto mt-14 flex w-[min(1120px,calc(100%-2rem))] justify-between border-t border-[#d9dce3] py-5 text-[11px] text-slate-400 dark:border-slate-800 md:w-[min(1120px,calc(100%-3rem))]">
        <span>元我智脑</span>
        <Link
          href="/"
          className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <ArrowLeft className="size-3" /> 返回学习中心
        </Link>
      </footer>
    </div>
  );
}
