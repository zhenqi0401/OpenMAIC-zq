import Link from 'next/link';
import type { ReactNode } from 'react';

import { BrandLockup } from '@/components/brand/BrandLockup';

import styles from './auth-page.module.css';

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

function AuthBrand() {
  return (
    <div className={styles.brandLockup}>
      <BrandLockup variant="full" priority />
      <span className={styles.brandDescriptor}>企业学习平台</span>
    </div>
  );
}

export function AuthLayout({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  const page = content[mode];

  return (
    <main className={styles.authShell} data-auth-page={mode}>
      <aside className={styles.story} aria-hidden="true">
        <AuthBrand />

        <div className={styles.storyBody}>
          <p className={styles.eyebrow}>{page.eyebrow}</p>
          <h1>{page.storyTitle}</h1>
          <p className={styles.lead}>{page.lead}</p>
        </div>

        <section className={styles.storyCard}>
          <p className={styles.eyebrow}>{page.cardEyebrow}</p>
          <h2>{page.cardTitle}</h2>
          <ul className={styles.storyList}>
            {page.items.map(([title, description]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span>{description}</span>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <section className={styles.formPanel}>
        <div className={styles.mobileBrand}>
          <AuthBrand />
        </div>

        <header className={styles.panelTop}>
          <span>{page.panelLabel}</span>
          <Link href={page.switchHref}>{page.switchLabel}</Link>
        </header>

        {children}

        <footer className={styles.panelFoot}>{page.footer}</footer>
      </section>
    </main>
  );
}
