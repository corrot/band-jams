"use client";

import { useState } from "react";
import { AvatarGroup, Box, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { api } from "@/lib/client";
import { VOTE_OPTIONS, type Vote } from "@/lib/types";
import { Avatar, useBand } from "./Band";
import { useToast } from "./ui";

export function Score({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  return (
    <Typography
      component="span"
      sx={{
        fontFamily: "ui-monospace, Menlo, monospace",
        fontWeight: 700,
        fontSize: size === "sm" ? 15 : 20,
        minWidth: size === "sm" ? 28 : 36,
        textAlign: "right",
        color: score > 0 ? "primary.main" : score < 0 ? "error.main" : "text.secondary",
      }}
      title="Score: 👍 +1, 🔥 +2, 👎 −1"
    >
      {score > 0 ? `+${score}` : score}
    </Typography>
  );
}

export function Votes({
  trackId,
  votes,
  score,
  onChange,
  showVoters = true,
  dense,
}: {
  trackId: number;
  votes: Vote[];
  score: number;
  onChange: (v: { votes: Vote[]; score: number }) => void;
  showVoters?: boolean;
  dense?: boolean;
}) {
  const { me, byId } = useBand();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const mine = votes.find((v) => v.member_id === me?.id)?.value ?? 0;

  async function cast(next: number) {
    if (!me || busy) return;
    const prev = { votes, score };
    const optimistic = votes.filter((v) => v.member_id !== me.id);
    if (next) optimistic.push({ member_id: me.id, value: next });
    onChange({ votes: optimistic, score: optimistic.reduce((s, v) => s + v.value, 0) });
    if (navigator.vibrate) navigator.vibrate(8);
    setBusy(true);
    try {
      onChange(await api<{ votes: Vote[]; score: number }>(`tracks/${trackId}/vote`, { method: "PUT", body: { value: next } }));
    } catch (e: any) {
      onChange(prev);
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()} sx={{ alignItems: "center" }}>
      <Score score={score} size={dense ? "sm" : "md"} />
      <ToggleButtonGroup
        exclusive
        size="small"
        value={mine || null}
        onChange={(_, v) => cast(v ?? 0)}
        aria-label="Your vote"
        sx={{ "& .MuiToggleButton-root": { px: dense ? 1 : 1.25, py: 0.4, gap: 0.5, fontSize: 15, lineHeight: 1.3 } }}
      >
        {VOTE_OPTIONS.map((o) => {
          const voters = votes.filter((v) => v.value === o.value);
          const who = voters.map((v) => byId[v.member_id]?.name || "Someone").join(", ");
          return (
            <ToggleButton
              key={o.value}
              value={o.value}
              aria-label={o.label}
              sx={{ "&.Mui-selected": { bgcolor: "rgba(245,165,36,.18)", borderColor: "primary.main" } }}
            >
              <Tooltip title={`${o.label}${who ? ` — ${who}` : ""}`}>
                <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  {o.emoji}
                  {voters.length > 0 && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                      {voters.length}
                    </Typography>
                  )}
                </Box>
              </Tooltip>
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
      {showVoters && votes.length > 0 && (
        <AvatarGroup max={4} sx={{ "& .MuiAvatar-root": { width: 22, height: 22, fontSize: 10, borderColor: "background.paper" } }}>
          {votes.map((v) => (
            <Avatar key={v.member_id} id={v.member_id} size={22} />
          ))}
        </AvatarGroup>
      )}
    </Stack>
  );
}
