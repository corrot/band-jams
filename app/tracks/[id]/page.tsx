"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import MoreVertRounded from "@mui/icons-material/MoreVertRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import BookmarkAddRounded from "@mui/icons-material/BookmarkAddRounded";
import BookmarkBorderRounded from "@mui/icons-material/BookmarkBorderRounded";
import ChatBubbleOutlineRounded from "@mui/icons-material/ChatBubbleOutlineRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import { api, fmtDate, fmtSize, fmtTime, toLocalInput } from "@/lib/client";
import { STATUSES, type Comment, type TrackDetail } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/theme";
import { MemberName } from "@/components/Band";
import { TrackPlayer, type PlayerHandle, type Selection } from "@/components/TrackPlayer";
import { Votes } from "@/components/Votes";
import { CommentList, Composer } from "@/components/Comments";
import { BookmarkSheet, type Range } from "@/components/BookmarkSheet";
import { Links } from "@/components/Links";
import { TrackInstruments } from "@/components/TrackInstruments";
import { Page, PageBar } from "@/components/Shell";
import { EmptyState, Sheet, useDialogs, useIsMobile, useToast } from "@/components/ui";

const TABS = ["bookmarks", "comments", "gear", "links"] as const;
type TabKey = (typeof TABS)[number];

export default function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const mobile = useIsMobile();
  const toast = useToast();
  const { confirm } = useDialogs();
  const [t, setT] = useState<TrackDetail | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<TabKey>("bookmarks");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [bmSheet, setBmSheet] = useState<{ open: boolean; range: Range | null }>({ open: false, range: null });
  const [highlight, setHighlight] = useState<number | null>(null);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [statusEl, setStatusEl] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const player = useRef<PlayerHandle>(null);

  useEffect(() => {
    const h = window.location.hash.slice(1) as TabKey;
    if (TABS.includes(h)) setTab(h);
  }, []);

  useEffect(() => {
    setT(null);
    api<TrackDetail>(`tracks/${id}`)
      .then(setT)
      .catch((e) => setErr(e.message));
  }, [id]);

  const setComments = (fn: (c: Comment[]) => Comment[]) => setT((x) => (x ? { ...x, comments: fn(x.comments) } : x));
  const bookmarks = useMemo(
    () => (t ? t.comments.filter((c) => c.start_sec != null && !c.parent_id).sort((a, b) => a.start_sec! - b.start_sec!) : []),
    [t],
  );
  const discussion = useMemo(() => (t ? t.comments.filter((c) => !c.parent_id && c.start_sec == null).reverse() : []), [t]);

  if (err)
    return (
      <>
        <PageBar title="Track" back="/" />
        <Page>
          <Alert severity="error">{err}</Alert>
        </Page>
      </>
    );
  if (!t)
    return (
      <>
        <PageBar title="Loading…" back="/" />
        <Page narrow>
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={190} />
            <Skeleton variant="rounded" height={56} />
            <Skeleton variant="rounded" height={240} />
          </Stack>
        </Page>
      </>
    );

  const seek = (start: number, end?: number | null) => player.current?.playAt(start, end);
  const commentProps = { trackId: t.id, setComments, onSeek: seek, highlight };
  const changeTab = (v: TabKey) => {
    setTab(v);
    history.replaceState(null, "", `#${v}`);
  };

  async function setStatus(status: string) {
    setStatusEl(null);
    try {
      const r = await api<TrackDetail>(`tracks/${t!.id}`, { method: "PATCH", body: { status } });
      setT((x) => (x ? { ...x, status: r.status } : x));
      toast(`Marked as ${STATUSES.find((s) => s.value === status)?.label}`);
    } catch (e: any) {
      toast(e.message, "error");
    }
  }

  async function del() {
    setMenu(null);
    const ok = await confirm({
      title: "Delete this track?",
      body: `“${t!.title}” and all its comments, bookmarks and photos will be removed for everyone.`,
      confirm: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`tracks/${t!.id}`, { method: "DELETE" });
      toast("Track deleted");
      router.push("/");
    } catch (e: any) {
      toast(e.message, "error");
    }
  }

  const statusColor = STATUS_COLORS[t.status];
  const tabLabel = (label: string, n: number) => (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
      <span>{label}</span>
      {n > 0 && <Badge badgeContent={n} color="default" sx={{ "& .MuiBadge-badge": { position: "static", transform: "none", bgcolor: "action.selected" } }} />}
    </Stack>
  );

  return (
    <>
      <PageBar
        back="/"
        title={t.title}
        subtitle={`${fmtDate(t.recorded_at || t.created_at)} · ${fmtTime(t.duration_sec)}`}
        actions={
          <IconButton aria-label="Track options" onClick={(e) => setMenu(e.currentTarget)}>
            <MoreVertRounded />
          </IconButton>
        }
      />
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
          Edit details
        </MenuItem>
        <MenuItem component="a" href={t.file_url} target="_blank" rel="noreferrer" onClick={() => setMenu(null)}>
          <ListItemIcon>
            <DownloadRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Download" secondary={fmtSize(t.size_bytes)} />
        </MenuItem>
        <MenuItem onClick={del} sx={{ color: "error.main" }}>
          <ListItemIcon>
            <DeleteOutlineRounded fontSize="small" color="error" />
          </ListItemIcon>
          Delete track
        </MenuItem>
      </Menu>

      <Page narrow>
        <Stack spacing={2}>
          {!mobile && (
            <Box>
              <Typography variant="h1">{t.title}</Typography>
            </Box>
          )}
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center", color: "text.secondary" }}>
            <Chip
              label={STATUSES.find((s) => s.value === t.status)?.label}
              onClick={(e) => setStatusEl(e.currentTarget)}
              onDelete={(e) => setStatusEl((e.currentTarget as HTMLElement).parentElement)}
              deleteIcon={<ExpandMoreRounded />}
              variant="outlined"
              sx={{ color: statusColor, borderColor: `${statusColor}88`, "& .MuiChip-deleteIcon": { color: statusColor } }}
            />
            <Typography variant="body2" component="span">
              {fmtDate(t.recorded_at || t.created_at, true)} · {fmtSize(t.size_bytes)} · by <MemberName id={t.uploaded_by} variant="body2" />
            </Typography>
          </Stack>
          <Menu anchorEl={statusEl} open={!!statusEl} onClose={() => setStatusEl(null)}>
            {STATUSES.map((s) => (
              <MenuItem key={s.value} selected={t.status === s.value} onClick={() => setStatus(s.value)}>
                <ListItemIcon>{t.status === s.value && <CheckRounded fontSize="small" />}</ListItemIcon>
                <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: STATUS_COLORS[s.value], mr: 1.25 }} />
                {s.label}
              </MenuItem>
            ))}
          </Menu>

          <Card
            sx={{
              p: { xs: 1.5, sm: 2 },
              position: { xs: "relative", md: "sticky" },
              top: { md: 64 },
              zIndex: 10,
              boxShadow: "0 12px 24px -12px rgba(0,0,0,.6)",
            }}
          >
            <TrackPlayer
              ref={player}
              track={t}
              bookmarks={bookmarks}
              onSelection={setSelection}
              onBookmarkClick={(c) => {
                setHighlight(c.id);
                changeTab("bookmarks");
              }}
            />
            {selection && (
              <Paper
                variant="outlined"
                sx={{ mt: 1, p: 0.75, pl: 1.5, display: "flex", alignItems: "center", gap: 1, borderColor: "primary.main", bgcolor: "rgba(245,165,36,.06)" }}
              >
                <Typography variant="body2" sx={{ flex: 1, fontFamily: "ui-monospace, Menlo, monospace" }} noWrap>
                  {fmtTime(selection.start)}–{fmtTime(selection.end)}
                </Typography>
                <IconButton size="small" aria-label="Play selection" onClick={() => seek(selection.start, selection.end)}>
                  <PlayArrowRounded />
                </IconButton>
                <Button size="small" variant="contained" startIcon={<BookmarkAddRounded />} onClick={() => setBmSheet({ open: true, range: selection })}>
                  Bookmark
                </Button>
                <IconButton
                  size="small"
                  aria-label="Clear selection"
                  onClick={() => {
                    setSelection(null);
                    player.current?.clearSelection();
                  }}
                >
                  <CloseRounded fontSize="small" />
                </IconButton>
              </Paper>
            )}
          </Card>

          <Card sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <Typography variant="subtitle2" color="text.secondary">
                Your vote
              </Typography>
              <Votes trackId={t.id} votes={t.votes} score={t.score} onChange={(v) => setT((x) => (x ? { ...x, ...v } : x))} />
            </Stack>
          </Card>

          {t.description && (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: "text.secondary", px: 0.5 }}>
              {t.description}
            </Typography>
          )}

          <Box>
            <Tabs
              value={tab}
              onChange={(_, v) => changeTab(v)}
              variant={mobile ? "scrollable" : "standard"}
              scrollButtons={false}
              sx={{ borderBottom: 1, borderColor: "divider", mx: { xs: -1.5, sm: 0 }, px: { xs: 0.5, sm: 0 } }}
            >
              <Tab value="bookmarks" label={tabLabel("Bookmarks", bookmarks.length)} />
              <Tab value="comments" label={tabLabel("Comments", discussion.length)} />
              <Tab value="gear" label={tabLabel("Gear", t.instruments.length)} />
              <Tab value="links" label={tabLabel("Connected", t.links.length)} />
            </Tabs>

            <Box sx={{ pt: 2 }}>
              {tab === "bookmarks" && (
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                    <Button
                      variant="outlined"
                      startIcon={<BookmarkAddRounded />}
                      onClick={() => setBmSheet({ open: true, range: { start: player.current?.currentTime() ?? 0, end: null } })}
                    >
                      Bookmark current moment
                    </Button>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Tip: drag across the waveform to mark a stretch.
                  </Typography>
                  {bookmarks.length === 0 ? (
                    <EmptyState icon={<BookmarkBorderRounded />} title="No bookmarks yet" body="Mark the riffs, mistakes and moments worth coming back to." />
                  ) : (
                    <CommentList items={bookmarks} all={t.comments} {...commentProps} />
                  )}
                </Stack>
              )}

              {tab === "comments" && (
                <Stack spacing={1}>
                  <Composer trackId={t.id} onCreated={(c) => setComments((cs) => [...cs, c])} />
                  {discussion.length === 0 ? (
                    <EmptyState icon={<ChatBubbleOutlineRounded />} title="No comments yet" body="Start the conversation, or record a voice note." />
                  ) : (
                    <CommentList items={discussion} all={t.comments} {...commentProps} />
                  )}
                </Stack>
              )}

              {tab === "gear" && (
                <TrackInstruments trackId={t.id} items={t.instruments} setItems={(fn) => setT((x) => (x ? { ...x, instruments: fn(x.instruments) } : x))} />
              )}

              {tab === "links" && <Links trackId={t.id} links={t.links} setLinks={(links) => setT((x) => (x ? { ...x, links } : x))} />}
            </Box>
          </Box>
        </Stack>
      </Page>

      <BookmarkSheet
        open={bmSheet.open}
        onClose={() => setBmSheet({ open: false, range: null })}
        trackId={t.id}
        initial={bmSheet.range}
        getTime={() => player.current?.currentTime() ?? 0}
        onCreated={(c) => {
          setComments((cs) => [...cs, c]);
          setSelection(null);
          player.current?.clearSelection();
          changeTab("bookmarks");
        }}
      />
      <EditTrackSheet
        open={editing}
        t={t}
        onClose={() => setEditing(false)}
        onSaved={(p) => {
          setT((x) => (x ? { ...x, ...p } : x));
          toast("Saved");
        }}
      />
    </>
  );
}

function EditTrackSheet({ open, t, onClose, onSaved }: { open: boolean; t: TrackDetail; onClose: () => void; onSaved: (p: Partial<TrackDetail>) => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(t.title);
  const [description, setDescription] = useState(t.description);
  const [recorded, setRecorded] = useState(toLocalInput(t.recorded_at));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(t.title);
    setDescription(t.description);
    setRecorded(toLocalInput(t.recorded_at));
  }, [open, t]);

  async function save() {
    setBusy(true);
    try {
      const r = await api<TrackDetail>(`tracks/${t.id}`, {
        method: "PATCH",
        body: { title, description, recorded_at: recorded ? new Date(recorded).toISOString() : null },
      });
      onSaved({ title: r.title, description: r.description, recorded_at: r.recorded_at });
      onClose();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Edit details"
      actions={
        <>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" disabled={busy || !title.trim()} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField label="Recorded" type="datetime-local" value={recorded} onChange={(e) => setRecorded(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField
          label="Notes"
          multiline
          minRows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Key, tempo, lyric ideas, who played what…"
        />
      </Stack>
    </Sheet>
  );
}
