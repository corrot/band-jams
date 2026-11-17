"use client";

import { useEffect, useRef, useState } from "react";
import { api, fmtTime, parseTimeInput, timeAgo, uploadFile } from "@/lib/client";
import { REACTIONS, type Comment, type Reaction } from "@/lib/types";
import { Avatar, MemberName, useBand } from "./Band";
import { AudioAttach, type PendingAudio } from "./AudioAttach";
import type { Selection } from "./TrackPlayer";

type Props = {
  trackId: number;
  comments: Comment[];
  setComments: (fn: (c: Comment[]) => Comment[]) => void;
  onSeek: (start: number, end?: number | null) => void;
  highlight: number | null;
};

async function postComment(trackId: number, data: { body: string; parent_id?: number; start_sec?: number | null; end_sec?: number | null; audio: PendingAudio | null }) {
  let audio: Record<string, unknown> = {};
  if (data.audio) {
    const { url } = await uploadFile("comments", data.audio.blob, data.audio.name);
    audio = { audio_url: url, audio_name: data.audio.name, audio_duration: data.audio.duration };
  }
  return api<Comment>(`tracks/${trackId}/comments`, {
    body: { body: data.body, parent_id: data.parent_id, start_sec: data.start_sec, end_sec: data.end_sec, ...audio },
  });
}

export function Stamp({ c, onSeek }: { c: { start_sec: number | null; end_sec: number | null }; onSeek: Props["onSeek"] }) {
  if (c.start_sec == null) return null;
  return (
    <button className="stamp" onClick={() => onSeek(c.start_sec!, c.end_sec)} title="Play from here">
      ▶ {fmtTime(c.start_sec)}
      {c.end_sec != null && `–${fmtTime(c.end_sec)}`}
    </button>
  );
}

/** Composer for a new bookmark (moment or interval) with a note. */
export function BookmarkComposer({
  trackId,
  selection,
  getTime,
  onCreated,
  onClear,
}: {
  trackId: number;
  selection: Selection | null;
  getTime: () => number;
  onCreated: (c: Comment) => void;
  onClear: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [body, setBody] = useState("");
  const [audio, setAudio] = useState<PendingAudio | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (selection) {
      setStart(fmtTime(selection.start));
      setEnd(selection.end != null ? fmtTime(selection.end) : "");
    }
  }, [selection]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = parseTimeInput(start);
    const en = end.trim() ? parseTimeInput(end) : null;
    if (s == null) return setErr("Set a start time (m:ss), use “Now” or drag on the waveform");
    if (en != null && en <= s) return setErr("End must be after start");
    if (!body.trim()) return setErr("Add a note for the bookmark");
    setBusy(true);
    setErr("");
    try {
      const c = await postComment(trackId, { body, start_sec: s, end_sec: en, audio });
      onCreated(c);
      setBody("");
      setStart("");
      setEnd("");
      setAudio(null);
      onClear();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="row wrapy">
        <label className="field" style={{ width: 96 }}>
          From
          <input value={start} placeholder="0:00" onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field" style={{ width: 96 }}>
          To (optional)
          <input value={end} placeholder="—" onChange={(e) => setEnd(e.target.value)} />
        </label>
        <div className="row" style={{ alignSelf: "flex-end" }}>
          <button type="button" className="btn sm" onClick={() => setStart(fmtTime(getTime()))}>
            Now → From
          </button>
          <button type="button" className="btn sm" onClick={() => setEnd(fmtTime(getTime()))}>
            Now → To
          </button>
          {(start || end) && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                setStart("");
                setEnd("");
                onClear();
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <textarea placeholder="What happens here? (e.g. “great riff, make this the chorus”)" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="spread">
        <AudioAttach value={audio} onChange={setAudio} disabled={busy} />
        <button className="btn primary" disabled={busy}>
          {busy ? "Saving…" : "🔖 Add bookmark"}
        </button>
      </div>
      {err && <p className="err">{err}</p>}
    </form>
  );
}

function Composer({ trackId, parentId, onCreated, onCancel, autoFocus }: { trackId: number; parentId?: number; onCreated: (c: Comment) => void; onCancel?: () => void; autoFocus?: boolean }) {
  const [body, setBody] = useState("");
  const [audio, setAudio] = useState<PendingAudio | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !audio) return;
    setBusy(true);
    setErr("");
    try {
      onCreated(await postComment(trackId, { body, parent_id: parentId, audio }));
      setBody("");
      setAudio(null);
      onCancel?.();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="composer" onSubmit={submit}>
      <textarea
        autoFocus={autoFocus}
        placeholder={parentId ? "Reply…" : "Say something about this track…"}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e as any);
        }}
        style={{ minHeight: parentId ? 48 : 64 }}
      />
      <div className="spread">
        <AudioAttach value={audio} onChange={setAudio} disabled={busy} />
        <div className="row">
          {onCancel && (
            <button type="button" className="btn ghost sm" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className="btn primary sm" disabled={busy || (!body.trim() && !audio)}>
            {busy ? "Posting…" : parentId ? "Reply" : "Comment"}
          </button>
        </div>
      </div>
      {err && <p className="err">{err}</p>}
    </form>
  );
}

function Reactions({ c, onChange }: { c: Comment; onChange: (r: Reaction[]) => void }) {
  const { me, byId } = useBand();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function toggle(emoji: string) {
    setOpen(false);
    if (!me) return;
    const prev = c.reactions;
    const next = prev.map((r) => ({ ...r, member_ids: [...r.member_ids] }));
    const r = next.find((x) => x.emoji === emoji);
    if (r) r.member_ids = r.member_ids.includes(me.id) ? r.member_ids.filter((i) => i !== me.id) : [...r.member_ids, me.id];
    else next.push({ emoji, member_ids: [me.id] });
    onChange(next.filter((x) => x.member_ids.length));
    try {
      onChange(await api<Reaction[]>(`comments/${c.id}/reactions`, { body: { emoji } }));
    } catch {
      onChange(prev);
    }
  }

  return (
    <span ref={wrap} style={{ position: "relative", display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      {c.reactions.map((r) => (
        <button
          key={r.emoji}
          className={`reaction ${me && r.member_ids.includes(me.id) ? "mine" : ""}`}
          title={r.member_ids.map((i) => byId[i]?.name || "Someone").join(", ")}
          onClick={() => toggle(r.emoji)}
        >
          {r.emoji} <span className="n">{r.member_ids.length}</span>
        </button>
      ))}
      <button className="reaction" title="React" onClick={() => setOpen((o) => !o)}>
        ☺+
      </button>
      {open && (
        <span className="picker" style={{ top: 26, left: 0 }}>
          {REACTIONS.map((e) => (
            <button key={e} onClick={() => toggle(e)}>
              {e}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function CommentItem({
  c,
  replies,
  trackId,
  setComments,
  onSeek,
  highlight,
}: {
  c: Comment;
  replies: Comment[];
} & Omit<Props, "comments">) {
  const { me } = useBand();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.body);
  const [replying, setReplying] = useState(false);
  const [err, setErr] = useState("");
  const el = useRef<HTMLDivElement>(null);
  const mine = me?.id === c.member_id;

  useEffect(() => {
    if (highlight === c.id) el.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight, c.id]);

  const patch = (p: Partial<Comment>) => setComments((cs) => cs.map((x) => (x.id === c.id ? { ...x, ...p } : x)));

  async function save() {
    setErr("");
    try {
      const r = await api<Comment>(`comments/${c.id}`, { method: "PATCH", body: { body: text } });
      patch({ body: r.body, edited_at: r.edited_at });
      setEditing(false);
    } catch (e: any) {
      setErr(e.message);
    }
  }
  async function remove() {
    if (!window.confirm(replies.length ? "Delete this comment and its replies?" : "Delete this comment?")) return;
    try {
      await api(`comments/${c.id}`, { method: "DELETE" });
      setComments((cs) => cs.filter((x) => x.id !== c.id && x.parent_id !== c.id));
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="comment" ref={el} style={highlight === c.id ? { background: "rgba(245,165,36,.06)", borderRadius: 8 } : undefined}>
      <Avatar id={c.member_id} size={30} />
      <div style={{ minWidth: 0 }}>
        <div className="head">
          <span className="name">
            <MemberName id={c.member_id} />
          </span>
          <Stamp c={c} onSeek={onSeek} />
          <span className="tiny faint" title={new Date(c.created_at).toLocaleString()}>
            {timeAgo(c.created_at)}
            {c.edited_at && " · edited"}
          </span>
        </div>
        {editing ? (
          <div className="stack tight" style={{ marginTop: 4 }}>
            <textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            <div className="row">
              <button className="btn primary sm" onClick={save}>
                Save
              </button>
              <button
                className="btn ghost sm"
                onClick={() => {
                  setEditing(false);
                  setText(c.body);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          c.body && <div className="body">{c.body}</div>
        )}
        {c.audio_url && (
          <div>
            <audio className="inline" src={c.audio_url} controls preload="none" />
            <div className="tiny faint">
              🎵 {c.audio_name}
              {c.audio_duration ? ` · ${fmtTime(c.audio_duration)}` : ""}
            </div>
          </div>
        )}
        <div className="actions">
          <Reactions c={c} onChange={(reactions) => patch({ reactions })} />
          {!c.parent_id && (
            <button className="btn ghost sm" onClick={() => setReplying((r) => !r)}>
              Reply
            </button>
          )}
          {mine && !editing && (
            <>
              <button className="btn ghost sm" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button className="btn ghost sm danger" onClick={remove}>
                Delete
              </button>
            </>
          )}
        </div>
        {err && <p className="err">{err}</p>}
        {(replies.length > 0 || replying) && (
          <div className="replies">
            {replies.map((r) => (
              <CommentItem key={r.id} c={r} replies={[]} trackId={trackId} setComments={setComments} onSeek={onSeek} highlight={highlight} />
            ))}
            {replying && (
              <div style={{ paddingTop: 8 }}>
                <Composer
                  trackId={trackId}
                  parentId={c.id}
                  autoFocus
                  onCancel={() => setReplying(false)}
                  onCreated={(n) => setComments((cs) => [...cs, n])}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentList({ items, all, ...rest }: Omit<Props, "comments"> & { items: Comment[]; all: Comment[] }) {
  if (!items.length) return null;
  return (
    <div>
      {items.map((c) => (
        <CommentItem key={c.id} c={c} replies={all.filter((r) => r.parent_id === c.id)} {...rest} />
      ))}
    </div>
  );
}

export function Discussion(props: Props) {
  const top = props.comments.filter((c) => !c.parent_id && c.start_sec == null);
  return (
    <div className="stack">
      <Composer trackId={props.trackId} onCreated={(c) => props.setComments((cs) => [...cs, c])} />
      {top.length === 0 ? (
        <p className="muted small">No comments yet.</p>
      ) : (
        <CommentList items={[...top].reverse()} all={props.comments} {...props} />
      )}
    </div>
  );
}
