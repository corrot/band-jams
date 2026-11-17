"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, fmtDate, fmtTime } from "@/lib/client";
import { LINK_LABELS, STATUSES, type TrackLink, type TrackSummary } from "@/lib/types";

export function Links({ trackId, links, setLinks }: { trackId: number; links: TrackLink[]; setLinks: (l: TrackLink[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [all, setAll] = useState<TrackSummary[] | null>(null);
  const [other, setOther] = useState("");
  const [label, setLabel] = useState(LINK_LABELS[0]);
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (adding && !all) api<TrackSummary[]>("tracks").then(setAll).catch((e) => setErr(e.message));
  }, [adding, all]);

  const linked = new Set(links.map((l) => l.other.id));
  const options = (all || []).filter((t) => t.id !== trackId && !linked.has(t.id));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!other) return;
    setErr("");
    try {
      const lbl = label === "Custom…" ? custom.trim() || "Related" : label;
      const r = await api(`tracks/${trackId}/links`, { body: { other_id: Number(other), label: lbl } });
      const o = all!.find((t) => t.id === Number(other))!;
      setLinks([
        ...links,
        { id: r.id, label: r.label, other: { id: o.id, title: o.title, duration_sec: o.duration_sec, status: o.status, recorded_at: o.recorded_at } },
      ]);
      setOther("");
      setAdding(false);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function remove(id: number) {
    try {
      await api(`links/${id}`, { method: "DELETE" });
      setLinks(links.filter((l) => l.id !== id));
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="panel">
      <div className="spread" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Connected tracks</h2>
        <button className="btn sm" onClick={() => setAdding((a) => !a)}>
          {adding ? "Cancel" : "+ Connect"}
        </button>
      </div>
      {adding && (
        <form onSubmit={add} className="stack tight" style={{ marginBottom: 10 }}>
          <select value={other} onChange={(e) => setOther(e.target.value)}>
            <option value="">{all ? "Choose a track…" : "Loading tracks…"}</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} · {fmtDate(t.recorded_at || t.created_at)}
              </option>
            ))}
          </select>
          <div className="row">
            <select value={label} onChange={(e) => setLabel(e.target.value)}>
              {[...LINK_LABELS, "Custom…"].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            {label === "Custom…" && <input placeholder="Relationship" value={custom} onChange={(e) => setCustom(e.target.value)} />}
            <button className="btn primary sm" disabled={!other}>
              Connect
            </button>
          </div>
        </form>
      )}
      {links.length === 0 && !adding && <p className="muted small">Link takes of the same song, variations or parts that belong together.</p>}
      {links.map((l) => (
        <div className="linkrow" key={l.id}>
          <span className="chip">{l.label}</span>
          <Link href={`/tracks/${l.other.id}`} className="grow" style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {l.other.title}
          </Link>
          <span className="tiny muted">{fmtTime(l.other.duration_sec)}</span>
          <span className={`status ${l.other.status}`}>{STATUSES.find((s) => s.value === l.other.status)?.label}</span>
          <button className="btn ghost sm" title="Disconnect" onClick={() => remove(l.id)}>
            ✕
          </button>
        </div>
      ))}
      {err && <p className="err">{err}</p>}
    </div>
  );
}
