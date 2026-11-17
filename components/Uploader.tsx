"use client";

import { useRef, useState } from "react";
import { api, computePeaks, fmtSize, fmtTime, guessRecordedAt, probeDuration, titleFromFile, toLocalInput, uploadFile } from "@/lib/client";
import type { TrackSummary } from "@/lib/types";

type Item = {
  key: string;
  file: File;
  title: string;
  recorded: string; // datetime-local value
  duration: number | null;
  state: "ready" | "uploading" | "saving" | "done" | "error";
  pct: number;
  error?: string;
};

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|opus|oga|flac|webm|mp4|mov|aif|aiff|amr|3gp)$/i;

export function Uploader({ onUploaded, onClose }: { onUploaded: (t: TrackSummary) => void; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  function add(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("audio/") || f.type.startsWith("video/") || AUDIO_EXT.test(f.name));
    const next = list.map<Item>((f) => ({
      key: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}`,
      file: f,
      title: titleFromFile(f.name),
      recorded: toLocalInput(guessRecordedAt(f)),
      duration: null,
      state: "ready",
      pct: 0,
    }));
    setItems((xs) => [...xs, ...next]);
    next.forEach((it) => probeDuration(it.file).then((d) => patch(it.key, { duration: d })));
  }

  async function run() {
    setBusy(true);
    for (const it of items) {
      if (it.state === "done") continue;
      try {
        patch(it.key, { state: "uploading", pct: 0, error: undefined });
        const analysis = computePeaks(it.file); // runs while uploading
        const { url, contentType } = await uploadFile("tracks", it.file, it.file.name, (pct) => patch(it.key, { pct }));
        patch(it.key, { state: "saving", pct: 100 });
        const a = await analysis;
        const t = await api<TrackSummary>("tracks", {
          body: {
            title: it.title,
            file_url: url,
            file_name: it.file.name,
            content_type: contentType,
            size_bytes: it.file.size,
            duration_sec: it.duration ?? a?.duration ?? null,
            recorded_at: it.recorded ? new Date(it.recorded).toISOString() : null,
            peaks: a?.peaks ?? null,
          },
        });
        patch(it.key, { state: "done" });
        onUploaded(t);
      } catch (e: any) {
        patch(it.key, { state: "error", error: e?.message || "Upload failed" });
      }
    }
    setBusy(false);
  }

  const pending = items.filter((i) => i.state !== "done").length;

  return (
    <div className="panel stack">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Upload recordings</h2>
        <button className="btn ghost sm" onClick={onClose} disabled={busy}>
          Close
        </button>
      </div>
      <div
        className={`drop ${over ? "over" : ""}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
      >
        <div style={{ fontSize: 26 }}>⬆</div>
        <div>
          Drop audio files here or <b style={{ color: "var(--accent)" }}>browse</b>
        </div>
        <div className="tiny faint">mp3, m4a, wav, ogg/opus (WhatsApp), flac, webm… several at once is fine</div>
        <input
          ref={input}
          type="file"
          accept="audio/*,video/*,.opus,.ogg,.m4a,.amr"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {items.length > 0 && (
        <div>
          {items.map((it) => (
            <div className="upitem" key={it.key}>
              <div style={{ minWidth: 0 }}>
                <input
                  value={it.title}
                  disabled={it.state !== "ready" && it.state !== "error"}
                  onChange={(e) => patch(it.key, { title: e.target.value })}
                />
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  {it.file.name} · {fmtSize(it.file.size)} · {fmtTime(it.duration)}
                  {it.state === "saving" && " · analysing waveform…"}
                  {it.state === "done" && <span style={{ color: "var(--ok)" }}> · uploaded</span>}
                  {it.error && <span className="err"> · {it.error}</span>}
                </div>
                {(it.state === "uploading" || it.state === "saving") && (
                  <div className="progress">
                    <div style={{ width: `${it.pct}%` }} />
                  </div>
                )}
              </div>
              <label className="field">
                Recorded
                <input
                  type="datetime-local"
                  value={it.recorded}
                  disabled={it.state !== "ready" && it.state !== "error"}
                  onChange={(e) => patch(it.key, { recorded: e.target.value })}
                />
              </label>
              <button
                className="btn ghost sm"
                disabled={busy || it.state === "done"}
                onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <div className="row" style={{ justifyContent: "flex-end" }}>
          {pending === 0 ? (
            <button className="btn" onClick={() => setItems([])}>
              Clear list
            </button>
          ) : (
            <button className="btn primary" disabled={busy} onClick={run}>
              {busy ? "Uploading…" : `Upload ${pending} file${pending === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
