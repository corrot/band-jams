"use client";

import { useEffect, useRef, useState } from "react";
import { fmtTime, probeDuration } from "@/lib/client";

export type PendingAudio = { blob: Blob; name: string; duration: number | null; preview: string };

/** Lets a comment carry an audio clip: pick a file or record from the mic. */
export function AudioAttach({ value, onChange, disabled }: { value: PendingAudio | null; onChange: (a: PendingAudio | null) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((Date.now() - started.current) / 1000), 250);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => () => rec.current?.stream.getTracks().forEach((t) => t.stop()), []);

  async function set(blob: Blob, name: string, knownDuration?: number) {
    const preview = URL.createObjectURL(blob);
    const duration = knownDuration ?? (await probeDuration(blob));
    if (value) URL.revokeObjectURL(value.preview);
    onChange({ blob, name, duration, preview });
  }

  async function startRec() {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t));
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = (r.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(chunks.current, { type: mime });
        const ext = mime.includes("mp4") ? "m4a" : "webm";
        set(blob, `voice-note-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${ext}`, (Date.now() - started.current) / 1000);
      };
      rec.current = r;
      started.current = Date.now();
      setElapsed(0);
      r.start(1000);
      setRecording(true);
    } catch (e: any) {
      setErr(e?.name === "NotAllowedError" ? "Microphone access was blocked" : "Recording isn't available in this browser");
    }
  }

  function stopRec() {
    rec.current?.stop();
    rec.current = null;
    setRecording(false);
  }

  if (value)
    return (
      <div className="attach">
        <audio className="inline" src={value.preview} controls />
        <span className="tiny muted">
          {value.name} · {fmtTime(value.duration)}
        </span>
        <button
          type="button"
          className="btn ghost sm"
          disabled={disabled}
          onClick={() => {
            URL.revokeObjectURL(value.preview);
            onChange(null);
          }}
        >
          Remove
        </button>
      </div>
    );

  return (
    <div className="attach">
      {recording ? (
        <button type="button" className="btn sm" onClick={stopRec}>
          <span className="rec" /> Stop recording · {fmtTime(elapsed)}
        </button>
      ) : (
        <>
          <button type="button" className="btn sm" disabled={disabled} onClick={startRec} title="Record a voice note or riff">
            🎙 Record
          </button>
          <button type="button" className="btn sm" disabled={disabled} onClick={() => input.current?.click()} title="Attach an audio file">
            🎵 Attach audio
          </button>
        </>
      )}
      <input
        ref={input}
        type="file"
        accept="audio/*,video/*,.opus,.ogg,.m4a"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) set(f, f.name);
          e.target.value = "";
        }}
      />
      {err && <span className="err">{err}</span>}
    </div>
  );
}
