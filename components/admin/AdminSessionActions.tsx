'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button, Dropdown } from 'antd';
import {
  BookOutlined,
  DownOutlined,
  HomeOutlined,
  LoadingOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { adminToast } from '@/lib/admin/toast';
import { logoutCurrentSession } from '@/lib/auth/logout-client';

export const adminAccountMenuLabels = {
  trigger: '账户',
  home: '生成工作台',
  learn: '进入学员端',
  logout: '退出登录',
  loggingOut: '退出中',
} as const;

export function AdminAccountMenu() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logoutCurrentSession();
      window.location.assign('/');
    } catch {
      setLoggingOut(false);
      adminToast.error('退出登录失败');
    }
  }

  return (
    <Dropdown
      placement="bottomRight"
      menu={{
        'aria-label': '账户操作',
        items: [
          {
            key: 'home',
            icon: <HomeOutlined />,
            label: <Link href="/">{adminAccountMenuLabels.home}</Link>,
          },
          {
            key: 'learn',
            icon: <BookOutlined />,
            label: <Link href="/learn">{adminAccountMenuLabels.learn}</Link>,
          },
          { type: 'divider' },
          {
            key: 'logout',
            danger: true,
            disabled: loggingOut,
            icon: loggingOut ? <LoadingOutlined spin /> : <LogoutOutlined />,
            label: loggingOut ? adminAccountMenuLabels.loggingOut : adminAccountMenuLabels.logout,
          },
        ],
        onClick: ({ key }) => {
          if (key === 'logout') void handleLogout();
        },
      }}
    >
      <Button
        aria-busy={loggingOut}
        aria-label={loggingOut ? adminAccountMenuLabels.loggingOut : adminAccountMenuLabels.trigger}
        disabled={loggingOut}
        icon={loggingOut ? <LoadingOutlined spin /> : <UserOutlined />}
      >
        <span className="hidden sm:inline">
          {loggingOut ? adminAccountMenuLabels.loggingOut : adminAccountMenuLabels.trigger}
        </span>
        {!loggingOut ? <DownOutlined className="text-xs" /> : null}
      </Button>
    </Dropdown>
  );
}

/** Module headers retain only module-scoped controls such as refresh. */
export function AdminSessionActions({ leading }: { leading?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2">{leading}</div>;
}
