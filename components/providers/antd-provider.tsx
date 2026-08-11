'use client';

import { useEffect, type ReactNode } from 'react';
import { App as AntApp, ConfigProvider, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';

import { adminBrandTokens, adminSemanticTokens } from '@/components/admin/admin-theme';
import { bindAdminMessageApi } from '@/lib/admin/toast';
import { useTheme } from '@/lib/hooks/use-theme';

/**
 * The single Ant Design boundary for the application.  It deliberately does
 * not import `antd/dist/reset.css`: the editor and generation workbench rely
 * on their existing native styles.  Components opt into Ant Design styles when
 * they render, while this provider keeps their tokens and locale consistent.
 *
 * The algorithm follows the resolved theme (dark class on <html>), so portal
 * components (Dropdown/Menu/Pagination/… ) render with matching tokens.
 */
export function AntdProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
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
      <AntApp>
        <AdminMessageBridge />
        {children}
      </AntApp>
    </ConfigProvider>
  );
}

function AdminMessageBridge() {
  const { message } = AntApp.useApp();
  useEffect(() => {
    bindAdminMessageApi(message);
    return () => bindAdminMessageApi(null);
  }, [message]);
  return null;
}
