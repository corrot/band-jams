"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import { api } from "@/lib/client";
import { Avatar } from "@/components/Band";

type M = { id: number; name: string; color: string; avatar_url: string | null };

export default function LoginPage() {
  const [stage, setStage] = useState<"loading" | "password" | "pick">("loading");
  const [members, setMembers] = useState<M[]>([]);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("auth/state")
      .then((s) => {
        if (s.stage === "in") window.location.href = "/";
        else {
          setStage(s.stage);
          setMembers(s.members || []);
        }
      })
      .catch(() => setStage("password"));
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await api("auth/login", { body: { password } });
      setMembers(r.members);
      setStage("pick");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function pick(body: { memberId?: number; name?: string }) {
    setErr("");
    setBusy(true);
    try {
      await api("auth/select", { body });
      window.location.href = body.name ? "/members/me" : "/";
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        px: 2,
        py: "max(24px, env(safe-area-inset-top))",
        background: "radial-gradient(1200px 500px at 50% -10%, rgba(245,165,36,.14), transparent 60%)",
      }}
    >
      <Stack spacing={3} sx={{ width: "100%", maxWidth: 400 }}>
        <Stack spacing={1.5} sx={{ alignItems: "center" }}>
          <Box component="img" src="/icon.svg" alt="" sx={{ width: 64, height: 64, borderRadius: 4, boxShadow: "0 8px 40px rgba(245,165,36,.25)" }} />
          <Typography variant="h1">Band Jams</Typography>
          <Typography color="text.secondary" sx={{ textAlign: "center" }}>
            {stage === "pick" ? "Who's listening?" : "Listen, vote and pick what to play next."}
          </Typography>
        </Stack>

        <Card sx={{ p: 2.5, borderRadius: 4 }}>
          {stage === "loading" && (
            <Stack sx={{ alignItems: "center", py: 3 }}>
              <CircularProgress size={28} />
            </Stack>
          )}

          {stage === "password" && (
            <Stack component="form" onSubmit={login} spacing={2}>
              <TextField
                autoFocus
                label="Band password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)} edge="end">
                          {show ? <VisibilityOffRounded /> : <VisibilityRounded />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button type="submit" variant="contained" size="large" disabled={busy || !password}>
                {busy ? <CircularProgress size={22} color="inherit" /> : "Continue"}
              </Button>
            </Stack>
          )}

          {stage === "pick" && (
            <Stack spacing={2}>
              {members.length > 0 && (
                <List disablePadding sx={{ mx: -1 }}>
                  {members.map((m) => (
                    <ListItemButton key={m.id} disabled={busy} onClick={() => pick({ memberId: m.id })} sx={{ py: 1 }}>
                      <ListItemAvatar>
                        <Avatar member={m} size={40} />
                      </ListItemAvatar>
                      <ListItemText primary={m.name} slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
                      <ChevronRightRounded color="disabled" />
                    </ListItemButton>
                  ))}
                </List>
              )}
              {members.length > 0 && <Divider>or join as someone new</Divider>}
              <Stack
                component="form"
                direction="row"
                spacing={1}
                onSubmit={(e) => {
                  e.preventDefault();
                  pick({ name });
                }}
              >
                <TextField size="small" label="Your name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={members.length === 0} />
                <Button type="submit" variant="contained" disabled={busy || !name.trim()}>
                  Join
                </Button>
              </Stack>
            </Stack>
          )}

          {err && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {err}
            </Alert>
          )}
        </Card>
      </Stack>
    </Box>
  );
}
