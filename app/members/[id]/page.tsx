"use client";

import { use, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EditRounded from "@mui/icons-material/EditRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import PhotoCameraRounded from "@mui/icons-material/PhotoCameraRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import MoreVertRounded from "@mui/icons-material/MoreVertRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import PianoRounded from "@mui/icons-material/PianoRounded";
import { api, uploadFile } from "@/lib/client";
import { INSTRUMENT_KINDS, type Instrument, type Member } from "@/lib/types";
import { Avatar, useBand } from "@/components/Band";
import { Page, PageBar } from "@/components/Shell";
import { EmptyState, Sheet, useDialogs, useFilePicker, useToast } from "@/components/ui";

const KIND_EMOJI: Record<string, string> = {
  Guitar: "🎸",
  Bass: "🎸",
  Drums: "🥁",
  Percussion: "🪘",
  "Keys / Synth": "🎹",
  Vocals: "🎤",
  Amp: "🔊",
  "Processor / Pedal": "🎛️",
  Mic: "🎙️",
  "Software / Plugin": "💻",
  Other: "🎵",
};

export default function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = use(params);
  const { me, refresh } = useBand();
  const toast = useToast();
  const id = raw === "me" ? me?.id : Number(raw);
  const [m, setM] = useState<Member | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [gear, setGear] = useState<{ open: boolean; existing?: Instrument }>({ open: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<Member>(`members/${id}`)
      .then((r) => {
        setM(r);
        if (raw === "me" && !r.bio && !r.instruments?.length) setEditing(true);
      })
      .catch((e) => setErr(e.message));
  }, [id, raw]);

  const mine = !!m && me?.id === m.id;
  const update = (p: Partial<Member>) => {
    setM((x) => (x ? { ...x, ...p } : x));
    refresh();
  };

  const photo = useFilePicker("image/*", false, async ([f]) => {
    if (!m) return;
    setBusy(true);
    try {
      const { url } = await uploadFile("avatars", f, f.name);
      update(await api<Member>(`members/${m.id}`, { method: "PATCH", body: { avatar_url: url } }));
      toast("Photo updated");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  });

  if (err)
    return (
      <>
        <PageBar title="Profile" back="/members" />
        <Page narrow>
          <Alert severity="error">{err}</Alert>
        </Page>
      </>
    );

  const list = m?.instruments || [];

  return (
    <>
      <PageBar
        title={mine ? "Me" : m?.name || "Profile"}
        back={mine ? undefined : "/members"}
        actions={
          mine && (
            <IconButton aria-label="Edit profile" onClick={() => setEditing(true)}>
              <EditRounded />
            </IconButton>
          )
        }
      />
      <Page narrow>
        {!m ? (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={200} />
            <Skeleton variant="rounded" height={160} />
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            {photo.input}
            <Card sx={{ p: 3, textAlign: "center", background: `linear-gradient(180deg, ${m.color}22, transparent 70%)` }}>
              <Stack spacing={1.5} sx={{ alignItems: "center" }}>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  badgeContent={
                    mine && (
                      <IconButton
                        size="small"
                        aria-label="Change photo"
                        disabled={busy}
                        onClick={photo.open}
                        sx={{ bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.light" }, width: 32, height: 32 }}
                      >
                        <PhotoCameraRounded sx={{ fontSize: 18 }} />
                      </IconButton>
                    )
                  }
                >
                  <Avatar member={m} size={96} />
                </Badge>
                <Typography variant="h2" sx={{ color: m.color }}>
                  {m.name}
                </Typography>
                {m.bio ? (
                  <Typography color="text.secondary" sx={{ whiteSpace: "pre-wrap", maxWidth: 520 }}>
                    {m.bio}
                  </Typography>
                ) : (
                  mine && (
                    <Button size="small" onClick={() => setEditing(true)}>
                      Add a short bio
                    </Button>
                  )
                )}
              </Stack>
            </Card>

            <Box>
              <Stack direction="row" sx={{ alignItems: "center", mb: 1, px: 0.5 }}>
                <Typography variant="h3" sx={{ flex: 1 }}>
                  {mine ? "My gear" : "Gear"}
                </Typography>
                {mine && list.length > 0 && (
                  <Button startIcon={<AddRounded />} onClick={() => setGear({ open: true })}>
                    Add
                  </Button>
                )}
              </Stack>
              {list.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<PianoRounded />}
                    title={mine ? "List your instruments" : "No gear listed yet"}
                    body={mine ? "Guitars, amps, pedals, processors… they'll be quick to pick when noting what you played on a track." : undefined}
                    action={
                      mine && (
                        <Button variant="contained" startIcon={<AddRounded />} onClick={() => setGear({ open: true })}>
                          Add instrument
                        </Button>
                      )
                    }
                  />
                </Card>
              ) : (
                <Card>
                  <List disablePadding>
                    {list.map((i, idx) => (
                      <GearRow
                        key={i.id}
                        i={i}
                        mine={mine}
                        divider={idx < list.length - 1}
                        onEdit={() => setGear({ open: true, existing: i })}
                        onDeleted={() => update({ instruments: list.filter((x) => x.id !== i.id) })}
                      />
                    ))}
                  </List>
                </Card>
              )}
            </Box>

            {mine && (
              <Button
                color="inherit"
                startIcon={<LogoutRounded />}
                sx={{ alignSelf: "center", color: "text.secondary" }}
                onClick={async () => {
                  await api("auth/logout", { body: {} });
                  window.location.href = "/login";
                }}
              >
                Log out
              </Button>
            )}
          </Stack>
        )}
      </Page>

      {m && mine && (
        <>
          <ProfileSheet open={editing} m={m} onClose={() => setEditing(false)} onSaved={update} />
          <GearSheet
            open={gear.open}
            existing={gear.existing}
            memberId={m.id}
            onClose={() => setGear({ open: false })}
            onSaved={(i, isNew) => update({ instruments: isNew ? [...list, i] : list.map((x) => (x.id === i.id ? i : x)) })}
          />
        </>
      )}
    </>
  );
}

function GearRow({ i, mine, divider, onEdit, onDeleted }: { i: Instrument; mine: boolean; divider: boolean; onEdit: () => void; onDeleted: () => void }) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const { confirm } = useDialogs();
  const toast = useToast();
  return (
    <ListItem
      divider={divider}
      secondaryAction={
        mine && (
          <IconButton edge="end" aria-label="Options" onClick={(e) => setMenu(e.currentTarget)}>
            <MoreVertRounded />
          </IconButton>
        )
      }
    >
      <ListItemIcon sx={{ fontSize: 24, minWidth: 44 }}>{KIND_EMOJI[i.kind] || "🎵"}</ListItemIcon>
      <ListItemText
        primary={i.name}
        secondary={
          <>
            {i.kind}
            {i.details && ` · ${i.details}`}
          </>
        }
        slotProps={{ primary: { sx: { fontWeight: 600 } }, secondary: { sx: { whiteSpace: "pre-wrap" } } }}
      />
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
        <MenuItem
          sx={{ color: "error.main" }}
          onClick={async () => {
            setMenu(null);
            if (!(await confirm({ title: `Remove ${i.name}?`, confirm: "Remove", danger: true }))) return;
            try {
              await api(`instruments/${i.id}`, { method: "DELETE" });
              onDeleted();
            } catch (e: any) {
              toast(e.message, "error");
            }
          }}
        >
          <ListItemIcon>
            <DeleteOutlineRounded fontSize="small" color="error" />
          </ListItemIcon>
          Remove
        </MenuItem>
      </Menu>
    </ListItem>
  );
}

function ProfileSheet({ open, m, onClose, onSaved }: { open: boolean; m: Member; onClose: () => void; onSaved: (p: Partial<Member>) => void }) {
  const toast = useToast();
  const [name, setName] = useState(m.name);
  const [bio, setBio] = useState(m.bio);
  const [color, setColor] = useState(m.color);
  const [busy, setBusy] = useState(false);
  const COLORS = ["#f59e0b", "#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#f87171", "#60a5fa", "#facc15"];

  useEffect(() => {
    if (!open) return;
    setName(m.name);
    setBio(m.bio);
    setColor(m.color);
  }, [open, m]);

  async function save() {
    setBusy(true);
    try {
      onSaved(await api<Member>(`members/${m.id}`, { method: "PATCH", body: { name, bio, color } }));
      toast("Profile saved");
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
      title="Edit profile"
      actions={
        <>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" disabled={busy || !name.trim()} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <Stack spacing={2.5} sx={{ pt: 1 }}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="About you" multiline minRows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What you play, influences, what you want from the band…" />
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Your colour
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {COLORS.map((c) => (
              <IconButton
                key={c}
                aria-label={`Colour ${c}`}
                onClick={() => setColor(c)}
                sx={{ width: 40, height: 40, bgcolor: c, border: 3, borderColor: color === c ? "text.primary" : "transparent", "&:hover": { bgcolor: c, opacity: 0.85 } }}
              />
            ))}
            <Box
              component="input"
              type="color"
              value={color}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(e.target.value)}
              aria-label="Custom colour"
              sx={{ width: 40, height: 40, p: 0, border: 0, bgcolor: "transparent", cursor: "pointer" }}
            />
          </Stack>
        </Box>
      </Stack>
    </Sheet>
  );
}

function GearSheet({
  open,
  existing,
  memberId,
  onClose,
  onSaved,
}: {
  open: boolean;
  existing?: Instrument;
  memberId: number;
  onClose: () => void;
  onSaved: (i: Instrument, isNew: boolean) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("Guitar");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name || "");
    setKind(existing?.kind || "Guitar");
    setDetails(existing?.details || "");
  }, [open, existing]);

  async function save() {
    setBusy(true);
    try {
      const body = { name, kind, details };
      const r = existing
        ? await api<Instrument>(`instruments/${existing.id}`, { method: "PATCH", body })
        : await api<Instrument>(`members/${memberId}/instruments`, { body });
      onSaved(r, !existing);
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
          <Button variant="contained" disabled={busy || !name.trim()} onClick={save}>
            {existing ? "Save" : "Add"}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <TextField label="Name / model" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fender Player Strat" />
        <TextField select label="Type" value={kind} onChange={(e) => setKind(e.target.value)}>
          {INSTRUMENT_KINDS.map((k) => (
            <MenuItem key={k} value={k}>
              {KIND_EMOJI[k]} {k}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Details (optional)" multiline minRows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Strings, tuning, pickups, firmware…" />
      </Stack>
    </Sheet>
  );
}
