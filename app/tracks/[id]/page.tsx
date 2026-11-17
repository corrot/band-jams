"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, fmtDate, fmtSize, fmtTime, toLocalInput } from "@/lib/client";
import { STATUSES, type Comment, type TrackDetail } from "@/lib/types";
import { MemberName, useBand } from "@/components/Band";
import { TrackPlayer, type PlayerHandle, type Selection } from "@/components/TrackPlayer";
import { Votes } from "@/components/Votes";
import { BookmarkComposer, CommentList, Discussion } from "@/components/Comments";
import { Links } from "@/components/Links";
import { TrackInstruments } from "@/components/TrackInstruments";

export default function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { me } = useBand();
  const [t, setT] = useState<TrackDetail | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const player = useRef<PlayerHandle>(null);

  useEffect(() => {
    setT(null);
    api<TrackDetail>(`tracks/${id}`)
      .then(setT)
      .catch((e) => setErr(e.message));
  }, [id]);

  const setComments = (fn: (c: Comment[]) => Comment[]) => setT((x) => (x ? { ...x, comments: fn(x.comments) } : x));
  const bookmarks = useMemo(
    () => (t ? t.comments.filter((c) => c.start_sec != null && !c.parent_id).sort((a, b) => a.start_sec! - b.start_sec!) : []),
    [t],
  );

  if (err) return <div className="page"><p className="err">{err}</p><Link href="/">← Back to tracks</Link></div>;
  if (!t) return <div className="page"><p className="muted">Loading…</p></div>;

  const seek = (start: number, end?: number | null) => player.current?.playAt(start, end);
  const commentProps = { trackId: t.id, setComments, onSeek: seek, highlight };

  async function setStatus(status: string) {
    const r = await api<TrackDetail>(`tracks/${t!.id}`, { method: "PATCH", body: { status } });
    setT((x) => (x ? { ...x, status: r.status } : x));
  }

  async function del() {
    if (!window.confirm(`Delete “${t!.title}” with all its comments, bookmarks and photos? This can't be undone.`)) return;
    try {
      await api(`tracks/${t!.id}`, { method: "DELETE" });
      router.push("/");
    } catch (e: any) {
      window.alert(e.message);
    }
  }

  return (
    <div className="page">
      <div className="hero">
        <Link href="/" className="small muted">
          ← All tracks
        </Link>
        {editing ? (
          <EditTrack
            t={t}
            onDone={(p) => {
              if (p) setT((x) => (x ? { ...x, ...p } : x));
              setEditing(false);
            }}
          />
        ) : (
          <div className="spread" style={{ alignItems: "flex-start" }}>
            <div className="grow">
              <h1>{t.title}</h1>
              <div className="row wrapy small muted" style={{ marginTop: 6 }}>
                <span>📅 {fmtDate(t.recorded_at || t.created_at, true)}</span>
                <span>⏱ {fmtTime(t.duration_sec)}</span>
                <span>💾 {fmtSize(t.size_bytes)}</span>
                <span>
                  ⬆ <MemberName id={t.uploaded_by} /> · {fmtDate(t.created_at)}
                </span>
                <a href={t.file_url} target="_blank" rel="noreferrer" className="chip click" title={t.file_name}>
                  ⬇ Download
                </a>
              </div>
              {t.description && <p style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{t.description}</p>}
            </div>
            <div className="stack tight" style={{ justifyItems: "end" }}>
              <Votes trackId={t.id} votes={t.votes} score={t.score} onChange={(v) => setT((x) => (x ? { ...x, ...v } : x))} />
              <div className="row">
                <select value={t.status} onChange={(e) => setStatus(e.target.value)} style={{ width: "auto", padding: "4px 8px" }}>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button className="btn sm" onClick={() => setEditing(true)}>
                  Edit
                </button>
                {(t.uploaded_by === me?.id || t.uploaded_by === null) && (
                  <button className="btn sm danger" onClick={del}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        <TrackPlayer
          ref={player}
          track={t}
          bookmarks={bookmarks}
          onSelection={setSelection}
          onBookmarkClick={(c) => setHighlight(c.id)}
        />
      </div>

      <div className="cols">
        <div className="stack" style={{ gap: 20 }}>
          <div className="panel">
            <h2>Bookmarks {bookmarks.length > 0 && <span className="faint small">({bookmarks.length})</span>}</h2>
            <BookmarkComposer
              trackId={t.id}
              selection={selection}
              getTime={() => player.current?.currentTime() ?? 0}
              onClear={() => {
                setSelection(null);
                player.current?.clearSelection();
              }}
              onCreated={(c) => setComments((cs) => [...cs, c])}
            />
            <div style={{ marginTop: 10 }}>
              <CommentList items={bookmarks} all={t.comments} {...commentProps} />
            </div>
          </div>
          <div className="panel">
            <h2>Comments</h2>
            <Discussion comments={t.comments} {...commentProps} />
          </div>
        </div>
        <div className="stack" style={{ gap: 20 }}>
          <TrackInstruments
            trackId={t.id}
            items={t.instruments}
            setItems={(fn) => setT((x) => (x ? { ...x, instruments: fn(x.instruments) } : x))}
          />
          <Links trackId={t.id} links={t.links} setLinks={(links) => setT((x) => (x ? { ...x, links } : x))} />
        </div>
      </div>
    </div>
  );
}

function EditTrack({ t, onDone }: { t: TrackDetail; onDone: (p: Partial<TrackDetail> | null) => void }) {
  const [title, setTitle] = useState(t.title);
  const [description, setDescription] = useState(t.description);
  const [recorded, setRecorded] = useState(toLocalInput(t.recorded_at));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<TrackDetail>(`tracks/${t.id}`, {
        method: "PATCH",
        body: { title, description, recorded_at: recorded ? new Date(recorded).toISOString() : null },
      });
      onDone({ title: r.title, description: r.description, recorded_at: r.recorded_at });
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }
  return (
    <form className="panel stack" onSubmit={save}>
      <label className="field">
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="field">
        Recorded
        <input type="datetime-local" value={recorded} onChange={(e) => setRecorded(e.target.value)} style={{ maxWidth: 260 }} />
      </label>
      <label className="field">
        Notes
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Key, tempo, lyrics idea, who played what…" />
      </label>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn ghost" onClick={() => onDone(null)}>
          Cancel
        </button>
        <button className="btn primary" disabled={busy}>
          Save
        </button>
      </div>
      {err && <p className="err">{err}</p>}
    </form>
  );
}
