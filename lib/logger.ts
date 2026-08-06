const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

function getMinLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return env in LOG_LEVELS ? (env as LogLevel) : 'info';
}

function isJsonFormat(): boolean {
  return process.env.LOG_FORMAT === 'json';
}

/**
 * Preserve useful failure context when an Error is nested in a structured log.
 * Native JSON.stringify(Error) returns "{}", which hides the exact cause from
 * both operators and log-processing agents. Circular objects are represented
 * safely so diagnostics never fail while trying to serialize an error.
 */
function stringifyForLog(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, current: unknown) => {
    if (current instanceof Error) {
      return {
        name: current.name,
        message: current.message,
        ...(current.stack ? { stack: current.stack } : {}),
        ...(current.cause !== undefined ? { cause: current.cause } : {}),
      };
    }
    if (typeof current === 'object' && current !== null) {
      if (seen.has(current)) return '[Circular]';
      seen.add(current);
    }
    return current;
  });
}

function formatLine(level: LogLevel, tag: string, args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const upperLevel = level.toUpperCase();
  const msg = args
    .map((a) =>
      a instanceof Error ? (a.stack ?? a.message) : typeof a === 'string' ? a : stringifyForLog(a),
    )
    .join(' ');

  if (isJsonFormat()) {
    const structuredArgs = args
      .filter((arg) => typeof arg === 'object' && arg !== null)
      .map((arg) => JSON.parse(stringifyForLog(arg)) as unknown);
    return JSON.stringify({
      timestamp,
      level: upperLevel,
      tag,
      message: msg,
      ...(structuredArgs.length > 0
        ? { context: structuredArgs.length === 1 ? structuredArgs[0] : structuredArgs }
        : {}),
    });
  }
  return `[${timestamp}] [${upperLevel}] [${tag}] ${msg}`;
}

export function createLogger(tag: string) {
  const emit = (level: LogLevel, args: unknown[]) => {
    if (LOG_LEVELS[level] < LOG_LEVELS[getMinLevel()]) return;

    const line = formatLine(level, tag, args);

    // Console output
    const fn =
      level === 'debug'
        ? console.debug
        : level === 'warn'
          ? console.warn
          : level === 'error'
            ? console.error
            : console.log;
    fn(line);
  };

  return {
    debug: (...args: unknown[]) => emit('debug', args),
    info: (...args: unknown[]) => emit('info', args),
    warn: (...args: unknown[]) => emit('warn', args),
    error: (...args: unknown[]) => emit('error', args),
  };
}
