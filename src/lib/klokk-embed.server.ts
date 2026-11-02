// Embed link signing and verification (server only).
// An embed token is `emb.<payload>.<signature>` where the payload names the
// event token and the embed row, and the signature is an HMAC-SHA256 over the
// payload. The embed row (embed_tokens) is checked on every request so a link
// can be revoked immediately or expire without touching the host page.

export interface EmbedPayload {
  /** embed_tokens row id. The event is looked up from this row on every request, so the
   *  event's secret link token is never placed inside (or revealed by) an embed token. */
  i: string;
}

const enc = new TextEncoder();

function secret(): string {
  const s = process.env["EMBED_SIGNING_SECRET"];
  if (!s || s.length < 32) {
    throw new Error("EMBED_SIGNING_SECRET is not configured (needs 32+ characters)");
  }
  return s;
}

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signEmbed(payload: EmbedPayload): Promise<string> {
  const body = toB64Url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), enc.encode(body)));
  return `emb.${body}.${toB64Url(sig)}`;
}

/** Returns the payload when the signature is valid, otherwise null. */
export async function verifyEmbed(token: string): Promise<EmbedPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "emb") return null;
  const [, body, sig] = parts as [string, string, string];
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64Url(sig), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64Url(body))) as EmbedPayload;
    if (typeof payload.i !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}
