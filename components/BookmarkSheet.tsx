"use client";

import { useEffect, useState } from "react";
import { Button, Stack, TextField, Typography } from "@mui/material";
import { fmtTime, parseTimeInput } from "@/lib/client";
import type { Comment } from "@/lib/types";
import { useAudioAttach } from "./AudioAttach";
import { postComment } from "./Comments";
import { Sheet, useToast } from "./ui";

export type Range = { start: number; end: number | null };

export function BookmarkSheet({
  open,
  onClose,
  trackId,
  initial,
  getTime,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  trackId: number;
  initial: Range | null;
  getTime: () => number;
  onCreated: (c: Comment) => void;
}) {
  const toast = useToast();
  const att = useAudioAttach();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    setStart(fmtTime(initial?.start ?? getTime()));
    setEnd(initial?.end != null ? fmtTime(initial.end) : "");
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    const s = parseTimeInput(start);
    const en = end.trim() ? parseTimeInput(end) : null;
    if (s == null) return setErr("Start time looks wrong: use m:ss");
    if (en != null && en <= s) return setErr("End must be after start");
    if (!body.trim()) return setErr("Add a note so everyone knows why it's marked");
    setBusy(true);
    setErr("");
    try {
      onCreated(await postComment(trackId, { body, start_sec: s, end_sec: en, audio: att.audio }));
      setBody("");
      att.clear();
      toast("Bookmark added");
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial?.end != null ? "Bookmark this part" : "Bookmark this moment"}
      actions={
        <>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" disabled={busy || att.recording} onClick={save}>
            {busy ? "Saving…" : "Save bookmark"}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Stack direction="row" spacing={1.5}>
          <TextField label="From" value={start} onChange={(e) => setStart(e.target.value)} slotProps={{ htmlInput: { inputMode: "numeric" } }} />
          <TextField label="To (optional)" placeholder="—" value={end} onChange={(e) => setEnd(e.target.value)} slotProps={{ htmlInput: { inputMode: "numeric" } }} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => setStart(fmtTime(getTime()))}>
            Set From to now
          </Button>
          <Button size="small" variant="outlined" onClick={() => setEnd(fmtTime(getTime()))}>
            Set To to now
          </Button>
        </Stack>
        <TextField
          label="Note"
          multiline
          minRows={2}
          autoFocus
          placeholder="e.g. great riff, make this the chorus"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {att.preview}
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {att.buttons(busy)}
          <Typography variant="caption" color="text.secondary">
            Optional: add a voice note or audio clip
          </Typography>
        </Stack>
        {err && (
          <Typography color="error" variant="body2">
            {err}
          </Typography>
        )}
      </Stack>
    </Sheet>
  );
}
