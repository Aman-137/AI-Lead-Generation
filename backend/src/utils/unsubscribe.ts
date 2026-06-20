import crypto from "crypto";

// =============================================
// Unsubscribe token (HMAC-signed, stateless)
// =============================================
// Encodes { userId, email } into a tamper-proof token used in the public
// unsubscribe link and the List-Unsubscribe header. No DB row needed — the
// token itself carries the identity and is verified by HMAC signature.
// Reuses TOKEN_ENCRYPTION_KEY as the signing secret (same pattern as Gmail OAuth state).

function getSigningKey(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error("TOKEN_ENCRYPTION_KEY required for unsubscribe token signing");
  return key;
}

// Sign { userId, email } → "payload.signature" (base64url). No expiry — an
// unsubscribe link must keep working indefinitely.
export function signUnsubToken(userId: string, email: string): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: email })).toString("base64url");
  const sig = crypto.createHmac("sha256", getSigningKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

// Verify the HMAC signature and return the decoded identity, or null if tampered/invalid.
export function verifyUnsubToken(token: string): { userId: string; email: string } | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", getSigningKey()).update(payload).digest("base64url");
  // Constant-time comparison to avoid timing leaks
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!obj.u || !obj.e) return null;
    return { userId: String(obj.u), email: String(obj.e) };
  } catch {
    return null;
  }
}

// Public base URL of the backend (where the unsubscribe endpoint lives).
// Prefers BACKEND_URL; falls back to the origin of GMAIL_REDIRECT_URI; then localhost.
export function getBackendBaseUrl(): string {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/+$/, "");
  const redirect = process.env.GMAIL_REDIRECT_URI;
  if (redirect) {
    try {
      const u = new URL(redirect);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* fall through */
    }
  }
  return "http://localhost:5000";
}

// Full unsubscribe URL for a given recipient.
export function buildUnsubscribeUrl(userId: string, email: string): string {
  return `${getBackendBaseUrl()}/api/unsubscribe/${signUnsubToken(userId, email)}`;
}
