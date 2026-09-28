import { describe, expect, it } from "vitest";
import {
  createCsrfToken,
  hashSessionToken,
  newSessionToken,
  secureStringEqual
} from "../src/auth/crypto.js";

describe("auth crypto", () => {
  it("hashes opaque session tokens deterministically", () => {
    const token = newSessionToken();

    expect(token.length).toBeGreaterThan(32);
    expect(hashSessionToken(token)).toHaveLength(64);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("compares secrets in constant-length digests", () => {
    expect(secureStringEqual("same", "same")).toBe(true);
    expect(secureStringEqual("same", "different")).toBe(false);
  });

  it("binds CSRF tokens to session id and version", () => {
    const secret = "test-secret";
    const v1 = createCsrfToken(secret, "session-a", 1);
    const v2 = createCsrfToken(secret, "session-a", 2);
    const other = createCsrfToken(secret, "session-b", 1);

    expect(v1).not.toBe(v2);
    expect(v1).not.toBe(other);
    expect(v1).toBe(createCsrfToken(secret, "session-a", 1));
  });
});
