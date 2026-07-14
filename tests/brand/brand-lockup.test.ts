import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BrandLockup } from '@/components/brand/BrandLockup';

describe('BrandLockup', () => {
  it.each(['full', 'compact', 'mark'] as const)('renders the %s variant', (variant) => {
    const markup = renderToStaticMarkup(React.createElement(BrandLockup, { variant }));

    expect(markup).toContain(`data-brand-lockup="${variant}"`);
    expect(markup).toContain('src="/brand/yuanwo-mark.png"');
    expect(markup).toContain('alt="元我智脑 Logo"');
    expect(markup).toContain('aria-label="元我智脑"');
    expect(markup.includes('元我智脑')).toBe(true);
  });

  it('keeps the mark-only variant free of visible wordmark text', () => {
    const markup = renderToStaticMarkup(
      React.createElement(BrandLockup, { variant: 'mark', ariaLabel: '元我智脑品牌标志' }),
    );

    expect(markup).toContain('aria-label="元我智脑品牌标志"');
    expect(markup).not.toContain('<span');
  });
});
