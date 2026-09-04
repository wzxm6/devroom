// Centralized client logging.
//
// Console output is a development diagnostic only — browsers do not ship it
// anywhere. Errors logged here carry structured context so a future error
// reporter (e.g. Sentry) can hook into exactly one place: replace the body
// of report() without touching call sites. See docs/OPERATIONS.md.

export type LogContext = Record<string, unknown>;

const isDev = import.meta.env.DEV;

function report(level: 'warn' | 'error', message: string, context?: LogContext): void {
  // Hook point for a production error reporter. Until one is configured,
  // errors still reach the console so nothing is ever fully silent.
  if (isDev) {
    if (level === 'error') console.error(message, context ?? '');
    else console.warn(message, context ?? '');
  } else {
    console.error(message);
  }
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (isDev) console.debug(message, context ?? '');
  },
  info(message: string, context?: LogContext): void {
    if (isDev) console.info(message, context ?? '');
  },
  warn(message: string, context?: LogContext): void {
    report('warn', message, context);
  },
  error(message: string, context?: LogContext): void {
    report('error', message, context);
  },
};
