'use client';

import Link from 'next/link';
import { Avatar, Button, Dropdown, Layout, Menu, Space } from 'antd';
import {
  CheckOutlined,
  LogoutOutlined,
  MenuOutlined,
  MonitorOutlined,
  MoonOutlined,
  SafetyOutlined,
  SunOutlined,
} from '@ant-design/icons';
import { BrandLockup } from '@/components/brand/BrandLockup';
import type { SessionIdentity } from '@/lib/auth/types';
import { isForumEnabled } from '@/lib/config/feature-flags';
import { useTheme } from '@/lib/hooks/use-theme';

const THEME_OPTIONS = [
  ['light', '浅色', SunOutlined],
  ['dark', '深色', MoonOutlined],
  ['system', '跟随系统', MonitorOutlined],
] as const;

export function getDisplayNameInitial(displayName: string): string {
  return Array.from(displayName.trim())[0] ?? '用';
}

function UserIdentity({ displayName }: { displayName: string }) {
  return (
    <Space className="mr-1 min-w-0" size={10}>
      <Avatar
        style={{
          backgroundColor: 'color-mix(in srgb, var(--primary) 12%, white)',
          color: 'var(--primary)',
        }}
      >
        {getDisplayNameInitial(displayName)}
      </Avatar>
      <span className="max-w-36 truncate text-base font-medium">{displayName}</span>
    </Space>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === 'dark' ? MoonOutlined : theme === 'light' ? SunOutlined : MonitorOutlined;
  const items = THEME_OPTIONS.map(([value, label, OptionIcon]) => ({
    key: value,
    icon: <OptionIcon />,
    label: (
      <span className="flex items-center gap-2">
        {label}
        {theme === value ? <CheckOutlined /> : null}
      </span>
    ),
  }));
  return (
    <Dropdown
      menu={{ items, selectedKeys: [theme], onClick: ({ key }) => setTheme(key as typeof theme) }}
      placement="bottomRight"
    >
      <Button type="text" icon={<Icon />} aria-label="主题设置">
        主题
      </Button>
    </Dropdown>
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
  const items = [
    {
      key: 'identity',
      label: (
        <span className="font-semibold">
          {displayName} · {identity.roleCode}
        </span>
      ),
      disabled: true,
    },
    {
      key: 'theme',
      label: '主题',
      children: THEME_OPTIONS.map(([value, label, OptionIcon]) => ({
        key: value,
        icon: <OptionIcon />,
        label: (
          <span className="flex items-center gap-2">
            {label}
            {theme === value ? <CheckOutlined /> : null}
          </span>
        ),
      })),
    },
    ...(identity.isAdmin
      ? [
          {
            key: 'admin',
            icon: <SafetyOutlined />,
            label: <Link href="/admin">进入管理后台</Link>,
          },
        ]
      : []),
    { type: 'divider' as const },
    { key: 'logout', danger: true, icon: <LogoutOutlined />, label: '退出' },
  ];
  return (
    <Dropdown
      menu={{
        items,
        onClick: ({ key }) => {
          if (key === 'logout') void onLogout();
          if (THEME_OPTIONS.some(([value]) => value === key)) setTheme(key as typeof theme);
        },
      }}
      placement="bottomRight"
    >
      <Button type="text" icon={<MenuOutlined />} aria-label="打开用户菜单" />
    </Dropdown>
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
  const navItems = [
    { key: 'home', label: <Link href={homeHref}>首页</Link> },
    ...(forumEnabled
      ? [
          {
            key: 'forum',
            label: <Link href="/forum">交流社区</Link>,
          },
        ]
      : []),
  ];

  return (
    <Layout.Header
      className="sticky top-0 z-40 !h-16 !border-b !border-slate-200 !bg-white/95 !px-0 !leading-[64px] backdrop-blur-md dark:!border-slate-800 dark:!bg-card-solid/95"
      data-learner-header
    >
      <div className="mx-auto flex h-16 w-[min(1600px,calc(100%-1rem))] items-center gap-2 sm:w-[min(1600px,calc(100%-2rem))] sm:gap-3">
        <Link
          href={homeHref}
          aria-label="元我智脑学习首页"
          className="flex h-16 shrink-0 items-center"
        >
          <BrandLockup variant="compact" priority />
        </Link>
        <Menu
          mode="horizontal"
          selectedKeys={[current]}
          items={navItems}
          className="ml-auto min-w-0 flex-1 !border-0 !bg-transparent sm:ml-4"
          aria-label="学员端主导航"
        />
        <div className="hidden items-center gap-1 lg:flex">
          <UserIdentity displayName={displayName} />
          <ThemeMenu />
          {identity.isAdmin ? (
            <Link href="/admin">
              <Button type="text" icon={<SafetyOutlined />}>
                进入管理后台
              </Button>
            </Link>
          ) : null}
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={() => void onLogout()}
            aria-label="退出登录"
          >
            退出
          </Button>
        </div>
        <div className="lg:hidden">
          <MobileAccountMenu identity={identity} displayName={displayName} onLogout={onLogout} />
        </div>
      </div>
    </Layout.Header>
  );
}
