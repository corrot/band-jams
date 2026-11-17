"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CircularProgress,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import AddPhotoAlternateRounded from "@mui/icons-material/AddPhotoAlternateRounded";
import MoreVertRounded from "@mui/icons-material/MoreVertRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import ShortTextRounded from "@mui/icons-material/ShortTextRounded";
import { api, uploadFile } from "@/lib/client";
import type { TrackInstrument, TrackInstrumentImage } from "@/lib/types";
import { Avatar, MemberName, useBand } from "./Band";
import { Lightbox } from "./Lightbox";
import { EmptyState, Sheet, useDialogs, useFilePicker, useToast } from "./ui";

type SetItems = (fn: (x: TrackInstrument[]) => TrackInstrument[]) => void;

export function TrackInstruments({ trackId, items, setItems }: { trackId: number; items: TrackInstrument[]; setItems: SetItems }) {
  const [editor, setEditor] = useState<{ open: boolean; existing?: TrackInstrument }>({ open: false });
  return (
    <Box>
      {items.length === 0 ? (
        <EmptyState
          icon={<TuneRounded />}
          title="No gear noted yet"
          body="Note who played what, plus amp, pedal or processor settings. Add photos of a processor screen to keep a patch."
          action={
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => setEditor({ open: true })}>
              Add instrument
            </Button>
          }
        />
      ) : (
        <Stack spacing={1.5}>
          {items.map((ti) => (
            <InstrumentCard key={ti.id} ti={ti} setItems={setItems} onEdit={() => setEditor({ open: true, existing: ti })} />
          ))}
          <Box>
            <Button startIcon={<AddRounded />} onClick={() => setEditor({ open: true })}>
              Add instrument
            </Button>
          </Box>
        </Stack>
      )}
      <InstrumentSheet
        open={editor.open}
        existing={editor.existing}
        trackId={trackId}
        onClose={() => setEditor({ open: false })}
        onSaved={(ti, isNew) => setItems((xs) => (isNew ? [...xs, ti] : xs.map((x) => (x.id === ti.id ? ti : x))))}
      />
    </Box>
  );
}

function InstrumentSheet({
  open,
  existing,
  trackId,
  onClose,
  onSaved,
}: {
  open: boolean;
  existing?: TrackInstrument;
  trackId: number;
  onClose: () => void;
  onSaved: (ti: TrackInstrument, isNew: boolean) => void;
}) {
  const { members, me } = useBand();
  const toast = useToast();
  const [memberId, setMemberId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [name, setName] = useState("");
  const [settings, setSettings] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMemberId(String(existing?.member_id ?? me?.id ?? ""));
    setInstrumentId(existing?.instrument_id ? String(existing.instrument_id) : "");
    setName(existing?.name ?? "");
    setSettings(existing?.settings ?? "");
  }, [open, existing, me]);

  const inv = members.find((m) => String(m.id) === memberId)?.instruments || [];

  async function save() {
    setBusy(true);
    try {
      const chosen = inv.find((i) => String(i.id) === instrumentId);
      const body = {
        member_id: memberId ? Number(memberId) : null,
        instrument_id: !existing && chosen ? chosen.id : undefined,
        name: name.trim() || chosen?.name || "",
        settings,
      };
      if (existing) {
        const r = await api<TrackInstrument>(`track-instruments/${existing.id}`, { method: "PATCH", body });
        onSaved({ ...existing, ...r, images: existing.images }, false);
      } else {
        onSaved(await api<TrackInstrument>(`tracks/${trackId}/instruments`, { body }), true);
      }
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
      title={existing ? "Edit instrument" : "Add instrument"}
      actions={
        <>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" disabled={busy || (!name.trim() && !instrumentId)} onClick={save}>
            {existing ? "Save" : "Add"}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <TextField
          select
          label="Played by"
          value={memberId}
          onChange={(e) => {
            setMemberId(e.target.value);
            setInstrumentId("");
          }}
        >
          <MenuItem value="">Nobody / shared</MenuItem>
          {members.map((m) => (
            <MenuItem key={m.id} value={String(m.id)}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Avatar member={m} size={22} />
                <span>{m.name}</span>
              </Stack>
            </MenuItem>
          ))}
        </TextField>
        {!existing && inv.length > 0 && (
          <TextField
            select
            label="From their gear"
            value={instrumentId}
            onChange={(e) => {
              setInstrumentId(e.target.value);
              const i = inv.find((x) => String(x.id) === e.target.value);
              if (i) setName(i.name);
            }}
          >
            <MenuItem value="">Something else</MenuItem>
            {inv.map((i) => (
              <MenuItem key={i.id} value={String(i.id)}>
                {i.name} · {i.kind}
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextField label="Instrument / device" placeholder="e.g. Strat → Boss GT-1000" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Settings (optional)"
          multiline
          minRows={4}
          placeholder={"Patch: U12-3 Crunch\nGain 6 · Bass 4 · Mid 7 · Treble 5\nDelay 380ms, 25% mix"}
          value={settings}
          onChange={(e) => setSettings(e.target.value)}
          slotProps={{ input: { sx: { fontFamily: "ui-monospace, Menlo, monospace", fontSize: 14 } } }}
        />
        {!existing && (
          <Typography variant="caption" color="text.secondary">
            You can add photos of the settings after saving.
          </Typography>
        )}
      </Stack>
    </Sheet>
  );
}

function InstrumentCard({ ti, setItems, onEdit }: { ti: TrackInstrument; setItems: SetItems; onEdit: () => void }) {
  const toast = useToast();
  const { confirm, prompt } = useDialogs();
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [imgMenu, setImgMenu] = useState<{ el: HTMLElement; img: TrackInstrumentImage } | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const setImages = (fn: (i: TrackInstrumentImage[]) => TrackInstrumentImage[]) =>
    setItems((xs) => xs.map((x) => (x.id === ti.id ? { ...x, images: fn(x.images) } : x)));

  const picker = useFilePicker("image/*", true, async (files) => {
    const list = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(f.name));
    for (let i = 0; i < list.length; i++) {
      setUploading(`${i + 1}/${list.length}`);
      try {
        const { url } = await uploadFile("images", list[i], list[i].name);
        const img = await api<TrackInstrumentImage>(`track-instruments/${ti.id}/images`, { body: { url, caption: "" } });
        setImages((imgs) => [...imgs, img]);
      } catch (e: any) {
        toast(e.message, "error");
      }
    }
    setUploading(null);
  });

  async function caption(img: TrackInstrumentImage) {
    setImgMenu(null);
    const c = await prompt({ title: "Photo caption", label: "Caption", initial: img.caption });
    if (c === null) return;
    const r = await api<TrackInstrumentImage>(`images/${img.id}`, { method: "PATCH", body: { caption: c } });
    setImages((imgs) => imgs.map((i) => (i.id === img.id ? r : i)));
  }
  async function removeImage(img: TrackInstrumentImage) {
    setImgMenu(null);
    if (!(await confirm({ title: "Delete this photo?", confirm: "Delete", danger: true }))) return;
    await api(`images/${img.id}`, { method: "DELETE" });
    setImages((imgs) => imgs.filter((i) => i.id !== img.id));
  }
  async function remove() {
    setMenu(null);
    if (!(await confirm({ title: `Remove ${ti.name}?`, body: ti.images.length ? "Its photos will be deleted too." : undefined, confirm: "Remove", danger: true })))
      return;
    await api(`track-instruments/${ti.id}`, { method: "DELETE" });
    setItems((xs) => xs.filter((x) => x.id !== ti.id));
  }

  return (
    <Card sx={{ p: 1.5 }}>
      {picker.input}
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        {ti.member_id ? <Avatar id={ti.member_id} size={36} /> : <TuneRounded color="disabled" />}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap>
            {ti.name}
          </Typography>
          {ti.member_id ? <MemberName id={ti.member_id} variant="caption" /> : <Typography variant="caption" color="text.secondary">Shared</Typography>}
        </Box>
        <IconButton aria-label="Add photos" onClick={picker.open} disabled={!!uploading}>
          {uploading ? <CircularProgress size={20} /> : <AddPhotoAlternateRounded />}
        </IconButton>
        <IconButton aria-label="More" onClick={(e) => setMenu(e.currentTarget)} edge="end">
          <MoreVertRounded />
        </IconButton>
      </Stack>
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            setMenu(null);
            onEdit();
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
          Remove
        </MenuItem>
      </Menu>

      {ti.settings && (
        <Box
          sx={{
            mt: 1.25,
            p: 1.25,
            borderRadius: 2,
            bgcolor: "background.default",
            border: 1,
            borderColor: "divider",
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            color: "#cfd1d6",
          }}
        >
          {ti.settings}
        </Box>
      )}

      {ti.images.length > 0 && (
        <Box sx={{ mt: 1.25, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 0.75 }}>
          {ti.images.map((img, i) => (
            <Box
              key={img.id}
              onClick={() => setLightbox(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                setImgMenu({ el: e.currentTarget, img });
              }}
              sx={{ position: "relative", aspectRatio: "1", borderRadius: 2, overflow: "hidden", cursor: "zoom-in", border: 1, borderColor: "divider" }}
            >
              <Box component="img" src={img.url} alt={img.caption} loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {img.caption && (
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ position: "absolute", left: 0, right: 0, bottom: 0, px: 0.75, py: 0.25, bgcolor: "rgba(0,0,0,.65)", fontSize: 10.5 }}
                >
                  {img.caption}
                </Typography>
              )}
              <IconButton
                size="small"
                aria-label="Photo options"
                onClick={(e) => {
                  e.stopPropagation();
                  setImgMenu({ el: e.currentTarget, img });
                }}
                sx={{ position: "absolute", top: 2, right: 2, bgcolor: "rgba(0,0,0,.55)", width: 26, height: 26, "&:hover": { bgcolor: "rgba(0,0,0,.75)" } }}
              >
                <MoreVertRounded sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
      <Menu anchorEl={imgMenu?.el} open={!!imgMenu} onClose={() => setImgMenu(null)}>
        <MenuItem onClick={() => imgMenu && caption(imgMenu.img)}>
          <ListItemIcon>
            <ShortTextRounded fontSize="small" />
          </ListItemIcon>
          Caption
        </MenuItem>
        <MenuItem onClick={() => imgMenu && removeImage(imgMenu.img)} sx={{ color: "error.main" }}>
          <ListItemIcon>
            <DeleteOutlineRounded fontSize="small" color="error" />
          </ListItemIcon>
          Delete photo
        </MenuItem>
      </Menu>
      <Lightbox images={ti.images} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />
    </Card>
  );
}
