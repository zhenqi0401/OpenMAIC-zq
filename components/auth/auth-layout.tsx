import Link from 'next/link';
import type { ReactNode } from 'react';

import { BrandLockup } from '@/components/brand/BrandLockup';

type AuthMode = 'login' | 'register';

const content = {
  login: {
    eyebrow: '内部学习系统',
    storyTitle: '让每一次学习都有记录',
    lead: '登录后继续课程、完成练习，在同一个空间查看培训进度。',
    cardEyebrow: '登录后可使用',
    cardTitle: '继续你的企业学习任务',
    items: [
      ['课程内容', '按计划继续学习'],
      ['随堂练习', '巩固关键知识'],
      ['完成记录', '统一保存结果'],
    ],
    panelLabel: '员工账号',
    switchHref: '/register',
    switchLabel: '创建账号',
    footer: '账号由企业培训管理员统一维护。',
  },
  register: {
    eyebrow: '新员工入职',
    storyTitle: '用邀请码加入学习空间',
    lead: '填写姓名与联系方式，完成账号开通后即可开始课程。',
    cardEyebrow: '开通后可使用',
    cardTitle: '从第一门课开始',
    items: [
      ['个人档案', '绑定企业身份'],
      ['课程入口', '进入分配任务'],
      ['进度同步', '多端继续学习'],
    ],
    panelLabel: '创建员工账号',
    switchHref: '/login',
    switchLabel: '返回登录',
    footer: '邀请码由企业管理员发放，仅限内部使用。',
  },
} as const;

function AuthBrand({ responsive = false }: { responsive?: boolean }) {
  return (
    <div className="grid justify-items-start gap-1.5">
      <BrandLockup variant="full" priority />
      <span
        className={`text-xs tracking-[0.08em] text-muted-foreground ${
          responsive ? 'pl-14 max-[480px]:pl-12' : 'pl-14'
        }`}
      >
        企业学习平台
      </span>
    </div>
  );
}

export function AuthLayout({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  const page = content[mode];

  return (
    <main
      className="grid min-h-[100dvh] grid-cols-1 overflow-hidden bg-background text-foreground lg:grid-cols-[minmax(320px,0.95fr)_minmax(420px,1.05fr)] lg:overflow-hidden"
      data-auth-page={mode}
    >
      {/* 品牌故事栏 —— 仅在桌面显示 */}
      <aside
        aria-hidden="true"
        className="relative hidden min-h-[100dvh] flex-col gap-6 overflow-hidden border-r border-slate-200 bg-page px-10 pb-8 pt-7 lg:flex"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(90deg, transparent 0 39px, color-mix(in srgb, var(--primary) 6%, transparent) 39px 40px, transparent 40px), repeating-linear-gradient(180deg, transparent 0 35px, color-mix(in srgb, var(--primary) 4%, transparent) 35px 36px)',
          }}
        />
        <AuthBrand />

        <div className="relative mt-auto max-w-[31rem] pl-6">
          <p className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            {page.eyebrow}
          </p>
          <h1 className="mt-3 max-w-[11ch] text-[length:clamp(30px,3vw,44px)] leading-tight font-semibold tracking-tight text-balance text-foreground">
            {page.storyTitle}
          </h1>
          <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-muted-foreground">
            {page.lead}
          </p>
        </div>

        <section className="relative max-w-[31rem] rounded-xl border border-slate-200 bg-white/90 p-5 shadow-[0_10px_30px_rgba(2,32,71,0.06)]">
          <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-primary" aria-hidden="true" />
          <p className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            {page.cardEyebrow}
          </p>
          <h2 className="mt-2 text-[23px] leading-snug font-semibold tracking-tight text-foreground">
            {page.cardTitle}
          </h2>
          <ul className="mt-4 grid grid-cols-3 gap-2">
            {page.items.map(([title, description]) => (
              <li
                key={title}
                className="min-h-[76px] rounded-lg border border-slate-200 bg-page p-2.5 text-xs leading-snug text-muted-foreground"
              >
                <strong className="mb-1 block text-[13px] font-semibold text-foreground">
                  {title}
                </strong>
                {description}
              </li>
            ))}
          </ul>
        </section>
      </aside>

      {/* 表单栏 */}
      <section className="flex min-h-[100dvh] flex-col px-5 pt-5 pb-4 sm:px-7">
        <div className="mb-3.5 lg:hidden">
          <AuthBrand responsive />
        </div>

        <header className="flex min-h-10 items-start justify-between gap-4 border-b border-slate-200 pb-3 text-[13px] text-muted-foreground">
          <span>{page.panelLabel}</span>
          <Link
            href={page.switchHref}
            className="font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          >
            {page.switchLabel}
          </Link>
        </header>

        {children}

        <footer className="mt-auto border-t border-slate-200 pt-3.5 text-center text-xs text-muted-foreground [@media(max-height:700px)_and_(max-width:900px)]:hidden">
          {page.footer}
        </footer>
      </section>
    </main>
  );
}
