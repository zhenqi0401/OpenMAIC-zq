import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const productionBrandTargets = [
  'app/page.tsx',
  'components/auth/auth-layout.tsx',
  'components/admin/AdminShell.tsx',
  'components/admin/AdminAccessGate.tsx',
  'components/home/LearnerHome.tsx',
  'components/stage/scene-sidebar.tsx',
  'components/edit/SlideNavRail/SlideNavRail.tsx',
  'components/scene-renderers/pbl/v2/workspace.tsx',
  'components/access-code-modal.tsx',
];

describe('元我智脑 production branding', () => {
  it('uses the shared lockup across every user-visible brand surface', () => {
    for (const path of productionBrandTargets) {
      const source = readFileSync(path, 'utf8');

      expect(source, path).toContain('BrandLockup');
      expect(source, path).not.toContain('/logo-horizontal.png');
      expect(source, path).not.toContain('/openmaic-mark.png');
      expect(source, path).not.toContain('alt="OpenMAIC"');
      expect(source, path).not.toContain('OpenMAIC Open Source Project');
    }
  });

  it('removes the authentication placeholder and exposes branded metadata and icons', () => {
    const authLayout = readFileSync('components/auth/auth-layout.tsx', 'utf8');
    const rootLayout = readFileSync('app/layout.tsx', 'utf8');

    expect(authLayout).not.toContain('品牌 Logo 占位');
    expect(authLayout).not.toMatch(/>\s*LOGO\s*</);
    expect(rootLayout).toContain("title: '元我智脑'");
    expect(rootLayout).toContain('/brand/yuanwo-mark.png');
    expect(rootLayout).toContain('/brand/yuanwo-apple-touch-icon.png');
  });

  it('keeps compatibility identifiers on the explicit allowlist', () => {
    expect(readFileSync('app/layout.tsx', 'utf8')).toContain("'@openmaic/renderer/fonts.css'");
    expect(readFileSync('lib/auth/session-cookie.ts', 'utf8')).toContain('openmaic_session');
    expect(readFileSync('app/api/auth/host-sso/route.ts', 'utf8')).toContain(
      'x-openmaic-signature',
    );
  });
});
