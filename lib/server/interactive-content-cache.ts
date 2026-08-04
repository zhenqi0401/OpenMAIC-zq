import { createHash } from 'node:crypto';

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 100;

export interface InteractiveContentResult {
  content: unknown;
  effectiveOutline: unknown;
}

interface CachedEntry {
  value: InteractiveContentResult;
  expiresAt: number;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`;
}

export function digestSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function createInteractiveRequestFingerprint(input: unknown): string {
  return createHash('sha256').update(stableSerialize(input)).digest('hex');
}

export class InteractiveRequestCoalescer {
  private readonly inFlight = new Map<string, Promise<InteractiveContentResult>>();
  private readonly successes = new Map<string, CachedEntry>();

  constructor(
    private readonly options: {
      ttlMs?: number;
      maxEntries?: number;
      now?: () => number;
    } = {},
  ) {}

  private cleanup(now: number): void {
    for (const [key, entry] of this.successes) {
      if (entry.expiresAt <= now) this.successes.delete(key);
    }

    const maxEntries = this.options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    while (this.successes.size > maxEntries) {
      let earliestKey: string | undefined;
      let earliestExpiry = Number.POSITIVE_INFINITY;
      for (const [key, entry] of this.successes) {
        if (entry.expiresAt < earliestExpiry) {
          earliestKey = key;
          earliestExpiry = entry.expiresAt;
        }
      }
      if (earliestKey === undefined) break;
      this.successes.delete(earliestKey);
    }
  }

  run(
    key: string,
    generate: () => Promise<InteractiveContentResult>,
  ): Promise<InteractiveContentResult> {
    const now = (this.options.now ?? Date.now)();
    this.cleanup(now);

    const cached = this.successes.get(key);
    if (cached) return Promise.resolve(cached.value);

    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = generate()
      .then((value) => {
        const completedAt = (this.options.now ?? Date.now)();
        this.successes.set(key, {
          value,
          expiresAt: completedAt + (this.options.ttlMs ?? DEFAULT_TTL_MS),
        });
        this.cleanup(completedAt);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, promise);
    return promise;
  }
}

export const interactiveRequestCoalescer = new InteractiveRequestCoalescer();
