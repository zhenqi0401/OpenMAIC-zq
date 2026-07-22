import type { CSSProperties } from 'react';

export const ADMIN_THEME_NAME = 'yuanwo-blue' as const;

/**
 * Raw brand values. Product code must consume the semantic tokens below
 * instead of depending on these palette entries directly.
 */
export const adminBrandTokens = {
  '--yw-blue-950': '#042e59',
  '--yw-blue-900': '#063b70',
  '--yw-blue-800': '#07559a',
  '--yw-blue-700': '#086caf',
  '--yw-blue-600': '#087fc1',
  '--yw-blue-500': '#22a7e6',
  '--yw-blue-400': '#54c0ef',
  '--yw-blue-300': '#84d2f4',
  '--yw-blue-200': '#b9e3f7',
  '--yw-blue-100': '#e4f4fc',
  '--yw-blue-50': '#f3fafe',
  '--yw-slate-950': '#162b3a',
  '--yw-slate-900': '#263c4d',
  '--yw-slate-700': '#4f6575',
  '--yw-slate-600': '#687d8d',
  '--yw-slate-400': '#9babb7',
  '--yw-slate-300': '#bdcad3',
  '--yw-slate-200': '#d6e4ed',
  '--yw-slate-100': '#edf3f7',
  '--yw-slate-50': '#f7fafc',
  '--yw-green-700': '#216d4b',
  '--yw-green-600': '#27845a',
  '--yw-green-100': '#e8f5ee',
  '--yw-amber-700': '#87550f',
  '--yw-amber-600': '#a96d15',
  '--yw-amber-100': '#fff5dd',
  '--yw-red-700': '#9f332f',
  '--yw-red-600': '#c2413b',
  '--yw-red-100': '#fcebea',
} as const;

/** Semantic design tokens: the stable contract consumed by admin UI. */
export const adminSemanticTokens = {
  '--admin-page': 'var(--yw-blue-50)',
  '--admin-page-glow': 'rgba(34, 167, 230, 0.14)',
  '--admin-surface': '#ffffff',
  '--admin-surface-subtle': '#f8fcff',
  '--admin-surface-selected': 'var(--yw-blue-100)',
  '--admin-foreground': 'var(--yw-slate-900)',
  '--admin-heading': 'var(--yw-blue-900)',
  '--admin-muted-foreground': 'var(--yw-slate-600)',
  '--admin-disabled-foreground': 'var(--yw-slate-400)',
  '--admin-action-primary': 'var(--yw-blue-800)',
  '--admin-action-primary-hover': 'var(--yw-blue-900)',
  '--admin-action-primary-active': 'var(--yw-blue-950)',
  '--admin-interactive-accent': 'var(--yw-blue-500)',
  '--admin-link': 'var(--yw-blue-700)',
  '--admin-link-hover': 'var(--yw-blue-900)',
  '--admin-selection-background': 'var(--yw-blue-100)',
  '--admin-selection-foreground': 'var(--yw-blue-800)',
  '--admin-selection-border': 'var(--yw-blue-200)',
  '--admin-selection-indicator': 'var(--yw-blue-500)',
  '--admin-border': 'var(--yw-slate-200)',
  '--admin-border-subtle': 'var(--yw-slate-100)',
  '--admin-border-interactive': 'var(--yw-blue-200)',
  '--admin-focus-ring': 'var(--yw-blue-500)',
  '--admin-success': 'var(--yw-green-600)',
  '--admin-success-strong': 'var(--yw-green-700)',
  '--admin-success-background': 'var(--yw-green-100)',
  '--admin-warning': 'var(--yw-amber-600)',
  '--admin-warning-strong': 'var(--yw-amber-700)',
  '--admin-warning-background': 'var(--yw-amber-100)',
  '--admin-danger': 'var(--yw-red-600)',
  '--admin-danger-strong': 'var(--yw-red-700)',
  '--admin-danger-background': 'var(--yw-red-100)',
  '--admin-radius-control': '6px',
  '--admin-radius-card': '8px',
  '--admin-radius-dialog': '12px',
  '--admin-shadow-card': '0 1px 2px rgba(6, 59, 112, 0.04)',
  '--admin-shadow-popover': '0 12px 32px rgba(6, 42, 75, 0.14)',
  '--admin-duration-fast': '120ms',
  '--admin-duration-normal': '180ms',
  '--admin-ease-standard': 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

/** Adapter tokens keep the existing shadcn primitives inside the admin scope. */
const shadcnAdminTokens = {
  '--background': 'var(--admin-surface)',
  '--foreground': 'var(--admin-foreground)',
  '--primary': 'var(--admin-action-primary)',
  '--primary-foreground': '#ffffff',
  '--secondary': 'var(--admin-selection-background)',
  '--secondary-foreground': 'var(--admin-selection-foreground)',
  '--muted': 'var(--admin-surface-subtle)',
  '--muted-foreground': 'var(--admin-muted-foreground)',
  '--accent': 'var(--admin-selection-background)',
  '--accent-foreground': 'var(--admin-selection-foreground)',
  '--popover': 'var(--admin-surface)',
  '--popover-foreground': 'var(--admin-foreground)',
  '--border': 'var(--admin-border)',
  '--ring': 'var(--admin-focus-ring)',
  '--destructive': 'var(--admin-danger)',
} as const;

type AdminThemeProperties = CSSProperties & Record<`--${string}`, string>;

export const adminThemeStyle: AdminThemeProperties = {
  ...adminBrandTokens,
  ...adminSemanticTokens,
  ...shadcnAdminTokens,
};

/** Attach this to portalled overlays so they retain the scoped admin theme. */
export const adminThemeAttributes = {
  'data-admin-theme': ADMIN_THEME_NAME,
  style: adminThemeStyle,
} as const;
