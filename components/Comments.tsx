"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Popover,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SendRounded from "@mui/icons-material/SendRounded";
import MoreHorizRounded from "@mui/icons-material/MoreHorizRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import ReplyRounded from "@mui/icons-material/ReplyRounded";
import AddReactionOutlined from "@mui/icons-material/AddReactionOutlined";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import { api, fmtTime, timeAgo, uploadFile } from "@/lib/client";
import { REACTIONS, type Comment, type Reaction } from "@/lib/types";
import { Avatar, MemberName, useBand } from "./Band";
import { useAudioAttach, type PendingAudio } from "./AudioAttach";
import { useDialogs, useToast } from "./ui";

export type CommentProps = {
  trackId: number;
  setComments: (fn: (c: Comment[]) => Comment[]) => void;
  onSeek: (start: number, end?: number | null) => void;
  highlight: number | null;
};

export async function postComment(
  trackId: number,
  data: { body: string; parent_id?: number; start_sec?: number | null; end_sec?: number | null; audio: PendingAudio | null },
) {
  let audio: Record<string, unknown> = {};
  if (data.audio) {
    const { url } = await uploadFile("comments", data.audio.blob, data.audio.name);
    audio = { audio_url: url, audio_name: data.audio.name, audio_duration: data.audio.duration };
  }
  return api<Comment>(`tracks/${trackId}/comments`, {
    body: { body: data.body, parent_id: data.parent_id, start_sec: data.start_sec, end_sec: data.end_sec, ...audio },
  });
}

export function Stamp({ c, onSeek }: { c: { start_sec: number | null; end_sec: number | null }; onSeek: CommentProps["onSeek"] }) {
  if (c.start_sec == null) return null;
  return (
    <Chip
      size="small"
      color="primary"
      variant="outlined"
      icon={<PlayArrowRounded />}
      label={`${fmtTime(c.start_sec)}${c.end_sec != null ? `–${fmtTime(c.end_sec)}` : ""}`}
      onClick={() => onSeek(c.start_sec!, c.end_sec)}
      sx={{ fontFamily: "ui-monospace, Menlo, monospace", height: 24, bgcolor: "rgba(245,165,36,.08)" }}
    />
  );
}

/** Chat-style composer: text + mic/attach + send. */
export function Composer({
  trackId,
  parentId,
  placeholder,
  onCreated,
  onCancel,
  autoFocus,
}: {
  trackId: number;
  parentId?: number;
  placeholder?: string;
  onCreated: (c: Comment) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const att = useAudioAttach();
  const canSend = (body.trim() || att.audio) && !busy && !att.recording;

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    try {
      onCreated(await postComment(trackId, { body, parent_id: parentId, audio: att.audio }));
      setBody("");
      att.clear();
      onCancel?.();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={1}>
      {att.preview}
      <Stack
        direction="row"
       
        spacing={0.5}
        sx={{ alignItems: "flex-end", border: 1, borderColor: "divider", borderRadius: 3, pl: 1.5, pr: 0.5, py: 0.5, bgcolor: "rgba(255,255,255,.03)", "&:focus-within": { borderColor: "primary.main" } }}
      >
        <TextField
          variant="standard"
          multiline
          maxRows={6}
          autoFocus={autoFocus}
          placeholder={placeholder || (parentId ? "Reply…" : "Add a comment…")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            if (e.key === "Escape") onCancel?.();
          }}
          slotProps={{ input: { disableUnderline: true, sx: { py: 0.75 } } }}
        />
        <Stack direction="row" sx={{ alignItems: "center", pb: 0.25 }}>
          {att.buttons(busy)}
          <IconButton color="primary" disabled={!canSend} onClick={submit} aria-label="Send">
            <SendRounded />
          </IconButton>
        </Stack>
      </Stack>
      {onCancel && (
        <Box>
          <Button size="small" color="inherit" onClick={onCancel}>
            Cancel
          </Button>
        </Box>
      )}
    </Stack>
  );
}

function Reactions({ c, onChange }: { c: Comment; onChange: (r: Reaction[]) => void }) {
  const { me, byId } = useBand();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  async function toggle(emoji: string) {
    setAnchor(null);
    if (!me) return;
    const prev = c.reactions;
    const next = prev.map((r) => ({ ...r, member_ids: [...r.member_ids] }));
    const r = next.find((x) => x.emoji === emoji);
    if (r) r.member_ids = r.member_ids.includes(me.id) ? r.member_ids.filter((i) => i !== me.id) : [...r.member_ids, me.id];
    else next.push({ emoji, member_ids: [me.id] });
    onChange(next.filter((x) => x.member_ids.length));
    try {
      onChange(await api<Reaction[]>(`comments/${c.id}/reactions`, { body: { emoji } }));
    } catch {
      onChange(prev);
    }
  }

  return (
    <>
      {c.reactions.map((r) => {
        const mine = !!me && r.member_ids.includes(me.id);
        return (
          <Chip
            key={r.emoji}
            size="small"
            label={`${r.emoji} ${r.member_ids.length}`}
            title={r.member_ids.map((i) => byId[i]?.name || "Someone").join(", ")}
            onClick={() => toggle(r.emoji)}
            variant={mine ? "filled" : "outlined"}
            sx={mine ? { bgcolor: "rgba(245,165,36,.18)", border: 1, borderColor: "primary.main" } : undefined}
          />
        );
      })}
      <IconButton size="small" aria-label="Add reaction" onClick={(e) => setAnchor(e.currentTarget)} sx={{ color: "text.secondary" }}>
        <AddReactionOutlined fontSize="small" />
      </IconButton>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { borderRadius: 99, p: 0.5 } } }}
      >
        <Stack direction="row">
          {REACTIONS.map((e) => (
            <IconButton key={e} onClick={() => toggle(e)} sx={{ fontSize: 22, width: 42, height: 42 }}>
              {e}
            </IconButton>
          ))}
        </Stack>
      </Popover>
    </>
  );
}

function CommentItem({ c, replies, trackId, setComments, onSeek, highlight }: { c: Comment; replies: Comment[] } & CommentProps) {
  const { me } = useBand();
  const toast = useToast();
  const { confirm } = useDialogs();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.body);
  const [replying, setReplying] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const mine = me?.id === c.member_id;

  useEffect(() => {
    if (highlight === c.id) el.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight, c.id]);

  const patch = (p: Partial<Comment>) => setComments((cs) => cs.map((x) => (x.id === c.id ? { ...x, ...p } : x)));

  async function save() {
    try {
      const r = await api<Comment>(`comments/${c.id}`, { method: "PATCH", body: { body: text } });
      patch({ body: r.body, edited_at: r.edited_at });
      setEditing(false);
    } catch (e: any) {
      toast(e.message, "error");
    }
  }
  async function remove() {
    setMenu(null);
    const ok = await confirm({
      title: c.start_sec != null ? "Delete bookmark?" : "Delete comment?",
      body: replies.length ? "Its replies will be deleted too." : undefined,
      confirm: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`comments/${c.id}`, { method: "DELETE" });
      setComments((cs) => cs.filter((x) => x.id !== c.id && x.parent_id !== c.id));
      toast("Deleted");
    } catch (e: any) {
      toast(e.message, "error");
    }
  }

  return (
    <Box
      ref={el}
      sx={{
        display: "grid",
        gridTemplateColumns: "36px minmax(0,1fr)",
        columnGap: 1.25,
        py: 1.5,
        px: 1,
        mx: -1,
        borderRadius: 2,
        transition: "background-color .4s",
        bgcolor: highlight === c.id ? "rgba(245,165,36,.08)" : "transparent",
      }}
    >
      <Avatar id={c.member_id} size={34} />
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minHeight: 28 }}>
          <MemberName id={c.member_id} />
          <Stamp c={c} onSeek={onSeek} />
          <Typography variant="caption" color="text.disabled" title={new Date(c.created_at).toLocaleString()} noWrap sx={{ flex: 1 }}>
            {timeAgo(c.created_at)}
            {c.edited_at && " · edited"}
          </Typography>
          {mine && !editing && (
            <IconButton size="small" aria-label="More" onClick={(e) => setMenu(e.currentTarget)} sx={{ mr: -0.5 }}>
              <MoreHorizRounded fontSize="small" />
            </IconButton>
          )}
        </Stack>
        <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
          <MenuItem
            onClick={() => {
              setMenu(null);
              setEditing(true);
            }}
          >
            <ListItemIcon>
              <EditRounded fontSize="small" />
            </ListItemIcon>
            Edit
          </MenuItem>
          <MenuItem onClick={remove} sx={{ color: "error.main" }}>
            <ListItemIcon>
              <DeleteOutlineRounded fontSize="small" color="error" />
            </ListItemIcon>
            Delete
          </MenuItem>
        </Menu>

        {editing ? (
          <Stack spacing={1} sx={{ mt: 0.5 }}>
            <TextField multiline autoFocus size="small" value={text} onChange={(e) => setText(e.target.value)} />
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="contained" onClick={save}>
                Save
              </Button>
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  setEditing(false);
                  setText(c.body);
                }}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        ) : (
          c.body && (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", mt: 0.25, fontSize: 15 }}>
              {c.body}
            </Typography>
          )
        )}
        {c.audio_url && (
          <Box sx={{ mt: 1 }}>
            <audio className="inline" src={c.audio_url} controls preload="none" />
            <Typography variant="caption" color="text.disabled">
              {c.audio_name}
              {c.audio_duration ? ` · ${fmtTime(c.audio_duration)}` : ""}
            </Typography>
          </Box>
        )}
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ alignItems: "center", mt: 0.75, flexWrap: "wrap" }}>
          <Reactions c={c} onChange={(reactions) => patch({ reactions })} />
          {!c.parent_id && (
            <Button size="small" color="inherit" startIcon={<ReplyRounded />} onClick={() => setReplying((r) => !r)} sx={{ color: "text.secondary", minWidth: 0 }}>
              Reply
            </Button>
          )}
        </Stack>
        {(replies.length > 0 || replying) && (
          <Box sx={{ mt: 0.5, pl: 1.5, borderLeft: 2, borderColor: "divider" }}>
            {replies.map((r) => (
              <CommentItem key={r.id} c={r} replies={[]} trackId={trackId} setComments={setComments} onSeek={onSeek} highlight={highlight} />
            ))}
            {replying && (
              <Box sx={{ pt: 1 }}>
                <Composer
                  trackId={trackId}
                  parentId={c.id}
                  autoFocus
                  onCancel={() => setReplying(false)}
                  onCreated={(n) => setComments((cs) => [...cs, n])}
                />
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function CommentList({ items, all, ...rest }: CommentProps & { items: Comment[]; all: Comment[] }) {
  if (!items.length) return null;
  return (
    <Box>
      {items.map((c) => (
        <CommentItem key={c.id} c={c} replies={all.filter((r) => r.parent_id === c.id)} {...rest} />
      ))}
    </Box>
  );
}
