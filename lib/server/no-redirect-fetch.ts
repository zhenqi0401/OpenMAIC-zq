/**
 * Connectivity probes must never follow redirects. The caller already validates the
 * configured base URL; following a 3xx here would let that public URL redirect the
 * server to an unvalidated private target.
 */
export async function fetchWithoutRedirects(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  const response = await fetch(input, { ...init, redirect: 'manual' });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      `Redirect responses are not allowed during connectivity checks (${response.status})`,
    );
  }
  return response;
}
