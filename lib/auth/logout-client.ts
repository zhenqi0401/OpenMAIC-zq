export type LogoutFetcher = (url: string, init?: RequestInit) => Promise<Response>;

interface LogoutResponseBody {
  success?: boolean;
  error?: string;
}

async function readLogoutResponse(response: Response): Promise<LogoutResponseBody> {
  try {
    const body = (await response.json()) as unknown;
    return typeof body === 'object' && body !== null ? (body as LogoutResponseBody) : {};
  } catch {
    return {};
  }
}

export async function logoutCurrentSession(fetcher: LogoutFetcher = fetch): Promise<void> {
  const response = await fetcher('/api/auth/logout', { method: 'POST' });
  const body = await readLogoutResponse(response);
  if (!response.ok || body.success === false) {
    throw new Error(body.error || 'Logout failed');
  }
}
