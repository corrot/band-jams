"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { api, fmtTime } from "@/lib/client";
import type { Member, TrackSummary } from "@/lib/types";
import { MiniWave } from "./MiniWave";

type BandCtx = {
  me: Member | null;
  members: Member[];
  byId: Record<number, Member>;
  refresh: () => Promise<void>;
};
const Ctx = createContext<BandCtx>({ me: null, members: [], byId: {}, refresh: async () => {} });
export const useBand = () => useContext(Ctx);

type PlayerCtx = {
  track: TrackSummary | null;
  playing: boolean;
  time: number;
  duration: number;
  play: (t: TrackSummary, at?: number) => void;
  toggle: () => void;
  seek: (sec: number) => void;
  stop: () => void;
};
const PCtx = createContext<PlayerCtx>({
  track: null,
  playing: false,
  time: 0,
  duration: 0,
  play: () => {},
  toggle: () => {},
  seek: () => {},
  stop: () => {},
});
export const useDock = () => useContext(PCtx);

export function Providers({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [me, setMe] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const refresh = useCallback(async () => {
    const st = await api("auth/state");
    if (st.stage !== "in") return;
    const all = await api<Member[]>("members");
    setMembers(all);
    setMe(all.find((m) => m.id === st.me.id) || null);
  }, []);

  useEffect(() => {
    if (path?.startsWith("/login")) return;
    refresh().catch(() => {});
  }, [path, refresh]);

  const byId = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

  // Shared player for list playback.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<TrackSummary | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = new Audio();
    a.preload = "metadata";
    audioRef.current = a;
    const on = () => setPlaying(true);
    const off = () => setPlaying(false);
    const tu = () => setTime(a.currentTime);
    const dm = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    a.addEventListener("play", on);
    a.addEventListener("pause", off);
    a.addEventListener("ended", off);
    a.addEventListener("timeupdate", tu);
    a.addEventListener("loadedmetadata", dm);
    return () => {
      a.pause();
      a.src = "";
    };
  }, []);

  const player = useMemo<PlayerCtx>(
    () => ({
      track,
      playing,
      time,
      duration,
      play: (t, at) => {
        const a = audioRef.current;
        if (!a) return;
        if (!track || track.id !== t.id) {
          a.src = t.file_url;
          setTrack(t);
          setTime(0);
          setDuration(t.duration_sec || 0);
        }
        if (at !== undefined) a.currentTime = at;
        a.play().catch(() => setPlaying(false));
      },
      toggle: () => {
        const a = audioRef.current;
        if (!a || !track) return;
        if (a.paused) a.play().catch(() => {});
        else a.pause();
      },
      seek: (sec) => {
        const a = audioRef.current;
        if (a) a.currentTime = sec;
      },
      stop: () => {
        const a = audioRef.current;
        if (!a) return;
        a.pause();
        a.currentTime = 0;
        setTrack(null);
      },
    }),
    [track, playing, time, duration],
  );

  // A track page runs its own player, so pause the dock there.
  useEffect(() => {
    if (path?.startsWith("/tracks/")) audioRef.current?.pause();
  }, [path]);

  return (
    <Ctx.Provider value={{ me, members, byId, refresh }}>
      <PCtx.Provider value={player}>
        {children}
        {track && !path?.startsWith("/tracks/") && !path?.startsWith("/login") && <Dock />}
      </PCtx.Provider>
    </Ctx.Provider>
  );
}

function Dock() {
  const p = useDock();
  if (!p.track) return null;
  const dur = p.duration || p.track.duration_sec || 0;
  return (
    <div className="dock">
      <div className="wrap">
        <button className="btn play" onClick={p.toggle} aria-label={p.playing ? "Pause" : "Play"}>
          {p.playing ? "❚❚" : "▶"}
        </button>
        <div style={{ minWidth: 0 }}>
          <Link href={`/tracks/${p.track.id}`} className="title" style={{ fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.track.title}
          </Link>
          <div className="timecode tiny">
            <b>{fmtTime(p.time)}</b> / {fmtTime(dur)}
          </div>
        </div>
        <div className="dockwave">
          <MiniWave peaks={p.track.peaks} progress={dur ? p.time / dur : 0} onSeek={(f) => p.seek(f * dur)} height={40} />
        </div>
        <div className="row">
          <button className="btn sm" onClick={p.stop} title="Stop">■ Stop</button>
        </div>
      </div>
    </div>
  );
}

export function Avatar({ id, member, size = 28 }: { id?: number | null; member?: Member | null; size?: number }) {
  const { byId } = useBand();
  const m = member ?? (id ? byId[id] : null);
  const name = m?.name || "?";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  if (m?.avatar_url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={m.avatar_url} alt={name} title={name} style={{ width: size, height: size }} />;
  return (
    <span className="avatar" title={name} style={{ width: size, height: size, background: m?.color || "#555", fontSize: size * 0.4 }}>
      {initials}
    </span>
  );
}

export function MemberName({ id }: { id: number | null | undefined }) {
  const { byId } = useBand();
  const m = id ? byId[id] : null;
  if (!m) return <span className="muted">Former member</span>;
  return (
    <Link href={`/members/${m.id}`} style={{ color: m.color }}>
      {m.name}
    </Link>
  );
}
