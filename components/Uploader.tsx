"use client";

import { useState } from "react";
import { Box, Button, IconButton, LinearProgress, List, ListItem, Stack, TextField, Typography } from "@mui/material";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import { api, computePeaks, fmtSize, fmtTime, guessRecordedAt, probeDuration, titleFromFile, toLocalInput, uploadFile } from "@/lib/client";
import type { TrackSummary } from "@/lib/types";
import { Sheet, useFilePicker, useToast } from "./ui";

type Item = {
  key: string;
  file: File;
  title: string;
  recorded: string;
  duration: number | null;
  state: "ready" | "uploading" | "saving" | "done" | "error";
  pct: number;
  error?: string;
};

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|opus|oga|flac|webm|mp4|mov|aif|aiff|amr|3gp)$/i;

export function UploadSheet({ open, onClose, onUploaded }: { open: boolean; onClose: () => void; onUploaded: (t: TrackSummary) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const patch = (key: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  function add(files: File[]) {
    const list = files.filter((f) => f.type.startsWith("audio/") || f.type.startsWith("video/") || AUDIO_EXT.test(f.name));
    if (list.length < files.length) toast(`${files.length - list.length} file(s) skipped: not audio`, "info");
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
  const picker = useFilePicker("audio/*,video/*,.opus,.ogg,.m4a,.amr", true, add);

  async function run() {
    setBusy(true);
    let ok = 0;
    for (const it of items) {
      if (it.state === "done") continue;
      try {
        patch(it.key, { state: "uploading", pct: 0, error: undefined });
        const analysis = computePeaks(it.file);
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
        ok++;
      } catch (e: any) {
        patch(it.key, { state: "error", error: e?.message || "Upload failed" });
      }
    }
    setBusy(false);
    if (ok) toast(`${ok} track${ok === 1 ? "" : "s"} uploaded`);
  }

  const pending = items.filter((i) => i.state !== "done").length;
  const close = () => {
    if (busy) return;
    if (!pending) setItems([]);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Upload recordings"
      actions={
        items.length > 0 &&
        (pending === 0 ? (
          <Button variant="contained" onClick={() => { setItems([]); onClose(); }}>
            Done
          </Button>
        ) : (
          <Button variant="contained" size="large" fullWidth disabled={busy} onClick={run} startIcon={<CloudUploadRounded />}>
            {busy ? "Uploading…" : `Upload ${pending} file${pending === 1 ? "" : "s"}`}
          </Button>
        ))
      }
    >
      {picker.input}
      <Box
        role="button"
        tabIndex={0}
        onClick={picker.open}
        onKeyDown={(e) => e.key === "Enter" && picker.open()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(Array.from(e.dataTransfer.files));
        }}
        sx={{
          border: 2,
          borderStyle: "dashed",
          borderColor: over ? "primary.main" : "divider",
          bgcolor: over ? "rgba(245,165,36,.06)" : "transparent",
          borderRadius: 3,
          py: items.length ? 2 : 5,
          px: 2,
          textAlign: "center",
          cursor: "pointer",
          transition: "all .15s",
          "&:hover": { borderColor: "primary.main" },
        }}
      >
        <CloudUploadRounded sx={{ fontSize: items.length ? 28 : 44, color: "primary.main" }} />
        <Typography variant="subtitle1">{items.length ? "Add more files" : "Choose audio files"}</Typography>
        <Typography variant="body2" color="text.secondary">
          WhatsApp .opus, mp3, m4a, wav, flac… pick several at once
        </Typography>
      </Box>

      {items.length > 0 && (
        <List disablePadding sx={{ mt: 1 }}>
          {items.map((it) => {
            const locked = it.state !== "ready" && it.state !== "error";
            return (
              <ListItem key={it.key} disableGutters divider sx={{ display: "block", py: 1.5 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                  <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
                    <TextField size="small" label="Title" value={it.title} disabled={locked} onChange={(e) => patch(it.key, { title: e.target.value })} />
                    <TextField
                      size="small"
                      type="datetime-local"
                      label="Recorded"
                      value={it.recorded}
                      disabled={locked}
                      onChange={(e) => patch(it.key, { recorded: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </Stack>
                  <Box sx={{ pt: 0.5 }}>
                    {it.state === "done" ? (
                      <CheckCircleRounded color="success" />
                    ) : it.state === "error" ? (
                      <ErrorOutlineRounded color="error" />
                    ) : (
                      <IconButton size="small" aria-label="Remove" disabled={busy} onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))}>
                        <DeleteOutlineRounded fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Stack>
                <Typography variant="caption" color={it.error ? "error" : "text.secondary"} component="div" noWrap sx={{ mt: 0.75 }}>
                  {it.error || `${it.file.name} · ${fmtSize(it.file.size)} · ${fmtTime(it.duration)}${it.state === "saving" ? " · analysing waveform…" : ""}`}
                </Typography>
                {(it.state === "uploading" || it.state === "saving") && (
                  <LinearProgress variant={it.state === "saving" ? "indeterminate" : "determinate"} value={it.pct} sx={{ mt: 0.75 }} />
                )}
              </ListItem>
            );
          })}
        </List>
      )}
    </Sheet>
  );
}
