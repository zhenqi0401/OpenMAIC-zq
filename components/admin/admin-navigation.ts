import {
  BarChart3,
  BookOpen,
  ClipboardList,
  KeyRound,
  MessageSquareText,
  type LucideIcon,
} from 'lucide-react';

export type AdminModuleId = 'dashboard' | 'courses' | 'exams' | 'community' | 'access';

export interface AdminModule {
  id: AdminModuleId;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export const adminModules: AdminModule[] = [
  {
    id: 'dashboard',
    label: '数据看板',
    description: '学习与运营概览',
    href: '/admin?module=dashboard',
    icon: BarChart3,
  },
  {
    id: 'courses',
    label: '课程管理',
    description: '发布与可见范围',
    href: '/admin?module=courses',
    icon: BookOpen,
  },
  {
    id: 'exams',
    label: '考核管理',
    description: '考核配置与结果',
    href: '/admin?module=exams',
    icon: ClipboardList,
  },
  {
    id: 'community',
    label: '社区管理',
    description: '内容与操作审计',
    href: '/admin?module=community',
    icon: MessageSquareText,
  },
  {
    id: 'access',
    label: '用户管理',
    description: '用户、角色与邀请码',
    href: '/admin?module=access',
    icon: KeyRound,
  },
];
