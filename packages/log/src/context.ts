export const logLevels = ["error", "warn", "info", "debug"] as const;

export type LogLevel = (typeof logLevels)[number];
export type TraceId = string & { readonly __traceId: unique symbol };

export interface LogCorrelation {
  readonly traceId?: TraceId;
  readonly requestId?: string;
  readonly operationId?: string;
  readonly preparationId?: string;
  readonly nativeRunId?: string;
  readonly invocationId?: string;
}

export type LogContext = Readonly<Record<string, unknown>>;

const traceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const credentialKeyPattern =
  /^(?:authorization|cookie|set-cookie|bearer-token|bearertoken|token|access-token|accesstoken|refresh-token|refreshtoken|api-key|apikey|secret|password|private-key|privatekey|probe-credential|probecredential)$/i;
const bearerValuePattern = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i;

const priorities: Readonly<Record<LogLevel, number>> = Object.freeze({
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
});

export function createTraceId(): TraceId {
  return crypto.randomUUID() as TraceId;
}

export function isTraceId(value: unknown): value is TraceId {
  return typeof value === "string" && traceIdPattern.test(value);
}

export function requireTraceId(value: unknown): TraceId {
  if (!isTraceId(value)) throw new TypeError("Trace ID must be a UUID v4.");
  return value;
}

export function allowsLogLevel(configured: LogLevel, candidate: LogLevel): boolean {
  return priorities[candidate] <= priorities[configured];
}

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && logLevels.includes(value as LogLevel);
}

function normalizedKey(key: string): string {
  return key.trim().replaceAll("_", "-").replaceAll(".", "-");
}

export function isCredentialKey(key: string): boolean {
  return credentialKeyPattern.test(normalizedKey(key));
}

function sanitize(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return bearerValuePattern.test(value) ? "[redacted]" : value;
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "bigint"
  ) {
    return value;
  }
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack === undefined ? {} : { stack: value.stack }),
    };
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));
  if (typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (isCredentialKey(key)) continue;
      const safe = sanitize(nested, seen);
      if (safe !== undefined) result[key] = safe;
    }
    seen.delete(value);
    return result;
  }
  return String(value);
}

/**
 * Removes only known credentials from caller-supplied context. It deliberately
 * keeps normal local debugging material such as query, paths and native output.
 */
export function sanitizeLogContext(context: LogContext | undefined): LogContext | undefined {
  if (context === undefined) return undefined;
  const sanitized = sanitize(context, new WeakSet<object>());
  if (typeof sanitized !== "object" || sanitized === null || Array.isArray(sanitized))
    return undefined;
  return sanitized as LogContext;
}

export function pickCorrelation(context: LogContext): LogCorrelation {
  return {
    ...(isTraceId(context.traceId) ? { traceId: context.traceId } : {}),
    ...(typeof context.requestId === "string" ? { requestId: context.requestId } : {}),
    ...(typeof context.operationId === "string" ? { operationId: context.operationId } : {}),
    ...(typeof context.preparationId === "string" ? { preparationId: context.preparationId } : {}),
    ...(typeof context.nativeRunId === "string" ? { nativeRunId: context.nativeRunId } : {}),
    ...(typeof context.invocationId === "string" ? { invocationId: context.invocationId } : {}),
  };
}
