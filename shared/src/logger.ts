type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function createLogger(service: string) {
  const threshold = LEVELS[(process.env.LOG_LEVEL as LogLevel) || "info"];

  function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (LEVELS[level] < threshold) return;
    const entry = { ts: new Date().toISOString(), level, service, message, ...meta };
    process.stderr.write(JSON.stringify(entry) + "\n");
  }

  return {
    debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
  };
}
