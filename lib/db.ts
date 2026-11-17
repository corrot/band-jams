import { Pool, type PoolClient } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __bjPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __bjSchema: Promise<void> | undefined;
}

function pool(): Pool {
  if (!globalThis.__bjPool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const local = /localhost|127\.0\.0\.1|host=\/tmp/.test(url);
    globalThis.__bjPool = new Pool({
      connectionString: url,
      max: 3,
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
  }
  return globalThis.__bjPool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  color TEXT NOT NULL DEFAULT '#f59e0b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS instruments (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'Other',
  details TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tracks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  duration_sec REAL,
  recorded_at TIMESTAMPTZ,
  peaks JSONB,
  status TEXT NOT NULL DEFAULT 'new',
  uploaded_by INT REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS track_votes (
  track_id INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, member_id)
);
CREATE TABLE IF NOT EXISTS track_links (
  id SERIAL PRIMARY KEY,
  track_a INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  track_b INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Related',
  created_by INT REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (track_a <> track_b)
);
CREATE UNIQUE INDEX IF NOT EXISTS track_links_pair ON track_links (LEAST(track_a, track_b), GREATEST(track_a, track_b));
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  track_id INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  member_id INT REFERENCES members(id) ON DELETE SET NULL,
  parent_id INT REFERENCES comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  start_sec REAL,
  end_sec REAL,
  audio_url TEXT,
  audio_name TEXT,
  audio_duration REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS comments_track ON comments (track_id);
CREATE TABLE IF NOT EXISTS comment_reactions (
  comment_id INT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  PRIMARY KEY (comment_id, member_id, emoji)
);
CREATE TABLE IF NOT EXISTS track_instruments (
  id SERIAL PRIMARY KEY,
  track_id INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  member_id INT REFERENCES members(id) ON DELETE SET NULL,
  instrument_id INT REFERENCES instruments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  settings TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS track_instrument_images (
  id SERIAL PRIMARY KEY,
  track_instrument_id INT NOT NULL REFERENCES track_instruments(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function ensureSchema() {
  if (!globalThis.__bjSchema) {
    globalThis.__bjSchema = pool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((e) => {
        globalThis.__bjSchema = undefined;
        throw e;
      });
  }
  return globalThis.__bjSchema;
}

export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const r = await pool().query(text, params as any[]);
  return r.rows as T[];
}

export async function one<T = any>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
