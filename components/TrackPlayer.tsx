"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import type WaveSurferType from "wavesurfer.js";
import { api, fmtTime } from "@/lib/client";
import type { Comment, TrackDetail } from "@/lib/types";
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
  { track: TrackDetail; bookmarks: Comment[]; onSelection: (s: Selection | null) => void; onBookmarkClick: (c: Comment) => void }
>(function TrackPlayer({ track, bookmarks, onSelection, onBookmarkClick }, ref) {
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
        height: 110,
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
      instance.on("play", () => setPlaying(true));
      instance.on("pause", () => setPlaying(false));
      instance.on("finish", () => setPlaying(false));
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
  return (
    <div className="player">
      <div className="waveform">
        <div ref={box} />
        <div ref={timeline} />
        {!ready && !loadErr && (
          <div className="tiny faint" style={{ position: "absolute", top: 4, right: 6 }}>
            {loadPct != null && loadPct < 100 ? `Loading audio ${loadPct}%…` : "Loading…"}
          </div>
        )}
      </div>
      {loadErr && (
        <p className="err">
          This browser couldn't play the file ({loadErr}). WhatsApp .opus files don't play on some iPhones, so try a desktop browser or{" "}
          <a href={track.file_url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
            download it
          </a>
          .
        </p>
      )}
      <div className="transport">
        <button className="btn play" disabled={!w} onClick={() => w?.playPause()} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <button className="btn icon" disabled={!w} onClick={() => w?.stop()} title="Stop">
          ■
        </button>
        <button className="btn sm" disabled={!w} onClick={() => w?.setTime(Math.max(0, w.getCurrentTime() - 10))} title="Back 10s">
          ↺ 10s
        </button>
        <button className="btn sm" disabled={!w} onClick={() => w?.setTime(Math.min(duration, w.getCurrentTime() + 10))} title="Forward 10s">
          10s ↻
        </button>
        <span className="timecode">
          <b>{fmtTime(time)}</b> / {fmtTime(duration)}
        </span>
        <span className="grow" />
        <label className="row tiny muted" title="Zoom">
          🔍
          <input
            type="range"
            min={0}
            max={200}
            value={zoom}
            style={{ width: 100, padding: 0 }}
            onChange={(e) => {
              const v = Number(e.target.value);
              setZoom(v);
              try {
                w?.zoom(v);
              } catch {
                /* not ready */
              }
            }}
          />
        </label>
        <select
          value={rate}
          style={{ width: "auto", padding: "4px 6px" }}
          title="Playback speed"
          onChange={(e) => {
            const v = Number(e.target.value);
            setRate(v);
            w?.setPlaybackRate(v, true);
          }}
        >
          {[0.5, 0.75, 1, 1.25, 1.5].map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </select>
      </div>
      <p className="tiny faint">Tip: drag across the waveform to select an interval, then bookmark it below. Click a bookmark to play it.</p>
    </div>
  );
});

function hexA(hex: string, a: number) {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return `rgba(245,165,36,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}
