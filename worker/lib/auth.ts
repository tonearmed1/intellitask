// Password hashing (PBKDF2-SHA256 via Web Crypto, available in both Workers
// and Node so the same code can hash a password at setup time and verify it
// at login time) and opaque server-side session tokens.
import { eq, lt } from "drizzle-orm";
import type { Database } from "../db/client";
import { sessions } from "../db/schema";
import { newId, nowIso } from "./ids";

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_LENGTH_BITS = 256;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    KEY_LENGTH_BITS,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number.parseInt(parts[1], 10);
  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      key,
      expected.length * 8,
    ),
  );

  if (derived.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expected[i];
  return diff === 0;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: string;
}

export async function createSession(
  db: Database,
  userId: string,
): Promise<Session> {
  const id = newId("sess");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db.insert(sessions).values({
    id,
    userId,
    expiresAt,
    createdAt: nowIso(),
  });
  return { id, userId, expiresAt };
}

export async function getValidSession(
  db: Database,
  sessionId: string,
): Promise<Session | null> {
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;
  return { id: row.id, userId: row.userId, expiresAt: row.expiresAt };
}

export async function deleteSession(
  db: Database,
  sessionId: string,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function pruneExpiredSessions(db: Database): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, nowIso()));
}

const SESSION_COOKIE = "intellitask_session";
const CSRF_COOKIE = "intellitask_csrf";

export function buildSessionCookie(
  sessionId: string,
  expiresAt: string,
  secure: boolean,
): string {
  const expires = new Date(expiresAt).toUTCString();
  const attrs = [
    `${SESSION_COOKIE}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Expires=${expires}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function buildCsrfCookie(
  token: string,
  expiresAt: string,
  secure: boolean,
): string {
  const expires = new Date(expiresAt).toUTCString();
  const attrs = [
    `${CSRF_COOKIE}=${token}`,
    "Path=/",
    "SameSite=Strict",
    `Expires=${expires}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function clearAuthCookies(secure: boolean): string[] {
  const expired = "Thu, 01 Jan 1970 00:00:00 GMT";
  const secureAttr = secure ? "; Secure" : "";
  return [
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Expires=${expired}${secureAttr}`,
    `${CSRF_COOKIE}=; Path=/; SameSite=Strict; Expires=${expired}${secureAttr}`,
  ];
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getSessionCookieValue(header: string | null): string | null {
  return parseCookies(header)[SESSION_COOKIE] ?? null;
}

export function getCsrfCookieValue(header: string | null): string | null {
  return parseCookies(header)[CSRF_COOKIE] ?? null;
}

export function generateCsrfToken(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
