import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function secureStringEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export function createCsrfToken(
  csrfSecret: string,
  sessionId: string,
  csrfVersion: number
): string {
  return createHmac("sha256", csrfSecret)
    .update(`${sessionId}:${csrfVersion}`)
    .digest("base64url");
}
