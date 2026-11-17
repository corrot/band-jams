"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Fab,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import SortRounded from "@mui/icons-material/SortRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import PauseRounded from "@mui/icons-material/PauseRounded";
import ChatBubbleOutlineRounded from "@mui/icons-material/ChatBubbleOutlineRounded";
import BookmarkBorderRounded from "@mui/icons-material/BookmarkBorderRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import LibraryMusicRounded from "@mui/icons-material/LibraryMusicRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { api, fmtDate, fmtSize, fmtTime } from "@/lib/client";
import { STATUSES, type TrackSummary } from "@/lib/types";
import { useBand, useDock } from "@/components/Band";
import { MiniWave } from "@/components/MiniWave";
import { UploadSheet } from "@/components/Uploader";
import { Votes } from "@/components/Votes";
import { StatusChip } from "@/components/StatusChip";
import { Page, PageBar } from "@/components/Shell";
import { EmptyState, useIsMobile } from "@/components/ui";

type Sort = "priority" | "recorded" | "uploaded" | "length" | "discussed";
const SORTS: { value: Sort; label: string }[] = [
  { value: "priority", label: "Priority (votes)" },
  { value: "recorded", label: "Recording date" },
  { value: "uploaded", label: "Recently uploaded" },
  { value: "length", label: "Longest first" },
  { value: "discussed", label: "Most discussed" },
];
type Filter = "active" | "unvoted" | "all" | (typeof STATUSES)[number]["value"];

export default function TracksPage() {
  const { me } = useBand();
  const dock = useDock();
  const router = useRouter();
  const mobile = useIsMobile();
  const [tracks, setTracks] = useState<TrackSummary[] | null>(null);
  const [err, setErr] = useState("");
  const [upload, setUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("active");
  const [sort, setSort] = useState<Sort>("priority");
  const [sortEl, setSortEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    api<TrackSummary[]>("tracks")
      .then(setTracks)
      .catch((e) => setErr(e.message));
  }, []);

  const unvoted = useMemo(
    () => (tracks && me ? tracks.filter((t) => t.status !== "archived" && t.status !== "done" && !t.votes.some((v) => v.member_id === me.id)).length : 0),
    [tracks, me],
  );

  const shown = useMemo(() => {
    if (!tracks) return [];
    const s = search.trim().toLowerCase();
    const list = tracks.filter((t) => {
      if (filter === "active" && (t.status === "archived" || t.status === "done")) return false;
      if (filter === "unvoted" && (t.status === "archived" || t.status === "done" || (me && t.votes.some((v) => v.member_id === me.id)))) return false;
      if (!["active", "unvoted", "all"].includes(filter) && t.status !== filter) return false;
      if (s && !`${t.title} ${t.description} ${t.file_name}`.toLowerCase().includes(s)) return false;
      return true;
    });
    const date = (t: TrackSummary) => new Date(t.recorded_at || t.created_at).getTime();
    const cmp: Record<Sort, (a: TrackSummary, b: TrackSummary) => number> = {
      priority: (a, b) => b.score - a.score || b.votes.length - a.votes.length || date(b) - date(a),
      recorded: (a, b) => date(b) - date(a),
      uploaded: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      length: (a, b) => (b.duration_sec || 0) - (a.duration_sec || 0),
      discussed: (a, b) => b.comment_count + b.bookmark_count - (a.comment_count + a.bookmark_count),
    };
    return [...list].sort(cmp[sort]);
  }, [tracks, search, filter, sort, me]);

  const update = (id: number, p: Partial<TrackSummary>) => setTracks((xs) => xs && xs.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of tracks || []) c[t.status] = (c[t.status] || 0) + 1;
    return c;
  }, [tracks]);

  const filters: { value: Filter; label: string; count?: number }[] = [
    { value: "active", label: "Active" },
    ...(unvoted ? [{ value: "unvoted" as Filter, label: "Needs my vote", count: unvoted }] : []),
    ...STATUSES.map((s) => ({ value: s.value as Filter, label: s.label, count: counts[s.value] || 0 })),
    { value: "all", label: "All", count: tracks?.length || 0 },
  ];

  const searchField = (
    <TextField
      size="small"
      placeholder="Search tracks"
      value={search}
      autoFocus={mobile}
      onChange={(e) => setSearch(e.target.value)}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchRounded fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: (search || mobile) && (
            <InputAdornment position="end">
              <IconButton
                size="small"
                aria-label="Clear search"
                onClick={() => {
                  setSearch("");
                  setSearchOpen(false);
                }}
              >
                <CloseRounded fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );

  return (
    <>
      <PageBar
        title={mobile && searchOpen ? searchField : "Tracks"}
        subtitle={!searchOpen && tracks ? `${tracks.length} recording${tracks.length === 1 ? "" : "s"}` : undefined}
        actions={
          <>
            {mobile && !searchOpen && (
              <IconButton aria-label="Search" onClick={() => setSearchOpen(true)}>
                <SearchRounded />
              </IconButton>
            )}
            {!mobile && <Box sx={{ width: 260 }}>{searchField}</Box>}
            <Tooltip title="Sort">
              <IconButton aria-label="Sort" onClick={(e) => setSortEl(e.currentTarget)}>
                <SortRounded />
              </IconButton>
            </Tooltip>
            {!mobile && (
              <Button variant="contained" startIcon={<AddRounded />} onClick={() => setUpload(true)} sx={{ ml: 1 }}>
                Upload
              </Button>
            )}
          </>
        }
      />
      <Menu anchorEl={sortEl} open={!!sortEl} onClose={() => setSortEl(null)}>
        {SORTS.map((s) => (
          <MenuItem
            key={s.value}
            selected={sort === s.value}
            onClick={() => {
              setSort(s.value);
              setSortEl(null);
            }}
          >
            <ListItemIcon>{sort === s.value && <CheckRounded fontSize="small" />}</ListItemIcon>
            {s.label}
          </MenuItem>
        ))}
      </Menu>

      <Page>
        {!mobile && (
          <Typography variant="h1" sx={{ mb: 2 }}>
            Tracks
          </Typography>
        )}
        <Stack
          direction="row"
          spacing={1}
          sx={{ overflowX: "auto", pb: 1.5, mx: { xs: -1.5, sm: 0 }, px: { xs: 1.5, sm: 0 }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}
        >
          {filters.map((f) => (
            <Chip
              key={f.value}
              label={f.count !== undefined && f.value !== "active" ? `${f.label} · ${f.count}` : f.label}
              color={filter === f.value ? "primary" : "default"}
              variant={filter === f.value ? "filled" : "outlined"}
              onClick={() => setFilter(f.value)}
              sx={{ flexShrink: 0, ...(f.value === "unvoted" && filter !== f.value ? { borderColor: "primary.main", color: "primary.main" } : {}) }}
            />
          ))}
        </Stack>

        {err && <Alert severity="error">{err}</Alert>}

        {!tracks && !err && (
          <Stack spacing={1.25}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={128} />
            ))}
          </Stack>
        )}

        {tracks && shown.length === 0 && (
          <EmptyState
            icon={<LibraryMusicRounded />}
            title={tracks.length === 0 ? "No jams yet" : "Nothing here"}
            body={tracks.length === 0 ? "Upload your first recordings: WhatsApp voice notes and exported audio both work." : "Try another filter or search."}
            action={
              tracks.length === 0 && (
                <Button variant="contained" startIcon={<AddRounded />} onClick={() => setUpload(true)}>
                  Upload recordings
                </Button>
              )
            }
          />
        )}

        <Stack spacing={1.25}>
          {shown.map((t, i) => {
            const active = dock.track?.id === t.id;
            const dur = t.duration_sec || (active ? dock.duration : 0);
            return (
              <Card key={t.id} sx={{ borderColor: active ? "primary.main" : undefined }}>
                <CardActionArea component="div" onClick={() => router.push(`/tracks/${t.id}`)} sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                    <IconButton
                      aria-label={active && dock.playing ? "Pause" : "Play"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (active) dock.toggle();
                        else dock.play(t);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      sx={{
                        width: 48,
                        height: 48,
                        flexShrink: 0,
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        "&:hover": { bgcolor: "primary.light" },
                      }}
                    >
                      {active && dock.playing ? <PauseRounded /> : <PlayArrowRounded />}
                    </IconButton>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        {sort === "priority" && (
                          <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace" }}>
                            #{i + 1}
                          </Typography>
                        )}
                        <Typography variant="subtitle1" noWrap sx={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                          {t.title}
                        </Typography>
                        <StatusChip status={t.status} />
                      </Stack>
                      <Stack direction="row" spacing={1.25} sx={{ color: "text.secondary", mt: 0.25, flexWrap: "wrap" }} useFlexGap>
                        <Typography variant="caption">{fmtDate(t.recorded_at || t.created_at)}</Typography>
                        <Typography variant="caption">{fmtTime(t.duration_sec)}</Typography>
                        <Typography variant="caption">{fmtSize(t.size_bytes)}</Typography>
                        {t.comment_count > 0 && <Meta icon={<ChatBubbleOutlineRounded />} n={t.comment_count} />}
                        {t.bookmark_count > 0 && <Meta icon={<BookmarkBorderRounded />} n={t.bookmark_count} />}
                        {t.link_count > 0 && <Meta icon={<LinkRounded />} n={t.link_count} />}
                      </Stack>
                      <Box sx={{ mt: 1 }} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                        <MiniWave
                          peaks={t.peaks}
                          height={32}
                          progress={active && dur ? dock.time / dur : 0}
                          onSeek={(f) => (dur ? (active ? dock.seek(f * dur) : dock.play(t, f * dur)) : dock.play(t))}
                        />
                      </Box>
                      <Box sx={{ mt: 1 }} onMouseDown={(e) => e.stopPropagation()}>
                        <Votes dense trackId={t.id} votes={t.votes} score={t.score} onChange={(v) => update(t.id, v)} />
                      </Box>
                    </Box>
                  </Stack>
                </CardActionArea>
              </Card>
            );
          })}
        </Stack>
      </Page>

      {mobile && (
        <Fab
          color="primary"
          aria-label="Upload"
          onClick={() => setUpload(true)}
          sx={{
            position: "fixed",
            right: 16,
            bottom: `calc(${64 + 16 + (dock.track ? 72 : 0)}px + env(safe-area-inset-bottom))`,
            zIndex: 1050,
            transition: "bottom .2s",
          }}
        >
          <AddRounded />
        </Fab>
      )}
      <UploadSheet open={upload} onClose={() => setUpload(false)} onUploaded={(t) => setTracks((xs) => [t, ...(xs || [])])} />
    </>
  );
}

function Meta({ icon, n }: { icon: React.ReactElement; n: number }) {
  return (
    <Stack direction="row" spacing={0.4} sx={{ alignItems: "center", "& svg": { fontSize: 14 } }}>
      {icon}
      <Typography variant="caption">{n}</Typography>
    </Stack>
  );
}
