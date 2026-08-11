import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AdminRefreshButton } from '@/components/admin/AdminRefreshButton';

describe('AdminRefreshButton', () => {
  it('keeps the shared outline, icon, size and idle label', () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminRefreshButton, { loading: false, onRefresh: vi.fn() }),
    );

    expect(markup).toContain('data-admin-refresh-button="true"');
    expect(markup).toContain('data-variant="outline"');
    expect(markup).toContain('h-[var(--admin-control-height)]');
    expect(markup).toContain('lucide-refresh-cw');
    expect(markup).toContain('>刷新</span>');
    expect(markup).not.toContain('disabled=""');
  });

  it('spins, disables repeat clicks and exposes a busy label while loading', () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminRefreshButton, { loading: true, onRefresh: vi.fn() }),
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('animate-spin');
    expect(markup).toContain('刷新中…');
  });
});
