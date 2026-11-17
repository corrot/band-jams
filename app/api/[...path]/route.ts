import { NextResponse, type NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { q, one, tx } from "@/lib/db";
import { COOKIE, cookieOptions, readSession, signSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const bad = (m: string) => new HttpError(400, m);
const forbidden = (m = "Not allowed") => new HttpError(403, m);
const notFound = (m = "Not found") => new HttpError(404, m);

type Ctx = { req: NextRequest; params: string[]; me: number; session: { memberId: number } | null; body: any };
type Handler = (ctx: Ctx) => Promise<unknown>;
type RouteDef = { method: string; parts: string[]; auth: "none" | "password" | "member"; fn: Handler };

const routes: RouteDef[] = [];
function route(method: string, pattern: string, auth: RouteDef["auth"], fn: Handler) {
  routes.push({ method, parts: pattern.split("/").filter(Boolean), auth, fn });
}

const STATUS_VALUES = ["new", "shortlist", "working", "done", "archived"];
const AUDIO_TYPES = ["audio/*", "video/*", "application/ogg", "application/octet-stream"];
const IMAGE_TYPES = ["image/*"];

const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const int = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw bad("Invalid id");
  return n;
};
const isBlobUrl = (u: unknown) => typeof u === "string" && /^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//i.test(u);
const blobOrNull = (u: unknown) => {
  if (u == null || u === "") return null;
  if (!isBlobUrl(u)) throw bad("File must be uploaded through the app");
  return u as string;
};

async function removeBlobs(urls: (string | null | undefined)[]) {
  const list = urls.filter((u): u is string => !!u && isBlobUrl(u));
  if (!list.length || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(list);
  } catch (e) {
    console.error("blob delete failed", e);
  }
}

function downsample(peaks: number[] | null, n: number) {
  if (!Array.isArray(peaks) || peaks.length <= n) return peaks;
  const out: number[] = [];
  const step = peaks.length / n;
  for (let i = 0; i < n; i++) {
    let m = 0;
    const a = Math.floor(i * step);
    const b = Math.max(a + 1, Math.floor((i + 1) * step));
    for (let j = a; j < b; j++) m = Math.max(m, Math.abs(peaks[j] || 0));
    out.push(Math.round(m * 1000) / 1000);
  }
  return out;
}

function cleanPeaks(p: unknown): number[] | null {
  if (!Array.isArray(p)) return null;
  const arr = p.slice(0, 4000).map((x) => {
    const n = Number(x);
    return Number.isFinite(n) ? Math.round(Math.min(1, Math.abs(n)) * 1000) / 1000 : 0;
  });
  return arr.length ? arr : null;
}

// ---------- auth ----------

route("GET", "auth/state", "none", async ({ session }) => {
  if (!session) return { stage: "password" };
  const members = await q("SELECT id, name, color, avatar_url FROM members ORDER BY name");
  if (session.memberId > 0) {
    const me = members.find((m: any) => m.id === session.memberId);
    if (me) return { stage: "in", me, members };
  }
  return { stage: "pick", members };
});

route("POST", "auth/login", "none", async ({ body }) => {
  const expected = process.env.BAND_PASSWORD;
  if (!expected) throw new HttpError(500, "BAND_PASSWORD is not configured");
  if (str(body?.password, 500) !== expected) throw new HttpError(401, "Wrong band password");
  const members = await q("SELECT id, name, color, avatar_url FROM members ORDER BY name");
  return withCookie({ stage: "pick", members }, await signSession(0));
});

route("POST", "auth/select", "password", async ({ body }) => {
  let id: number;
  if (body?.memberId) {
    const m = await one("SELECT id FROM members WHERE id = $1", [int(body.memberId)]);
    if (!m) throw notFound("Profile not found");
    id = m.id;
  } else {
    const name = str(body?.name, 60);
    if (!name) throw bad("Enter your name");
    const exists = await one("SELECT id FROM members WHERE lower(name) = lower($1)", [name]);
    if (exists) throw bad("That name is taken: pick it from the list instead");
    const colors = ["#f59e0b", "#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#f87171", "#60a5fa", "#facc15"];
    const count = (await one<{ c: number }>("SELECT count(*)::int c FROM members"))!.c;
    const m = await one("INSERT INTO members (name, color) VALUES ($1, $2) RETURNING id", [name, colors[count % colors.length]]);
    id = m.id;
  }
  return withCookie({ stage: "in", memberId: id }, await signSession(id));
});

route("POST", "auth/logout", "none", async () => withCookie({ ok: true }, null));

// ---------- uploads (Vercel Blob client uploads) ----------

route("POST", "upload", "member", async ({ req, body, me }) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError(500, "Blob storage is not connected");
  const result = await handleUpload({
    body: body as HandleUploadBody,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      const kind = pathname.split("/")[0];
      const images = kind === "images" || kind === "avatars";
      if (!["tracks", "comments", "images", "avatars"].includes(kind)) throw bad("Unknown upload folder");
      return {
        allowedContentTypes: images ? IMAGE_TYPES : AUDIO_TYPES,
        maximumSizeInBytes: images ? 25 * 1024 * 1024 : 2 * 1024 * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ me }),
      };
    },
  });
  return result;
});

// ---------- members & instruments ----------

route("GET", "members", "member", async () => {
  const members = await q("SELECT * FROM members ORDER BY name");
  const inst = await q("SELECT * FROM instruments ORDER BY kind, name");
  return members.map((m: any) => ({ ...m, instruments: inst.filter((i: any) => i.member_id === m.id) }));
});

route("GET", "members/:id", "member", async ({ params }) => {
  const id = int(params[0]);
  const m = await one("SELECT * FROM members WHERE id = $1", [id]);
  if (!m) throw notFound();
  m.instruments = await q("SELECT * FROM instruments WHERE member_id = $1 ORDER BY kind, name", [id]);
  return m;
});

route("PATCH", "members/:id", "member", async ({ params, me, body }) => {
  const id = int(params[0]);
  if (id !== me) throw forbidden("You can only edit your own profile");
  const cur = await one("SELECT * FROM members WHERE id = $1", [id]);
  if (!cur) throw notFound();
  const name = body.name !== undefined ? str(body.name, 60) : cur.name;
  if (!name) throw bad("Name can't be empty");
  const clash = await one("SELECT id FROM members WHERE lower(name) = lower($1) AND id <> $2", [name, id]);
  if (clash) throw bad("Another member already uses that name");
  const bio = body.bio !== undefined ? str(body.bio, 2000) : cur.bio;
  const color = body.color !== undefined && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : cur.color;
  let avatar = cur.avatar_url;
  if (body.avatar_url !== undefined) {
    avatar = blobOrNull(body.avatar_url);
    if (cur.avatar_url && cur.avatar_url !== avatar) await removeBlobs([cur.avatar_url]);
  }
  return one("UPDATE members SET name=$1, bio=$2, color=$3, avatar_url=$4 WHERE id=$5 RETURNING *", [name, bio, color, avatar, id]);
});

route("POST", "members/:id/instruments", "member", async ({ params, me, body }) => {
  const id = int(params[0]);
  if (id !== me) throw forbidden("You can only edit your own instruments");
  const name = str(body.name, 120);
  if (!name) throw bad("Instrument name is required");
  return one("INSERT INTO instruments (member_id, name, kind, details) VALUES ($1,$2,$3,$4) RETURNING *", [
    id,
    name,
    str(body.kind, 60) || "Other",
    str(body.details, 2000),
  ]);
});

route("PATCH", "instruments/:id", "member", async ({ params, me, body }) => {
  const id = int(params[0]);
  const cur = await one("SELECT * FROM instruments WHERE id = $1", [id]);
  if (!cur) throw notFound();
  if (cur.member_id !== me) throw forbidden();
  const name = body.name !== undefined ? str(body.name, 120) : cur.name;
  if (!name) throw bad("Instrument name is required");
  return one("UPDATE instruments SET name=$1, kind=$2, details=$3 WHERE id=$4 RETURNING *", [
    name,
    body.kind !== undefined ? str(body.kind, 60) || "Other" : cur.kind,
    body.details !== undefined ? str(body.details, 2000) : cur.details,
    id,
  ]);
});

route("DELETE", "instruments/:id", "member", async ({ params, me }) => {
  const id = int(params[0]);
  const cur = await one("SELECT * FROM instruments WHERE id = $1", [id]);
  if (!cur) throw notFound();
  if (cur.member_id !== me) throw forbidden();
  await q("DELETE FROM instruments WHERE id = $1", [id]);
  return { ok: true };
});

// ---------- tracks ----------

const TRACK_SELECT = `
  SELECT t.*,
    COALESCE((SELECT SUM(value) FROM track_votes v WHERE v.track_id = t.id), 0)::int AS score,
    COALESCE((SELECT json_agg(json_build_object('member_id', v.member_id, 'value', v.value)) FROM track_votes v WHERE v.track_id = t.id), '[]'::json) AS votes,
    (SELECT count(*) FROM comments c WHERE c.track_id = t.id AND c.start_sec IS NULL)::int AS comment_count,
    (SELECT count(*) FROM comments c WHERE c.track_id = t.id AND c.start_sec IS NOT NULL)::int AS bookmark_count,
    (SELECT count(*) FROM track_links l WHERE l.track_a = t.id OR l.track_b = t.id)::int AS link_count
  FROM tracks t`;

function fixTrack(t: any, peaksN?: number) {
  return {
    ...t,
    size_bytes: Number(t.size_bytes),
    peaks: peaksN ? downsample(t.peaks, peaksN) : t.peaks,
  };
}

route("GET", "tracks", "member", async () => {
  const rows = await q(`${TRACK_SELECT} ORDER BY COALESCE(t.recorded_at, t.created_at) DESC, t.id DESC`);
  return rows.map((t) => fixTrack(t, 160));
});

route("POST", "tracks", "member", async ({ me, body }) => {
  const url = blobOrNull(body.file_url);
  if (!url) throw bad("Missing file");
  const title = str(body.title, 200) || str(body.file_name, 200) || "Untitled jam";
  const recorded = body.recorded_at ? new Date(body.recorded_at) : null;
  const t = await one(
    `INSERT INTO tracks (title, description, file_url, file_name, content_type, size_bytes, duration_sec, recorded_at, peaks, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [
      title,
      str(body.description, 5000),
      url,
      str(body.file_name, 300),
      str(body.content_type, 100),
      Math.max(0, Math.round(num(body.size_bytes) ?? 0)),
      num(body.duration_sec),
      recorded && !isNaN(recorded.getTime()) ? recorded.toISOString() : null,
      JSON.stringify(cleanPeaks(body.peaks)),
      me,
    ],
  );
  return fixTrack(await one(`${TRACK_SELECT} WHERE t.id = $1`, [t.id]), 160);
});

route("GET", "tracks/:id", "member", async ({ params }) => {
  const id = int(params[0]);
  const t = await one(`${TRACK_SELECT} WHERE t.id = $1`, [id]);
  if (!t) throw notFound("Track not found");
  const comments = await q(
    `SELECT c.*, COALESCE((
        SELECT json_agg(json_build_object('emoji', r.emoji, 'member_ids', r.ids) ORDER BY r.first)
        FROM (SELECT emoji, array_agg(member_id ORDER BY member_id) ids, min(ctid::text) first FROM comment_reactions WHERE comment_id = c.id GROUP BY emoji) r
      ), '[]'::json) AS reactions
     FROM comments c WHERE c.track_id = $1 ORDER BY c.created_at`,
    [id],
  );
  const links = await q(
    `SELECT l.id, l.label, json_build_object('id', o.id, 'title', o.title, 'duration_sec', o.duration_sec, 'status', o.status, 'recorded_at', o.recorded_at) AS other
     FROM track_links l JOIN tracks o ON o.id = CASE WHEN l.track_a = $1 THEN l.track_b ELSE l.track_a END
     WHERE l.track_a = $1 OR l.track_b = $1 ORDER BY l.created_at`,
    [id],
  );
  const instruments = await q(
    `SELECT ti.*, COALESCE((SELECT json_agg(json_build_object('id', i.id, 'url', i.url, 'caption', i.caption) ORDER BY i.id)
        FROM track_instrument_images i WHERE i.track_instrument_id = ti.id), '[]'::json) AS images
     FROM track_instruments ti WHERE ti.track_id = $1 ORDER BY ti.id`,
    [id],
  );
  return { ...fixTrack(t), comments, links, instruments };
});

route("PATCH", "tracks/:id", "member", async ({ params, body }) => {
  const id = int(params[0]);
  const cur = await one("SELECT * FROM tracks WHERE id = $1", [id]);
  if (!cur) throw notFound();
  const title = body.title !== undefined ? str(body.title, 200) : cur.title;
  if (!title) throw bad("Title can't be empty");
  const status = body.status !== undefined ? String(body.status) : cur.status;
  if (!STATUS_VALUES.includes(status)) throw bad("Unknown status");
  let recorded = cur.recorded_at;
  if (body.recorded_at !== undefined) {
    const d = body.recorded_at ? new Date(body.recorded_at) : null;
    recorded = d && !isNaN(d.getTime()) ? d.toISOString() : null;
  }
  await q("UPDATE tracks SET title=$1, description=$2, status=$3, recorded_at=$4 WHERE id=$5", [
    title,
    body.description !== undefined ? str(body.description, 5000) : cur.description,
    status,
    recorded,
    id,
  ]);
  return fixTrack(await one(`${TRACK_SELECT} WHERE t.id = $1`, [id]));
});

route("PUT", "tracks/:id/peaks", "member", async ({ params, body }) => {
  const id = int(params[0]);
  const peaks = cleanPeaks(body.peaks);
  const dur = num(body.duration_sec);
  await q("UPDATE tracks SET peaks = COALESCE($1::jsonb, peaks), duration_sec = COALESCE($2, duration_sec) WHERE id = $3", [
    peaks ? JSON.stringify(peaks) : null,
    dur,
    id,
  ]);
  return { ok: true };
});

route("DELETE", "tracks/:id", "member", async ({ params, me }) => {
  const id = int(params[0]);
  const cur = await one("SELECT * FROM tracks WHERE id = $1", [id]);
  if (!cur) throw notFound();
  if (cur.uploaded_by !== null && cur.uploaded_by !== me) throw forbidden("Only the person who uploaded a track can delete it");
  const audio = await q("SELECT audio_url FROM comments WHERE track_id = $1 AND audio_url IS NOT NULL", [id]);
  const imgs = await q(
    "SELECT i.url FROM track_instrument_images i JOIN track_instruments ti ON ti.id = i.track_instrument_id WHERE ti.track_id = $1",
    [id],
  );
  await q("DELETE FROM tracks WHERE id = $1", [id]);
  await removeBlobs([cur.file_url, ...audio.map((a: any) => a.audio_url), ...imgs.map((i: any) => i.url)]);
  return { ok: true };
});

route("PUT", "tracks/:id/vote", "member", async ({ params, me, body }) => {
  const id = int(params[0]);
  const value = Number(body.value);
  if (![-1, 0, 1, 2].includes(value)) throw bad("Invalid vote");
  if (!(await one("SELECT id FROM tracks WHERE id = $1", [id]))) throw notFound();
  if (value === 0) await q("DELETE FROM track_votes WHERE track_id = $1 AND member_id = $2", [id, me]);
  else
    await q(
      `INSERT INTO track_votes (track_id, member_id, value) VALUES ($1,$2,$3)
       ON CONFLICT (track_id, member_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [id, me, value],
    );
  return one(
    `SELECT COALESCE(SUM(value),0)::int score, COALESCE(json_agg(json_build_object('member_id', member_id, 'value', value)) FILTER (WHERE member_id IS NOT NULL), '[]'::json) votes
     FROM track_votes WHERE track_id = $1`,
    [id],
  );
});

// ---------- links ----------

route("POST", "tracks/:id/links", "member", async ({ params, me, body }) => {
  const a = int(params[0]);
  const b = int(body.other_id);
  if (a === b) throw bad("A track can't link to itself");
  const exists = await q("SELECT id FROM tracks WHERE id = ANY($1)", [[a, b]]);
  if (exists.length !== 2) throw notFound("Track not found");
  try {
    return await one("INSERT INTO track_links (track_a, track_b, label, created_by) VALUES ($1,$2,$3,$4) RETURNING *", [
      a,
      b,
      str(body.label, 60) || "Related",
      me,
    ]);
  } catch (e: any) {
    if (e?.code === "23505") throw bad("These tracks are already connected");
    throw e;
  }
});

route("PATCH", "links/:id", "member", async ({ params, body }) => {
  const r = await one("UPDATE track_links SET label = $1 WHERE id = $2 RETURNING *", [str(body.label, 60) || "Related", int(params[0])]);
  if (!r) throw notFound();
  return r;
});

route("DELETE", "links/:id", "member", async ({ params }) => {
  await q("DELETE FROM track_links WHERE id = $1", [int(params[0])]);
  return { ok: true };
});

// ---------- comments, bookmarks, reactions ----------

route("POST", "tracks/:id/comments", "member", async ({ params, me, body }) => {
  const trackId = int(params[0]);
  const t = await one("SELECT id, duration_sec FROM tracks WHERE id = $1", [trackId]);
  if (!t) throw notFound("Track not found");
  const text = str(body.body, 5000);
  const audio = blobOrNull(body.audio_url);
  let start = num(body.start_sec);
  let end = num(body.end_sec);
  let parent: number | null = null;
  if (body.parent_id) {
    parent = int(body.parent_id);
    const p = await one("SELECT track_id, parent_id FROM comments WHERE id = $1", [parent]);
    if (!p || p.track_id !== trackId) throw bad("Reply target not found");
    if (p.parent_id) parent = p.parent_id; // keep threads one level deep
    start = end = null;
  }
  if (start !== null) {
    start = Math.max(0, start);
    if (end !== null && end <= start + 0.05) end = null;
  } else end = null;
  if (!text && !audio) throw bad("Write something or attach audio");
  if (start !== null && !text) throw bad("Bookmarks need a note");
  const c = await one(
    `INSERT INTO comments (track_id, member_id, parent_id, body, start_sec, end_sec, audio_url, audio_name, audio_duration)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [trackId, me, parent, text, start, end, audio, audio ? str(body.audio_name, 200) || "audio" : null, audio ? num(body.audio_duration) : null],
  );
  return { ...c, reactions: [] };
});

route("PATCH", "comments/:id", "member", async ({ params, me, body }) => {
  const id = int(params[0]);
  const cur = await one("SELECT * FROM comments WHERE id = $1", [id]);
  if (!cur) throw notFound();
  if (cur.member_id !== me) throw forbidden("You can only edit your own comments");
  const text = body.body !== undefined ? str(body.body, 5000) : cur.body;
  if (!text && !cur.audio_url) throw bad("Comment can't be empty");
  let start = cur.start_sec;
  let end = cur.end_sec;
  if (cur.start_sec !== null && body.start_sec !== undefined) {
    start = Math.max(0, num(body.start_sec) ?? cur.start_sec);
    end = num(body.end_sec);
    if (end !== null && end <= start + 0.05) end = null;
  }
  const c = await one("UPDATE comments SET body=$1, start_sec=$2, end_sec=$3, edited_at=now() WHERE id=$4 RETURNING *", [text, start, end, id]);
  return c;
});

route("DELETE", "comments/:id", "member", async ({ params, me }) => {
  const id = int(params[0]);
  const cur = await one("SELECT * FROM comments WHERE id = $1", [id]);
  if (!cur) throw notFound();
  if (cur.member_id !== me) throw forbidden("You can only delete your own comments");
  const audio = await q("SELECT audio_url FROM comments WHERE (id = $1 OR parent_id = $1) AND audio_url IS NOT NULL", [id]);
  await q("DELETE FROM comments WHERE id = $1", [id]);
  await removeBlobs(audio.map((a: any) => a.audio_url));
  return { ok: true };
});

route("POST", "comments/:id/reactions", "member", async ({ params, me, body }) => {
  const id = int(params[0]);
  const emoji = str(body.emoji, 16);
  if (!emoji) throw bad("Pick an emoji");
  if (!(await one("SELECT id FROM comments WHERE id = $1", [id]))) throw notFound();
  const removed = await q("DELETE FROM comment_reactions WHERE comment_id=$1 AND member_id=$2 AND emoji=$3 RETURNING emoji", [id, me, emoji]);
  if (!removed.length) await q("INSERT INTO comment_reactions (comment_id, member_id, emoji) VALUES ($1,$2,$3)", [id, me, emoji]);
  return q(
    `SELECT emoji, array_agg(member_id ORDER BY member_id) member_ids FROM comment_reactions WHERE comment_id = $1 GROUP BY emoji ORDER BY min(ctid::text)`,
    [id],
  );
});

// ---------- track instruments & settings images ----------

route("POST", "tracks/:id/instruments", "member", async ({ params, body }) => {
  const trackId = int(params[0]);
  if (!(await one("SELECT id FROM tracks WHERE id = $1", [trackId]))) throw notFound();
  let name = str(body.name, 120);
  let memberId = body.member_id ? int(body.member_id) : null;
  let instrumentId = body.instrument_id ? int(body.instrument_id) : null;
  if (instrumentId) {
    const inst = await one("SELECT * FROM instruments WHERE id = $1", [instrumentId]);
    if (!inst) throw notFound("Instrument not found");
    name = name || inst.name;
    memberId = memberId ?? inst.member_id;
  }
  if (!name) throw bad("Instrument name is required");
  const r = await one(
    "INSERT INTO track_instruments (track_id, member_id, instrument_id, name, settings) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [trackId, memberId, instrumentId, name, str(body.settings, 10000)],
  );
  return { ...r, images: [] };
});

route("PATCH", "track-instruments/:id", "member", async ({ params, body }) => {
  const id = int(params[0]);
  const cur = await one("SELECT * FROM track_instruments WHERE id = $1", [id]);
  if (!cur) throw notFound();
  const name = body.name !== undefined ? str(body.name, 120) : cur.name;
  if (!name) throw bad("Instrument name is required");
  const memberId = body.member_id !== undefined ? (body.member_id ? int(body.member_id) : null) : cur.member_id;
  return one("UPDATE track_instruments SET name=$1, settings=$2, member_id=$3 WHERE id=$4 RETURNING *", [
    name,
    body.settings !== undefined ? str(body.settings, 10000) : cur.settings,
    memberId,
    id,
  ]);
});

route("DELETE", "track-instruments/:id", "member", async ({ params }) => {
  const id = int(params[0]);
  const imgs = await q("SELECT url FROM track_instrument_images WHERE track_instrument_id = $1", [id]);
  await q("DELETE FROM track_instruments WHERE id = $1", [id]);
  await removeBlobs(imgs.map((i: any) => i.url));
  return { ok: true };
});

route("POST", "track-instruments/:id/images", "member", async ({ params, me, body }) => {
  const id = int(params[0]);
  if (!(await one("SELECT id FROM track_instruments WHERE id = $1", [id]))) throw notFound();
  const url = blobOrNull(body.url);
  if (!url) throw bad("Missing image");
  return one("INSERT INTO track_instrument_images (track_instrument_id, url, caption, created_by) VALUES ($1,$2,$3,$4) RETURNING id, url, caption", [
    id,
    url,
    str(body.caption, 300),
    me,
  ]);
});

route("PATCH", "images/:id", "member", async ({ params, body }) => {
  const r = await one("UPDATE track_instrument_images SET caption = $1 WHERE id = $2 RETURNING id, url, caption", [
    str(body.caption, 300),
    int(params[0]),
  ]);
  if (!r) throw notFound();
  return r;
});

route("DELETE", "images/:id", "member", async ({ params }) => {
  const r = await one("DELETE FROM track_instrument_images WHERE id = $1 RETURNING url", [int(params[0])]);
  if (r) await removeBlobs([r.url]);
  return { ok: true };
});

// ---------- dispatcher ----------

const RESPONSE_COOKIE = Symbol("cookie");
function withCookie(data: any, value: string | null) {
  return { [RESPONSE_COOKIE]: value, data };
}

async function dispatch(req: NextRequest, segs: string[]) {
  const method = req.method.toUpperCase();
  let matched: RouteDef | null = null;
  let params: string[] = [];
  let pathMatched = false;
  for (const r of routes) {
    if (r.parts.length !== segs.length) continue;
    const p: string[] = [];
    let ok = true;
    for (let i = 0; i < r.parts.length; i++) {
      if (r.parts[i].startsWith(":")) p.push(segs[i]);
      else if (r.parts[i] !== segs[i]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    pathMatched = true;
    if (r.method === method) {
      matched = r;
      params = p;
      break;
    }
  }
  try {
    if (!matched) throw new HttpError(pathMatched ? 405 : 404, pathMatched ? "Method not allowed" : "Unknown endpoint");
    const session = await readSession(req.cookies.get(COOKIE)?.value);
    if (matched.auth !== "none" && !session) throw new HttpError(401, "Not signed in");
    if (matched.auth === "member" && !(session && session.memberId > 0)) throw new HttpError(401, "Pick a profile first");
    if (matched.auth === "member") {
      const exists = await one("SELECT id FROM members WHERE id = $1", [session!.memberId]);
      if (!exists) throw new HttpError(401, "Profile no longer exists");
    }
    let body: any = {};
    if (method !== "GET" && method !== "DELETE") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
      if (body === null || typeof body !== "object") body = {};
    }
    const out: any = await matched.fn({ req, params, me: session?.memberId ?? 0, session, body });
    if (out && typeof out === "object" && RESPONSE_COOKIE in out) {
      const res = NextResponse.json(out.data);
      const v = out[RESPONSE_COOKIE] as string | null;
      if (v) res.cookies.set(COOKIE, v, cookieOptions);
      else res.cookies.set(COOKIE, "", { ...cookieOptions, maxAge: 0 });
      return res;
    }
    return NextResponse.json(out ?? { ok: true });
  } catch (e: any) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

type RouteCtx = { params: Promise<{ path: string[] }> };
async function handler(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return dispatch(req, path);
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
