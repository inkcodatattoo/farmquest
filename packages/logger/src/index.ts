export type LogContext = Readonly<{
  requestId?: string;
  userId?: string;
  farmId?: string;
  module?: string;
  action?: string;
}>;

const REDACTED = "[REDACTED]";

export function redactSecrets(input: Record<string, unknown>): Record<string, unknown> {
  const sensitive = new Set([
    "authorization",
    "accessToken",
    "refreshToken",
    "sessionToken",
    "cookie",
    "internalApiToken"
  ]);

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      sensitive.has(key) ? REDACTED : value
    ])
  );
}
