// The public address of the app, used in links inside emails (they carry secret
// event tokens, so they must never point at the wrong host).

export async function appOrigin(): Promise<string> {
  const fixed = process.env["APP_ORIGIN"];
  if (fixed) return fixed.replace(/\/$/, "");
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const url = new URL(getRequest().url);
    return url.origin;
  } catch {
    return "https://klokk.com";
  }
}
