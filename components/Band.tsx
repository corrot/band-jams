"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar as MuiAvatar, Box, IconButton, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import PauseRounded from "@mui/icons-material/PauseRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { api, fmtTime } from "@/lib/client";
import type { Member, TrackSummary } from "@/lib/types";

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

export function BandProvider({ children }: { children: React.ReactNode }) {
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

  // One shared audio element for playing from the list.
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

  // A track page runs its own full player, so pause the dock there.
  useEffect(() => {
    if (path?.startsWith("/tracks/")) audioRef.current?.pause();
  }, [path]);

  return (
    <Ctx.Provider value={{ me, members, byId, refresh }}>
      <PCtx.Provider value={player}>{children}</PCtx.Provider>
    </Ctx.Provider>
  );
}

/** Mini player that floats above the bottom navigation. */
export function Dock({ bottom }: { bottom: number | string }) {
  const p = useDock();
  const router = useRouter();
  if (!p.track) return null;
  const dur = p.duration || p.track.duration_sec || 0;
  return (
    <Paper
      elevation={8}
      sx={{
        position: "fixed",
        left: { xs: 8, md: "auto" },
        right: { xs: 8, md: 24 },
        width: { md: 420 },
        bottom,
        zIndex: 1100,
        borderRadius: 3,
        overflow: "hidden",
        border: 1,
        borderColor: "divider",
        bgcolor: "rgba(29,32,39,0.97)",
        backdropFilter: "blur(14px)",
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", pl: 1, pr: 0.5, py: 0.75 }}>
        <IconButton
          onClick={p.toggle}
          aria-label={p.playing ? "Pause" : "Play"}
          sx={{ bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.light" } }}
        >
          {p.playing ? <PauseRounded /> : <PlayArrowRounded />}
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => router.push(`/tracks/${p.track!.id}`)}>
          <Typography variant="subtitle2" noWrap>
            {p.track.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {fmtTime(p.time)} / {fmtTime(dur)}
          </Typography>
        </Box>
        <IconButton onClick={p.stop} aria-label="Close player" size="small">
          <CloseRounded fontSize="small" />
        </IconButton>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={dur ? Math.min(100, (p.time / dur) * 100) : 0}
        sx={{ height: 3, borderRadius: 0, bgcolor: "transparent" }}
        onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          if (dur) p.seek(((e.clientX - r.left) / r.width) * dur);
        }}
      />
    </Paper>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({ id, member, size = 32 }: { id?: number | null; member?: Partial<Member> | null; size?: number }) {
  const { byId } = useBand();
  const m = member ?? (id ? byId[id] : null);
  const name = m?.name || "?";
  return (
    <MuiAvatar
      src={m?.avatar_url || undefined}
      alt={name}
      title={name}
      sx={{ width: size, height: size, fontSize: size * 0.4, fontWeight: 700, bgcolor: m?.color || "grey.700", color: "#111" }}
    >
      {initials(name)}
    </MuiAvatar>
  );
}

export function MemberName({ id, variant = "subtitle2" }: { id: number | null | undefined; variant?: "subtitle2" | "body2" | "caption" }) {
  const { byId } = useBand();
  const m = id ? byId[id] : null;
  if (!m)
    return (
      <Typography component="span" variant={variant} color="text.secondary">
        Former member
      </Typography>
    );
  return (
    <Typography
      component={Link}
      href={`/members/${m.id}`}
      variant={variant}
      sx={{ color: m.color, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
    >
      {m.name}
    </Typography>
  );
}
