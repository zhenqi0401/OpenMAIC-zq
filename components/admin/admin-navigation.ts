import type { ComponentType } from 'react';
import {
  BarChartOutlined,
  BookOutlined,
  CommentOutlined,
  ProfileOutlined,
  TeamOutlined,
} from '@ant-design/icons';

export type AdminModuleId = 'dashboard' | 'courses' | 'exams' | 'community' | 'access';

export interface AdminModule {
  id: AdminModuleId;
  label: string;
  description: string;
  href: string;
  icon: ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;
}

export const adminModules: AdminModule[] = [
  {
    id: 'dashboard',
    label: '数据看板',
    description: '学习与运营概览',
    href: '/admin?module=dashboard',
    icon: BarChartOutlined,
  },
  {
    id: 'courses',
    label: '课程管理',
    description: '发布与可见范围',
    href: '/admin?module=courses',
    icon: BookOutlined,
  },
  {
    id: 'exams',
    label: '考核管理',
    description: '考核配置与结果',
    href: '/admin?module=exams',
    icon: ProfileOutlined,
  },
  {
    id: 'community',
    label: '社区管理',
    description: '内容与操作审计',
    href: '/admin?module=community',
    icon: CommentOutlined,
  },
  {
    id: 'access',
    label: '用户管理',
    description: '用户、角色与邀请码',
    href: '/admin?module=access',
    icon: TeamOutlined,
  },
];
