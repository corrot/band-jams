"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import AddLinkRounded from "@mui/icons-material/AddLinkRounded";
import LinkOffRounded from "@mui/icons-material/LinkOffRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import { api, fmtDate, fmtTime } from "@/lib/client";
import { LINK_LABELS, type TrackLink, type TrackSummary } from "@/lib/types";
import { StatusChip } from "./StatusChip";
import { EmptyState, Sheet, useDialogs, useToast } from "./ui";

export function Links({ trackId, links, setLinks }: { trackId: number; links: TrackLink[]; setLinks: (l: TrackLink[]) => void }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useDialogs();
  const [open, setOpen] = useState(false);

  async function remove(l: TrackLink) {
    if (!(await confirm({ title: "Disconnect tracks?", body: `“${l.other.title}” will no longer be linked.`, confirm: "Disconnect", danger: true }))) return;
    try {
      await api(`links/${l.id}`, { method: "DELETE" });
      setLinks(links.filter((x) => x.id !== l.id));
    } catch (e: any) {
      toast(e.message, "error");
    }
  }

  return (
    <Box>
      {links.length === 0 ? (
        <EmptyState
          icon={<LinkRounded />}
          title="No connected tracks"
          body="Link takes of the same song, variations, or parts that belong together."
          action={
            <Button variant="contained" startIcon={<AddLinkRounded />} onClick={() => setOpen(true)}>
              Connect a track
            </Button>
          }
        />
      ) : (
        <>
          <List disablePadding>
            {links.map((l) => (
              <ListItem
                key={l.id}
                disablePadding
                secondaryAction={
                  <IconButton edge="end" aria-label="Disconnect" onClick={() => remove(l)}>
                    <LinkOffRounded fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemButton onClick={() => router.push(`/tracks/${l.other.id}`)} sx={{ pr: 7 }}>
                  <ListItemText
                    primary={l.other.title}
                    secondary={
                      <Stack direction="row" spacing={1} component="span" sx={{ alignItems: "center", mt: 0.5 }}>
                        <Chip label={l.label} size="small" sx={{ height: 22 }} component="span" />
                        <span>{fmtTime(l.other.duration_sec)}</span>
                        <StatusChip status={l.other.status} />
                      </Stack>
                    }
                    slotProps={{ primary: { noWrap: true, sx: { fontWeight: 600 } }, secondary: { component: "div" } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Button startIcon={<AddLinkRounded />} onClick={() => setOpen(true)} sx={{ mt: 1 }}>
            Connect another track
          </Button>
        </>
      )}
      <LinkSheet
        open={open}
        onClose={() => setOpen(false)}
        trackId={trackId}
        exclude={new Set([trackId, ...links.map((l) => l.other.id)])}
        onCreated={(l) => setLinks([...links, l])}
      />
    </Box>
  );
}

function LinkSheet({
  open,
  onClose,
  trackId,
  exclude,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  trackId: number;
  exclude: Set<number>;
  onCreated: (l: TrackLink) => void;
}) {
  const toast = useToast();
  const [all, setAll] = useState<TrackSummary[] | null>(null);
  const [other, setOther] = useState<TrackSummary | null>(null);
  const [label, setLabel] = useState(LINK_LABELS[0]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && !all) api<TrackSummary[]>("tracks").then(setAll).catch((e) => toast(e.message, "error"));
  }, [open, all, toast]);

  async function save() {
    if (!other) return;
    setBusy(true);
    try {
      const lbl = label === "Custom…" ? custom.trim() || "Related" : label;
      const r = await api(`tracks/${trackId}/links`, { body: { other_id: other.id, label: lbl } });
      onCreated({
        id: r.id,
        label: r.label,
        other: { id: other.id, title: other.title, duration_sec: other.duration_sec, status: other.status, recorded_at: other.recorded_at },
      });
      setOther(null);
      toast("Tracks connected");
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
      title="Connect a track"
      actions={
        <>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" disabled={!other || busy} onClick={save}>
            Connect
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Autocomplete
          options={(all || []).filter((t) => !exclude.has(t.id))}
          loading={!all}
          value={other}
          onChange={(_, v) => setOther(v)}
          getOptionLabel={(t) => t.title}
          renderOption={(props, t) => {
            const { key, ...rest } = props as any;
            return (
              <li key={key} {...rest}>
                <ListItemText
                  primary={t.title}
                  secondary={`${fmtDate(t.recorded_at || t.created_at)} · ${fmtTime(t.duration_sec)}`}
                />
              </li>
            );
          }}
          renderInput={(p) => <TextField {...p} label="Track" placeholder="Search by title" />}
        />
        <TextField select label="Relationship" value={label} onChange={(e) => setLabel(e.target.value)}>
          {[...LINK_LABELS, "Custom…"].map((l) => (
            <MenuItem key={l} value={l}>
              {l}
            </MenuItem>
          ))}
        </TextField>
        {label === "Custom…" && <TextField label="Custom relationship" value={custom} onChange={(e) => setCustom(e.target.value)} />}
      </Stack>
    </Sheet>
  );
}
