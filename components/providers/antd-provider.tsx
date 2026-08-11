'use client';

import type { ReactNode } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { theme as antdTheme } from 'antd';

import { adminBrandTokens, adminSemanticTokens } from '@/components/admin/admin-theme';

/**
 * The single Ant Design boundary for the application.  It deliberately does
 * not import `antd/dist/reset.css`: the editor and generation workbench rely
 * on their existing native styles.  Components opt into Ant Design styles when
 * they render, while this provider keeps their tokens and locale consistent.
 */
export function AntdProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: adminBrandTokens['--saas-primary'],
          colorInfo: adminBrandTokens['--saas-primary'],
          colorSuccess: adminBrandTokens['--saas-success'],
          colorWarning: adminBrandTokens['--saas-warning'],
          colorError: adminBrandTokens['--saas-danger'],
          // These values are resolved brand primitives rather than --admin-*
          // references because the provider also wraps learner/auth/forum
          // surfaces where AdminShell's scoped semantic variables do not exist.
          colorText: adminBrandTokens['--saas-on-surface'],
          colorTextSecondary: adminBrandTokens['--saas-on-surface-variant'],
          colorBgLayout: adminBrandTokens['--saas-surface'],
          colorBgContainer: adminBrandTokens['--saas-surface-lowest'],
          colorBorderSecondary: adminBrandTokens['--saas-outline-variant'],
          borderRadius: 8,
          borderRadiusLG: 12,
          controlHeight: 40,
          fontFamily: adminSemanticTokens['--admin-font-sans'],
        },
        components: {
          Layout: {
            headerBg: adminBrandTokens['--saas-surface-lowest'],
            bodyBg: adminBrandTokens['--saas-surface'],
            siderBg: adminBrandTokens['--saas-surface-lowest'],
          },
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
