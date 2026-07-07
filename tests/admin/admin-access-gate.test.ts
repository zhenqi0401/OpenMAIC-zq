import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminAccessGate } from '@/components/admin/AdminAccessGate';

describe('AdminAccessGate', () => {
  it('does not mount admin data panels before the session permission check completes', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AdminAccessGate,
        null,
        React.createElement('div', null, 'secret admin panel'),
      ),
    );

    expect(markup).toContain('正在检查后台权限');
    expect(markup).not.toContain('secret admin panel');
  });
});
