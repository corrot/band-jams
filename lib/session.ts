// Session cookie: "<memberId>.<issuedAt>.<hmac>". memberId 0 = passed the band
// password but has not picked a profile yet. Works in Edge and Node runtimes.

export const COOKIE = "bj_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 180;

function secret() {
  const s = process.env.SESSION_SECRET || process.env.BAND_PASSWORD;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

async function hmac(data: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signSession(memberId: number) {
  const payload = `${memberId}.${Math.floor(Date.now() / 1000)}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function readSession(value: string | undefined | null): Promise<{ memberId: number } | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [id, iat, sig] = parts;
  const expected = await hmac(`${id}.${iat}`);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  const age = Date.now() / 1000 - Number(iat);
  if (!(age >= 0 && age < MAX_AGE_SEC)) return null;
  const memberId = Number(id);
  if (!Number.isInteger(memberId) || memberId < 0) return null;
  return { memberId };
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SEC,
};
