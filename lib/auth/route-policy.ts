import type { SessionIdentity } from './types';

const PUBLIC_PATHS = new Set(['/login', '/register']);

export function shouldShowAdminEntry(identity: SessionIdentity | null): boolean {
  return identity?.isAdmin === true;
}

export function getAuthRedirect(pathname: string, identity: SessionIdentity | null): string | null {
  if (!identity) {
    return PUBLIC_PATHS.has(pathname) ? null : '/login';
  }

  if (PUBLIC_PATHS.has(pathname)) return '/';
  if (pathname.startsWith('/admin') && !identity.isAdmin) return '/';
  if (pathname.startsWith('/generation-preview') && !identity.isAdmin) return '/';
  return null;
}
