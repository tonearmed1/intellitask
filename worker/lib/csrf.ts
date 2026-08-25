import { getCsrfCookieValue } from "./auth";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_HEADER = "x-csrf-token";

/**
 * Double-submit cookie check: the CSRF cookie is non-HttpOnly so the client
 * JS can read it and echo it back in a header. A cross-site form post can
 * carry the cookie automatically but cannot read it to set the header, so a
 * mismatch indicates a forged request.
 */
export function isCsrfValid(
  method: string,
  cookieHeader: string | null,
  csrfHeader: string | null,
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;
  const cookieToken = getCsrfCookieValue(cookieHeader);
  if (!cookieToken || !csrfHeader) return false;
  return timingSafeEqual(cookieToken, csrfHeader);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export { CSRF_HEADER };
