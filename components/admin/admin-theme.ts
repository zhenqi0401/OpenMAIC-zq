import type { CSSProperties } from 'react';

export const ADMIN_THEME_NAME = 'yuanwo-saas-admin' as const;

/**
 * Structured Stitch palette values. Admin product code must consume only the
 * semantic `--admin-*` contract below; these primitives stay in this file.
 */
export const adminBrandTokens = {
  '--saas-surface': '#f7f9fb',
  '--saas-surface-lowest': '#ffffff',
  '--saas-surface-low': '#f2f4f6',
  '--saas-surface-container': '#eceef0',
  '--saas-surface-highest': '#e0e3e5',
  '--saas-on-surface': '#191c1e',
  '--saas-on-surface-variant': '#424754',
  '--saas-outline': '#727785',
  '--saas-outline-variant': '#c2c6d6',
  '--saas-primary': '#0058be',
  '--saas-primary-hover': '#004395',
  '--saas-primary-active': '#001a42',
  '--saas-primary-container': '#2170e4',
  '--saas-primary-fixed': '#d8e2ff',
  '--saas-primary-fixed-dim': '#adc6ff',
  '--saas-success': '#006947',
  '--saas-danger': '#ba1a1a',
  '--saas-danger-strong': '#93000a',
  '--saas-danger-container': '#ffdad6',
  '--saas-warning': '#805610',
  '--saas-warning-container': '#fff3d6',
  '--saas-chart-interactions': '#6259d9',
  '--saas-chart-interactions-fill': 'rgba(98, 89, 217, 0.18)',
  '--saas-chart-interactions-fill-soft': 'rgba(98, 89, 217, 0.06)',
  '--saas-chart-interactions-fill-transparent': 'rgba(98, 89, 217, 0)',
} as const;

/** Stable semantic contract consumed by every admin component. */
export const adminSemanticTokens = {
  '--admin-page': 'var(--saas-surface)',
  '--admin-page-glow': 'transparent',
  '--admin-surface': 'var(--saas-surface-lowest)',
  '--admin-surface-subtle': 'var(--saas-surface-low)',
  '--admin-surface-selected': 'var(--saas-surface-container)',
  '--admin-foreground': 'var(--saas-on-surface)',
  '--admin-heading': 'var(--saas-on-surface)',
  '--admin-muted-foreground': 'var(--saas-on-surface-variant)',
  '--admin-disabled-foreground': 'var(--saas-outline)',
  '--admin-action-primary': 'var(--saas-primary)',
  '--admin-action-primary-hover': 'var(--saas-primary-hover)',
  '--admin-action-primary-active': 'var(--saas-primary-active)',
  '--admin-interactive-accent': 'var(--saas-primary-container)',
  '--admin-link': 'var(--saas-primary)',
  '--admin-link-hover': 'var(--saas-primary-hover)',
  '--admin-selection-background': 'var(--saas-primary-fixed)',
  '--admin-selection-foreground': 'var(--saas-primary-active)',
  '--admin-selection-border': 'var(--saas-primary-fixed-dim)',
  '--admin-selection-indicator': 'var(--saas-primary-container)',
  '--admin-border': 'var(--saas-outline-variant)',
  '--admin-border-subtle': 'var(--saas-surface-highest)',
  '--admin-border-interactive': 'var(--saas-outline)',
  '--admin-focus-ring': 'var(--saas-primary-container)',
  '--admin-success': 'var(--saas-success)',
  '--admin-success-strong': 'var(--saas-success)',
  '--admin-success-background':
    'color-mix(in srgb, var(--saas-success) 10%, var(--saas-surface-lowest))',
  '--admin-warning': 'var(--saas-warning)',
  '--admin-warning-strong': 'var(--saas-warning)',
  '--admin-warning-background': 'var(--saas-warning-container)',
  '--admin-danger': 'var(--saas-danger)',
  '--admin-danger-strong': 'var(--saas-danger-strong)',
  '--admin-danger-background': 'var(--saas-danger-container)',
  '--admin-chart-interactions': 'var(--saas-chart-interactions)',
  '--admin-chart-interactions-fill': 'var(--saas-chart-interactions-fill)',
  '--admin-chart-interactions-fill-soft': 'var(--saas-chart-interactions-fill-soft)',
  '--admin-chart-interactions-fill-transparent': 'var(--saas-chart-interactions-fill-transparent)',
  '--admin-chart-posts': 'var(--saas-primary-container)',
  '--admin-chart-replies': 'var(--saas-success)',
  '--admin-chart-danmaku': 'var(--saas-danger)',
  '--admin-radius-control': '8px',
  '--admin-radius-card': '8px',
  '--admin-radius-dialog': '12px',
  '--admin-shadow-card':
    '0 1px 3px color-mix(in srgb, var(--saas-on-surface) 5%, transparent), 0 1px 2px color-mix(in srgb, var(--saas-on-surface) 3%, transparent)',
  '--admin-shadow-popover':
    '0 10px 28px color-mix(in srgb, var(--saas-on-surface) 14%, transparent)',
  '--admin-font-sans':
    'Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif',
  '--admin-control-height': '40px',
  '--admin-sidebar-width': '260px',
  '--admin-sidebar-compact-width': '72px',
  '--admin-duration-fast': '120ms',
  '--admin-duration-normal': '180ms',
  '--admin-ease-standard': 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

const shadcnAdminTokens = {
  '--background': 'var(--admin-surface)',
  '--foreground': 'var(--admin-foreground)',
  '--primary': 'var(--admin-action-primary)',
  '--primary-foreground': 'var(--saas-surface-lowest)',
  '--secondary': 'var(--admin-surface-subtle)',
  '--secondary-foreground': 'var(--admin-foreground)',
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
