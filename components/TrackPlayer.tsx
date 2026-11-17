"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import type WaveSurferType from "wavesurfer.js";
import { api, fmtTime } from "@/lib/client";
import type { Comment, TrackDetail } from "@/lib/types";
import { Alert, Box, Chip, IconButton, Slider, Stack, Typography } from "@mui/material";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import PauseRounded from "@mui/icons-material/PauseRounded";
import StopRounded from "@mui/icons-material/StopRounded";
import Replay10Rounded from "@mui/icons-material/Replay10Rounded";
import Forward10Rounded from "@mui/icons-material/Forward10Rounded";
import ZoomInRounded from "@mui/icons-material/ZoomInRounded";
import SpeedRounded from "@mui/icons-material/SpeedRounded";
import { useBand } from "./Band";

export type Selection = { start: number; end: number | null };
export type PlayerHandle = {
  playAt: (start: number, end?: number | null) => void;
  currentTime: () => number;
  clearSelection: () => void;
};

const SEL_ID = "selection";

export const TrackPlayer = forwardRef<
  PlayerHandle,
  { track: TrackDetail; bookmarks: Comment[]; onSelection: (s: Selection | null) => void; onBookmarkClick: (c: Comment) => void; onPlayingChange?: (p: boolean) => void }
>(function TrackPlayer({ track, bookmarks, onSelection, onBookmarkClick, onPlayingChange }, ref) {
  const { byId } = useBand();
  const box = useRef<HTMLDivElement>(null);
  const timeline = useRef<HTMLDivElement>(null);
  const ws = useRef<WaveSurferType | null>(null);
  const regions = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(track.duration_sec || 0);
  const [zoom, setZoom] = useState(0);
  const [rate, setRate] = useState(1);
  const [loadErr, setLoadErr] = useState("");
  const [loadPct, setLoadPct] = useState<number | null>(null);
  const onSel = useRef(onSelection);
  onSel.current = onSelection;
  const onBm = useRef(onBookmarkClick);
  onBm.current = onBookmarkClick;
  const onPlay = useRef(onPlayingChange);
  onPlay.current = onPlayingChange;
  const bmById = useRef<Record<string, Comment>>({});

  useEffect(() => {
    let destroyed = false;
    let instance: WaveSurferType | null = null;
    (async () => {
      const [{ default: WaveSurfer }, { default: Regions }, { default: Timeline }] = await Promise.all([
        import("wavesurfer.js"),
        import("wavesurfer.js/dist/plugins/regions.esm.js"),
        import("wavesurfer.js/dist/plugins/timeline.esm.js"),
      ]);
      if (destroyed || !box.current) return;
      const hasPeaks = !!(track.peaks && track.peaks.length && track.duration_sec);
      instance = WaveSurfer.create({
        container: box.current,
        url: track.file_url,
        peaks: hasPeaks ? [track.peaks!] : undefined,
        duration: hasPeaks ? track.duration_sec! : undefined,
        height: window.matchMedia("(max-width: 899px)").matches ? 72 : 100,
        waveColor: "#4a4f5c",
        progressColor: "#f5a524",
        cursorColor: "#ecebe6",
        cursorWidth: 1,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        dragToSeek: false,
      });
      ws.current = instance;
      const reg = instance.registerPlugin(Regions.create());
      regions.current = reg;
      if (timeline.current)
        instance.registerPlugin(
          Timeline.create({ container: timeline.current, height: 18, style: { fontSize: "10px", color: "#6b6e78" } } as any),
        );

      reg.enableDragSelection({ color: "rgba(245,165,36,0.22)", id: SEL_ID } as any, 4);
      reg.on("region-created", (r: any) => {
        if (String(r.id).startsWith("bm-")) return;
        for (const other of reg.getRegions()) if (other !== r && !String(other.id).startsWith("bm-")) other.remove();
        r.setOptions({ id: SEL_ID, color: "rgba(245,165,36,0.22)" });
        onSel.current({ start: r.start, end: r.end });
      });
      reg.on("region-updated", (r: any) => {
        if (!String(r.id).startsWith("bm-")) onSel.current({ start: r.start, end: r.end });
      });
      reg.on("region-clicked", (r: any, e: MouseEvent) => {
        e.stopPropagation();
        const c = bmById.current[r.id];
        if (c) {
          onBm.current(c);
          instance!.play(r.start, r.end && r.end > r.start ? r.end : undefined);
        } else {
          instance!.play(r.start, r.end);
        }
      });

      instance.on("loading", (p) => setLoadPct(p));
      instance.on("ready", (d) => {
        setReady(true);
        setLoadPct(null);
        setDuration(d);
        if (!hasPeaks) {
          try {
            const exported = instance!.exportPeaks({ channels: 1, maxLength: 1200, precision: 1000 });
            const peaks = Array.from(exported[0] || []).map((v) => Math.abs(v as number));
            if (peaks.length) api(`tracks/${track.id}/peaks`, { method: "PUT", body: { peaks, duration_sec: d } }).catch(() => {});
          } catch {
            /* ignore */
          }
        }
      });
      instance.on("play", () => {
        setPlaying(true);
        onPlay.current?.(true);
      });
      instance.on("pause", () => {
        setPlaying(false);
        onPlay.current?.(false);
      });
      instance.on("finish", () => {
        setPlaying(false);
        onPlay.current?.(false);
      });
      instance.on("timeupdate", (t) => setTime(t));
      instance.on("error", (e) => setLoadErr(String((e as any)?.message || e)));
    })();
    return () => {
      destroyed = true;
      instance?.destroy();
      ws.current = null;
      regions.current = null;
      setReady(false);
    };
  }, [track.id, track.file_url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw bookmarks as regions/markers.
  useEffect(() => {
    const reg = regions.current;
    if (!reg || !ready) return;
    for (const r of reg.getRegions()) if (String(r.id).startsWith("bm-")) r.remove();
    const map: Record<string, Comment> = {};
    for (const c of bookmarks) {
      if (c.start_sec == null) continue;
      const id = `bm-${c.id}`;
      map[id] = c;
      const color = byId[c.member_id || 0]?.color || "#f5a524";
      const label = document.createElement("span");
      // Regions render inside wavesurfer's shadow DOM, so style inline.
      Object.assign(label.style, {
        background: color,
        color: "#111",
        fontSize: "11px",
        fontFamily: "ui-monospace, Menlo, monospace",
        padding: "0 5px",
        margin: "2px",
        borderRadius: "3px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "160px",
        display: "inline-block",
      });
      label.textContent = c.body.split("\n")[0].slice(0, 40);
      reg.addRegion({
        id,
        start: c.start_sec,
        end: c.end_sec ?? undefined,
        color: c.end_sec ? hexA(color, 0.18) : color,
        drag: false,
        resize: false,
        content: label,
      });
    }
    bmById.current = map;
  }, [bookmarks, ready, byId]);

  useImperativeHandle(ref, () => ({
    playAt: (start, end) => {
      const w = ws.current;
      if (!w) return;
      w.play(start, end && end > start ? end : undefined).catch(() => {});
    },
    currentTime: () => ws.current?.getCurrentTime() ?? 0,
    clearSelection: () => {
      const reg = regions.current;
      if (!reg) return;
      for (const r of reg.getRegions()) if (!String(r.id).startsWith("bm-")) r.remove();
    },
  }));

  const w = ws.current;
  const skip = (d: number) => w && w.setTime(Math.min(duration, Math.max(0, w.getCurrentTime() + d)));
  return (
    <Box>
      <Box sx={{ position: "relative", minHeight: { xs: 92, md: 120 } }}>
        <div ref={box} />
        <div ref={timeline} />
        {!ready && !loadErr && (
          <Typography variant="caption" color="text.disabled" sx={{ position: "absolute", top: 4, right: 6 }}>
            {loadPct != null && loadPct < 100 ? `Loading audio ${loadPct}%…` : "Loading…"}
          </Typography>
        )}
      </Box>
      {loadErr && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          This browser couldn&apos;t play the file. WhatsApp .opus files don&apos;t play on some iPhones; try another browser or{" "}
          <a href={track.file_url} target="_blank" rel="noreferrer">
            download it
          </a>
          .
        </Alert>
      )}
      <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} sx={{ alignItems: "center", mt: 1 }}>
        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, Menlo, monospace", minWidth: 52, color: "text.primary" }}>
          {fmtTime(time)}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton aria-label="Back 10 seconds" disabled={!w} onClick={() => skip(-10)}>
          <Replay10Rounded />
        </IconButton>
        <IconButton
          aria-label={playing ? "Pause" : "Play"}
          disabled={!w}
          onClick={() => w?.playPause()}
          sx={{ width: 56, height: 56, bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.light" }, "&.Mui-disabled": { bgcolor: "action.disabledBackground" } }}
        >
          {playing ? <PauseRounded fontSize="large" /> : <PlayArrowRounded fontSize="large" />}
        </IconButton>
        <IconButton aria-label="Forward 10 seconds" disabled={!w} onClick={() => skip(10)}>
          <Forward10Rounded />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "ui-monospace, Menlo, monospace", minWidth: 52, textAlign: "right" }}>
          {fmtTime(duration)}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 0.5 }}>
        <IconButton size="small" aria-label="Stop" disabled={!w} onClick={() => w?.stop()}>
          <StopRounded fontSize="small" />
        </IconButton>
        <ZoomInRounded fontSize="small" sx={{ color: "text.disabled" }} />
        <Slider
          size="small"
          min={0}
          max={200}
          value={zoom}
          aria-label="Zoom"
          sx={{ flex: 1, maxWidth: 220 }}
          onChange={(_, v) => {
            const val = v as number;
            setZoom(val);
            try {
              w?.zoom(val);
            } catch {
              /* not ready */
            }
          }}
        />
        <Box sx={{ flex: 1 }} />
        <Chip
          size="small"
          variant="outlined"
          icon={<SpeedRounded />}
          label={`${rate}×`}
          onClick={() => {
            const rates = [1, 1.25, 1.5, 0.5, 0.75];
            const next = rates[(rates.indexOf(rate) + 1) % rates.length];
            setRate(next);
            w?.setPlaybackRate(next, true);
          }}
          aria-label="Playback speed"
        />
      </Stack>
    </Box>
  );
});

function hexA(hex: string, a: number) {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return `rgba(245,165,36,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}
