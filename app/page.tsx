"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fmtDate, fmtSize, fmtTime } from "@/lib/client";
import { STATUSES, type TrackSummary } from "@/lib/types";
import { useBand, useDock } from "@/components/Band";
import { MiniWave } from "@/components/MiniWave";
import { Uploader } from "@/components/Uploader";
import { Votes } from "@/components/Votes";

type Sort = "priority" | "recorded" | "uploaded" | "length" | "discussed" | "unvoted";

export default function TracksPage() {
  const { me } = useBand();
  const dock = useDock();
  const [tracks, setTracks] = useState<TrackSummary[] | null>(null);
  const [err, setErr] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [sort, setSort] = useState<Sort>("priority");

  useEffect(() => {
    api<TrackSummary[]>("tracks")
      .then(setTracks)
      .catch((e) => setErr(e.message));
  }, []);

  const shown = useMemo(() => {
    if (!tracks) return [];
    const s = search.trim().toLowerCase();
    let list = tracks.filter((t) => {
      if (status === "active" && (t.status === "archived" || t.status === "done")) return false;
      if (status !== "active" && status !== "all" && t.status !== status) return false;
      if (s && !`${t.title} ${t.description} ${t.file_name}`.toLowerCase().includes(s)) return false;
      if (sort === "unvoted" && me && t.votes.some((v) => v.member_id === me.id)) return false;
      return true;
    });
    const date = (t: TrackSummary) => new Date(t.recorded_at || t.created_at).getTime();
    const cmp: Record<Sort, (a: TrackSummary, b: TrackSummary) => number> = {
      priority: (a, b) => b.score - a.score || b.votes.length - a.votes.length || date(b) - date(a),
      recorded: (a, b) => date(b) - date(a),
      uploaded: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      length: (a, b) => (b.duration_sec || 0) - (a.duration_sec || 0),
      discussed: (a, b) => b.comment_count + b.bookmark_count - (a.comment_count + a.bookmark_count),
      unvoted: (a, b) => date(b) - date(a),
    };
    return [...list].sort(cmp[sort]);
  }, [tracks, search, status, sort, me]);

  const update = (id: number, p: Partial<TrackSummary>) => setTracks((xs) => xs && xs.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const unvoted = tracks && me ? tracks.filter((t) => t.status !== "archived" && !t.votes.some((v) => v.member_id === me.id)).length : 0;

  return (
    <div className="page">
      <div className="spread">
        <div>
          <h1>Tracks</h1>
          <p className="muted small">
            {tracks ? `${tracks.length} recording${tracks.length === 1 ? "" : "s"}` : "Loading…"}
            {unvoted > 0 && (
              <>
                {" · "}
                <button className="chip click accent" onClick={() => setSort("unvoted")}>
                  {unvoted} waiting for your vote
                </button>
              </>
            )}
          </p>
        </div>
        <button className="btn primary" onClick={() => setShowUpload((v) => !v)}>
          + Upload
        </button>
      </div>

      {showUpload && (
        <Uploader
          onClose={() => setShowUpload(false)}
          onUploaded={(t) => setTracks((xs) => [t, ...(xs || [])])}
        />
      )}

      <div className="toolbar">
        <input type="search" placeholder="Search tracks" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active (not done/archived)</option>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="priority">Sort: priority (votes)</option>
          <option value="recorded">Sort: recording date</option>
          <option value="uploaded">Sort: recently uploaded</option>
          <option value="length">Sort: longest</option>
          <option value="discussed">Sort: most discussed</option>
          <option value="unvoted">Not voted by me</option>
        </select>
      </div>

      {err && <p className="err">{err}</p>}
      {tracks && shown.length === 0 && (
        <div className="empty">
          {tracks.length === 0 ? (
            <>
              No tracks yet. <button className="btn sm primary" onClick={() => setShowUpload(true)}>Upload the first jam</button>
            </>
          ) : (
            "Nothing matches these filters."
          )}
        </div>
      )}

      <div className="tracks">
        {shown.map((t, i) => {
          const active = dock.track?.id === t.id;
          const dur = t.duration_sec || (active ? dock.duration : 0);
          return (
            <div className="track" key={t.id}>
              <div className="rank">{sort === "priority" ? `#${i + 1}` : ""}</div>
              <button
                className="btn play"
                aria-label={active && dock.playing ? "Pause" : "Play"}
                onClick={() => (active ? dock.toggle() : dock.play(t))}
              >
                {active && dock.playing ? "❚❚" : "▶"}
              </button>
              <div style={{ minWidth: 0 }}>
                <div className="row">
                  <Link href={`/tracks/${t.id}`} className="title grow">
                    {t.title}
                  </Link>
                  <span className={`status ${t.status}`}>{STATUSES.find((s) => s.value === t.status)?.label}</span>
                </div>
                <div className="meta">
                  <span title="Recorded">📅 {fmtDate(t.recorded_at || t.created_at)}</span>
                  <span title="Length">⏱ {fmtTime(t.duration_sec)}</span>
                  <span title="File size">💾 {fmtSize(t.size_bytes)}</span>
                  {t.comment_count > 0 && <span>💬 {t.comment_count}</span>}
                  {t.bookmark_count > 0 && <span>🔖 {t.bookmark_count}</span>}
                  {t.link_count > 0 && <span>🔗 {t.link_count}</span>}
                </div>
                <div className="wave">
                  <MiniWave
                    peaks={t.peaks}
                    progress={active && dur ? dock.time / dur : 0}
                    onSeek={(f) => (dur ? (active ? dock.seek(f * dur) : dock.play(t, f * dur)) : dock.play(t))}
                  />
                </div>
              </div>
              <div className="side">
                <Votes trackId={t.id} votes={t.votes} score={t.score} onChange={(v) => update(t.id, v)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
