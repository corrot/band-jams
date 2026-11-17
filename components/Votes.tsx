"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { VOTE_OPTIONS, type Vote } from "@/lib/types";
import { Avatar, useBand } from "./Band";

export function Votes({
  trackId,
  votes,
  score,
  onChange,
  showVoters = true,
}: {
  trackId: number;
  votes: Vote[];
  score: number;
  onChange: (v: { votes: Vote[]; score: number }) => void;
  showVoters?: boolean;
}) {
  const { me, byId } = useBand();
  const [busy, setBusy] = useState(false);
  const mine = votes.find((v) => v.member_id === me?.id)?.value ?? 0;

  async function cast(value: number) {
    if (!me || busy) return;
    const next = mine === value ? 0 : value;
    const prev = { votes, score };
    const optimistic = votes.filter((v) => v.member_id !== me.id);
    if (next) optimistic.push({ member_id: me.id, value: next });
    onChange({ votes: optimistic, score: optimistic.reduce((s, v) => s + v.value, 0) });
    setBusy(true);
    try {
      const r = await api<{ votes: Vote[]; score: number }>(`tracks/${trackId}/vote`, { method: "PUT", body: { value: next } });
      onChange(r);
    } catch {
      onChange(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="votebar">
      <span className={`score ${score > 0 ? "pos" : score < 0 ? "neg" : ""}`} title="Score: 👍 +1, 🔥 +2, 👎 −1">
        {score > 0 ? `+${score}` : score}
      </span>
      {VOTE_OPTIONS.map((o) => {
        const n = votes.filter((v) => v.value === o.value).length;
        const who = votes
          .filter((v) => v.value === o.value)
          .map((v) => byId[v.member_id]?.name || "Someone")
          .join(", ");
        return (
          <button
            key={o.value}
            className={`vote ${mine === o.value ? "on" : ""}`}
            title={`${o.label}${who ? ` — ${who}` : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              cast(o.value);
            }}
          >
            {o.emoji}
            {n > 0 && <span className="n">{n}</span>}
          </button>
        );
      })}
      {showVoters && votes.length > 0 && (
        <span className="voters">
          {votes.map((v) => (
            <Avatar key={v.member_id} id={v.member_id} size={18} />
          ))}
        </span>
      )}
    </div>
  );
}
