'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  App as AntApp,
  Avatar,
  Button,
  Dropdown,
  Layout,
  Menu,
} from 'antd';
import {
  BookOutlined,
  BulbOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { adminModules, type AdminModuleId } from '@/components/admin/admin-navigation';
import { ADMIN_THEME_NAME, adminThemeStyle } from '@/components/admin/admin-theme';
import { cn } from '@/lib/utils';
import { logoutCurrentSession } from '@/lib/auth/logout-client';
import { useTheme } from '@/lib/hooks/use-theme';
import { isDanmakuEnabled, isForumEnabled } from '@/lib/config/feature-flags';

export { adminModules } from '@/components/admin/admin-navigation';
export type { AdminModuleId } from '@/components/admin/admin-navigation';

export function visibleAdminModules() {
  return adminModules.filter(
    (module) => module.id !== 'community' || isDanmakuEnabled() || isForumEnabled(),
  );
}

interface AdminShellProps {
  activeModuleId?: AdminModuleId;
  children: ReactNode;
}

const SIDER_WIDTH = 260;
const SIDER_COLLAPSED_WIDTH = 72;

/**
 * 后台工作台骨架：antd Layout 侧栏式布局。侧栏从页面顶端开始，
 * Logo 与导航一体；内容区 Header 只保留统一账户触发器。
 */
export function AdminShell({ activeModuleId = 'dashboard', children }: AdminShellProps) {
  // 折叠状态记忆在本地：用惰性初始化读取，避免每次切页重新调整。
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('yuanwo-admin-sider-collapsed') === '1';
  });
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    window.localStorage.setItem('yuanwo-admin-sider-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  const routes = visibleAdminModules().map((module) => ({
    key: module.id,
    icon: <module.icon aria-hidden />,
    label: <Link href={module.href}>{module.label}</Link>,
  }));

  const navigation = (
    <Menu
      className="!border-0 bg-transparent"
      items={routes}
      mode="inline"
      selectedKeys={[activeModuleId]}
      style={{
        background: 'transparent',
        borderInlineEnd: 'none',
        fontWeight: 500,
      }}
    />
  );

  return (
    <div
      className="h-[100dvh] overflow-x-clip overflow-y-auto font-[family-name:var(--admin-font-sans)] text-[var(--admin-foreground)]"
      data-admin-layout="side"
      data-admin-theme={ADMIN_THEME_NAME}
      style={adminThemeStyle}
    >
      <Layout className="min-h-full !bg-[var(--admin-page)]">
        <Layout.Sider
          breakpoint="lg"
          className="!sticky !top-0 !h-[100dvh] !overflow-auto !bg-[var(--admin-surface)]"
          collapsed={collapsed}
          collapsedWidth={broken ? 0 : SIDER_COLLAPSED_WIDTH}
          collapsible
          data-admin-sider
          onBreakpoint={(isBroken) => {
            setBroken(isBroken);
            // 进入断点折叠，回到桌面宽度时恢复展开（避免卡在 72px 无法展开）
            setCollapsed(isBroken);
          }}
          onCollapse={setCollapsed}
          trigger={null}
          width={SIDER_WIDTH}
        >
          {/* Logo 区与导航之间用分割线区分；折叠时仅显示居中的标志，避免与折叠按钮互相遮挡 */}
          <div className="flex h-16 items-center justify-between gap-1 border-b border-[var(--admin-border-subtle)] py-2 pl-4 pr-2">
            <Link
              aria-label="回到生成工作台"
              className={cn('inline-flex min-w-0 items-center', collapsed && 'mx-auto')}
              href="/"
            >
              <BrandLockup priority variant={collapsed ? 'mark' : 'full'} />
            </Link>
          </div>
          <nav aria-label="后台模块导航" className="px-2 pt-3">
            {navigation}
          </nav>
        </Layout.Sider>

        <Layout className="!bg-transparent">
          <Layout.Header
            className="!flex !h-16 !items-center !justify-between !border-b !border-[var(--admin-border-subtle)] !bg-[var(--admin-surface)] !px-4"
            data-admin-header
          >
            {/* 折叠/展开按钮放在内容区顶栏左侧，折叠态不会遮挡侧边栏标志 */}
            {!broken ? (
              <Button
                aria-label={collapsed ? '展开导航栏' : '收起导航栏'}
                className="shrink-0 !border-[var(--admin-border-subtle)] !text-[var(--admin-muted-foreground)] hover:!text-[var(--admin-interactive-accent)]"
                icon={
                  collapsed ? <MenuUnfoldOutlined aria-hidden /> : <MenuFoldOutlined aria-hidden />
                }
                onClick={() => setCollapsed((value) => !value)}
                shape="circle"
                type="default"
              />
            ) : null}
            <AdminAccountTrigger />
          </Layout.Header>

          <Layout.Content className="!bg-transparent">
            <main
              className="mx-auto w-full max-w-[var(--admin-content-max-width)] px-4 py-5 sm:px-5 md:px-6 md:py-6"
              data-admin-shell="yuanwo-saas-admin"
            >
              {children}
            </main>
          </Layout.Content>
        </Layout>
      </Layout>
    </div>
  );
}

interface SessionUser {
  displayName?: string | null;
  phone?: string | null;
  role?: { name?: string | null; code?: string | null };
}

interface SessionPayload {
  authenticated?: boolean;
  user?: SessionUser;
  tenant?: { name?: string | null };
}

/**
 * 统一账户触发器：头像 + 姓名 + 角色·公司 合并为单个下拉入口，
 * 菜单内承载学习中心、主题设置与退出登录。
 */
function AdminAccountTrigger() {
  const [loggingOut, setLoggingOut] = useState(false);
  const [identity, setIdentity] = useState<{
    user: string;
    role: string;
    company: string;
  }>({ user: '读取中…', role: '读取中…', company: '读取中…' });
  const { message } = AntApp.useApp();
  const { setTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session')
      .then(async (response) => {
        if (!response.ok) throw new Error('当前用户读取失败');
        return (await response.json()) as SessionPayload;
      })
      .then((session) => {
        if (cancelled) return;
        const user = session.authenticated ? session.user : undefined;
        const company = session.authenticated
          ? session.tenant?.name?.trim() || '未知公司'
          : '未登录';
        const userLabel =
          user?.displayName?.trim() ||
          user?.phone?.trim() ||
          (user?.role ? '后台用户' : '未知用户') ||
          '未知用户';
        const roleLabel = user?.role?.name?.trim() || user?.role?.code?.trim() || '未知角色';
        setIdentity({ user: userLabel, role: roleLabel, company });
      })
      .catch(() => {
        if (!cancelled) setIdentity({ user: '无法读取', role: '无法读取', company: '无法读取' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logoutCurrentSession();
      window.location.assign('/');
    } catch {
      setLoggingOut(false);
      message.error('退出登录失败');
    }
  }

  const themeItems = [
    { key: 'light', icon: <SunOutlined />, label: '浅色' },
    { key: 'dark', icon: <MoonOutlined />, label: '深色' },
    { key: 'system', icon: <BulbOutlined />, label: '跟随系统' },
  ].map((item) => ({
    ...item,
    onClick: () => setTheme(item.key as 'light' | 'dark' | 'system'),
  }));

  return (
    <Dropdown
      menu={{
        'aria-label': '账户操作',
        items: [
          {
            key: 'home',
            icon: <HomeOutlined />,
            label: <Link href="/">生成工作台</Link>,
          },
          {
            key: 'learn',
            icon: <BookOutlined />,
            label: <Link href="/learn">进入学习中心</Link>,
          },
          {
            key: 'theme',
            icon: <SettingOutlined />,
            label: '主题设置',
            children: themeItems,
          },
          { type: 'divider' },
          {
            key: 'logout',
            danger: true,
            disabled: loggingOut,
            icon: <LogoutOutlined />,
            label: loggingOut ? '退出中…' : '退出登录',
          },
        ],
        onClick: ({ key }) => {
          if (key === 'logout') void handleLogout();
        },
      }}
      placement="bottomRight"
    >
      <button
        aria-label={`账户：${identity.user}，${identity.role}，${identity.company}`}
        className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-[var(--admin-border-subtle)] hover:bg-[var(--admin-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus-ring)]/30"
        data-admin-current-identity="trigger"
        type="button"
      >
        <Avatar
          className="shrink-0 !bg-[var(--admin-selection-background)] !text-sm !font-semibold !text-[var(--admin-interactive-accent)]"
          icon={<UserOutlined />}
          size={32}
        >
          {Array.from(identity.user)[0] ?? '管'}
        </Avatar>
        <span className="hidden min-w-0 flex-col md:flex">
          <strong className="truncate text-sm font-medium leading-5 text-[var(--admin-foreground)]">
            {identity.user}
          </strong>
          <span className="truncate text-xs leading-4 text-[var(--admin-muted-foreground)]">
            {identity.role} · {identity.company}
          </span>
        </span>
      </button>
    </Dropdown>
  );
}

interface AdminIdentityUser {
  id?: string;
  phone?: string | null;
  hostUserId?: string | null;
  displayName?: string | null;
  role?: { name?: string | null; code?: string | null };
}

export interface AdminIdentityLabels {
  company: string;
  user: string;
  role: string;
}

/** 会话身份格式化：用于统一账户触发器与测试。 */
export function formatAdminIdentity(
  user: AdminIdentityUser | null | undefined,
  tenant: { name?: string | null } | null | undefined,
): AdminIdentityLabels {
  const companyLabel = tenant?.name?.trim() || '未知公司';
  if (!user) return { company: companyLabel, user: '未知用户', role: '未知角色' };

  const userLabel =
    user.displayName?.trim() ||
    user.phone?.trim() ||
    user.hostUserId?.trim() ||
    user.id ||
    '未知用户';
  const roleName = user.role?.name?.trim();
  const roleCode = user.role?.code?.trim();
  const roleLabel =
    roleName && roleCode ? `${roleName}（${roleCode}）` : roleName || roleCode || '未知角色';

  return { company: companyLabel, user: userLabel, role: roleLabel };
}
