/**
 * Minimal HS256 JWT sign/verify built on Web Crypto (Worker-safe).
 * Core is the identity provider; app tokens are signed with CORE_SIGNING_SECRET.
 */

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): Uint8Array<ArrayBuffer> {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const s = atob(input.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function signingSecret(): string {
  const secret = process.env["CORE_SIGNING_SECRET"];
  if (!secret) throw new Error("signing_secret_not_configured");
  return secret;
}

export async function signJwt(
  payload: Record<string, unknown>,
  ttlSeconds: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const head = b64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const claims = b64url(enc.encode(JSON.stringify(body)));
  const data = `${head}.${claims}`;
  const sig = await crypto.subtle.sign("HMAC", await key(signingSecret()), enc.encode(data));
  return `${data}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyJwt<T = Record<string, unknown>>(token: string): Promise<T | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [head, claims, sig] = parts as [string, string, string];
  const ok = await crypto.subtle.verify(
    "HMAC",
    await key(signingSecret()),
    b64urlDecode(sig),
    enc.encode(`${head}.${claims}`),
  );
  if (!ok) return null;
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(claims))) as {
    exp?: number;
  };
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload as T;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return b64url(buf);
}
