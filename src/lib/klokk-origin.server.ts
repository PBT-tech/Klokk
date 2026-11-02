// The public address of the app, used in links inside emails (they carry secret
// event tokens, so they must never point at the wrong host).
//
// It is NEVER derived from the incoming request: a forged Host header could otherwise
// put an attacker's address into emails that carry event links. Set APP_ORIGIN to the
// live site address (for example https://app.klokk.com).

const FALLBACK = "https://klokk.com";

export async function appOrigin(): Promise<string> {
  const fixed = process.env["APP_ORIGIN"];
  if (fixed) {
    try {
      const u = new URL(fixed);
      if (u.protocol === "https:" || u.hostname === "localhost") return u.origin;
    } catch {
      /* fall through to the fixed default */
    }
    console.error("[klokk] APP_ORIGIN is not a valid https address; using the default");
  }
  return FALLBACK;
}
