"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import MicRounded from "@mui/icons-material/MicRounded";
import StopRounded from "@mui/icons-material/StopRounded";
import AttachFileRounded from "@mui/icons-material/AttachFileRounded";
import { fmtTime, probeDuration } from "@/lib/client";
import { useFilePicker, useToast } from "./ui";

export type PendingAudio = { blob: Blob; name: string; duration: number | null; preview: string };

/** Mic + attach buttons; records a voice note or picks an audio file. */
export function useAudioAttach() {
  const toast = useToast();
  const [audio, setAudio] = useState<PendingAudio | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((Date.now() - started.current) / 1000), 250);
    return () => clearInterval(t);
  }, [recording]);
  useEffect(() => () => rec.current?.stream.getTracks().forEach((t) => t.stop()), []);

  async function set(blob: Blob, name: string, known?: number) {
    const preview = URL.createObjectURL(blob);
    const duration = known ?? (await probeDuration(blob));
    setAudio((old) => {
      if (old) URL.revokeObjectURL(old.preview);
      return { blob, name, duration, preview };
    });
  }

  const picker = useFilePicker("audio/*,video/*,.opus,.ogg,.m4a", false, (f) => set(f[0], f[0].name));

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t));
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = (r.mimeType || "audio/webm").split(";")[0];
        const ext = mime.includes("mp4") ? "m4a" : "webm";
        set(new Blob(chunks.current, { type: mime }), `voice-note-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${ext}`, (Date.now() - started.current) / 1000);
      };
      rec.current = r;
      started.current = Date.now();
      setElapsed(0);
      r.start(1000);
      setRecording(true);
    } catch (e: any) {
      toast(e?.name === "NotAllowedError" ? "Microphone access was blocked" : "Recording isn't available in this browser", "error");
    }
  }
  function stop() {
    rec.current?.stop();
    rec.current = null;
    setRecording(false);
  }
  function clear() {
    if (audio) URL.revokeObjectURL(audio.preview);
    setAudio(null);
  }

  const buttons = (disabled?: boolean) => (
    <>
      {picker.input}
      {recording ? (
        <Chip
          color="error"
          icon={<StopRounded />}
          label={`Stop · ${fmtTime(elapsed)}`}
          onClick={stop}
          sx={{ "@keyframes pulse": { "50%": { opacity: 0.6 } }, animation: "pulse 1.2s infinite" }}
        />
      ) : (
        <>
          <Tooltip title="Record a voice note">
            <span>
              <IconButton size="small" disabled={disabled || !!audio} onClick={start} aria-label="Record">
                <MicRounded />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Attach audio file">
            <span>
              <IconButton size="small" disabled={disabled || !!audio} onClick={picker.open} aria-label="Attach audio">
                <AttachFileRounded />
              </IconButton>
            </span>
          </Tooltip>
        </>
      )}
    </>
  );

  const preview = audio && (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", p: 1, borderRadius: 2, bgcolor: "action.hover" }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <audio className="inline" src={audio.preview} controls />
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {audio.name} · {fmtTime(audio.duration)}
        </Typography>
      </Box>
      <IconButton size="small" onClick={clear} aria-label="Remove audio">
        ✕
      </IconButton>
    </Stack>
  );

  return { audio, recording, buttons, preview, clear };
}
