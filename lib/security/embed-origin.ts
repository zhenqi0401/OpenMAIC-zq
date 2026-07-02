export function parseAllowedEmbedOrigins(raw = process.env.ALLOWED_EMBED_ORIGINS ?? ''): string[] {
  return raw
    .split(/[\s,]+/)
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedEmbedOrigin(
  origin: string,
  allowedOrigins = parseAllowedEmbedOrigins(),
): boolean {
  return allowedOrigins.includes(origin);
}
