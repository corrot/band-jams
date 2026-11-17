"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, uploadFile } from "@/lib/client";
import { INSTRUMENT_KINDS, type Instrument, type Member } from "@/lib/types";
import { Avatar, useBand } from "@/components/Band";

export default function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = use(params);
  const { me, refresh } = useBand();
  const id = raw === "me" ? me?.id : Number(raw);
  const [m, setM] = useState<Member | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) return;
    api<Member>(`members/${id}`)
      .then(setM)
      .catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <div className="page"><p className="err">{err}</p></div>;
  if (!m) return <div className="page"><p className="muted">Loading…</p></div>;
  const mine = me?.id === m.id;

  const update = (p: Partial<Member>) => {
    setM((x) => (x ? { ...x, ...p } : x));
    refresh();
  };

  return (
    <div className="page">
      <Link href="/members" className="small muted">
        ← The band
      </Link>
      {mine ? <EditProfile m={m} onSaved={update} /> : <ViewProfile m={m} />}
      <Gear m={m} mine={mine} setInstruments={(instruments) => update({ instruments })} />
    </div>
  );
}

function ViewProfile({ m }: { m: Member }) {
  return (
    <div className="panel row" style={{ alignItems: "flex-start", gap: 16 }}>
      <Avatar member={m} size={72} />
      <div className="stack tight">
        <h1 style={{ color: m.color }}>{m.name}</h1>
        {m.bio ? <p style={{ whiteSpace: "pre-wrap" }}>{m.bio}</p> : <p className="muted">No bio yet.</p>}
      </div>
    </div>
  );
}

function EditProfile({ m, onSaved }: { m: Member; onSaved: (p: Partial<Member>) => void }) {
  const [name, setName] = useState(m.name);
  const [bio, setBio] = useState(m.bio);
  const [color, setColor] = useState(m.color);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);

  async function save(p: Partial<Member>) {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const r = await api<Member>(`members/${m.id}`, { method: "PATCH", body: p });
      onSaved(r);
      setMsg("Saved");
      setTimeout(() => setMsg(""), 2000);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function avatar(f: File) {
    setBusy(true);
    try {
      const { url } = await uploadFile("avatars", f, f.name);
      await save({ avatar_url: url });
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <form
      className="panel stack"
      onSubmit={(e) => {
        e.preventDefault();
        save({ name, bio, color });
      }}
    >
      <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
        <div className="stack tight" style={{ justifyItems: "center" }}>
          <Avatar member={{ ...m, color }} size={72} />
          <button type="button" className="btn sm" disabled={busy} onClick={() => file.current?.click()}>
            Photo
          </button>
          {m.avatar_url && (
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => save({ avatar_url: null })}>
              Remove
            </button>
          )}
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) avatar(f);
              e.target.value = "";
            }}
          />
        </div>
        <div className="stack grow">
          <h1>Your profile</h1>
          <div className="row">
            <label className="field grow">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field" style={{ width: 70 }}>
              Colour
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ padding: 2, height: 38 }} />
            </label>
          </div>
          <label className="field">
            About you
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What you play, influences, what you want from the band…" />
          </label>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            {msg && <span className="small" style={{ color: "var(--ok)" }}>{msg}</span>}
            {err && <span className="err">{err}</span>}
            <button className="btn primary" disabled={busy}>
              Save profile
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Gear({ m, mine, setInstruments }: { m: Member; mine: boolean; setInstruments: (i: Instrument[]) => void }) {
  const list = m.instruments || [];
  const [adding, setAdding] = useState(false);
  return (
    <div className="panel">
      <div className="spread" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>{mine ? "My instruments & gear" : "Instruments & gear"}</h2>
        {mine && (
          <button className="btn sm" onClick={() => setAdding((a) => !a)}>
            {adding ? "Cancel" : "+ Add instrument"}
          </button>
        )}
      </div>
      <div className="stack">
        {adding && (
          <InstrumentEditor
            memberId={m.id}
            onDone={(i) => {
              if (i) setInstruments([...list, i]);
              setAdding(false);
            }}
          />
        )}
        {list.length === 0 && !adding && <p className="muted small">{mine ? "Add the guitars, amps, pedals and other gear you use." : "Nothing listed yet."}</p>}
        {list.map((i) => (
          <InstrumentRow
            key={i.id}
            i={i}
            mine={mine}
            onChange={(n) => setInstruments(n ? list.map((x) => (x.id === i.id ? n : x)) : list.filter((x) => x.id !== i.id))}
          />
        ))}
      </div>
    </div>
  );
}

function InstrumentRow({ i, mine, onChange }: { i: Instrument; mine: boolean; onChange: (n: Instrument | null) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <InstrumentEditor
        memberId={i.member_id}
        existing={i}
        onDone={(n) => {
          if (n) onChange(n);
          setEditing(false);
        }}
      />
    );
  return (
    <div className="inst">
      <div className="spread">
        <div className="row">
          <span className="chip">{i.kind}</span>
          <b>{i.name}</b>
        </div>
        {mine && (
          <div className="row">
            <button className="btn ghost sm" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              className="btn ghost sm danger"
              onClick={async () => {
                if (!window.confirm(`Remove ${i.name}?`)) return;
                await api(`instruments/${i.id}`, { method: "DELETE" });
                onChange(null);
              }}
            >
              Remove
            </button>
          </div>
        )}
      </div>
      {i.details && <p className="small muted" style={{ whiteSpace: "pre-wrap" }}>{i.details}</p>}
    </div>
  );
}

function InstrumentEditor({ memberId, existing, onDone }: { memberId: number; existing?: Instrument; onDone: (i: Instrument | null) => void }) {
  const [name, setName] = useState(existing?.name || "");
  const [kind, setKind] = useState(existing?.kind || "Guitar");
  const [details, setDetails] = useState(existing?.details || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { name, kind, details };
      onDone(
        existing
          ? await api<Instrument>(`instruments/${existing.id}`, { method: "PATCH", body })
          : await api<Instrument>(`members/${memberId}/instruments`, { body }),
      );
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }
  return (
    <form className="inst" onSubmit={submit}>
      <div className="grid2">
        <label className="field">
          Name / model
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fender Player Strat" />
        </label>
        <label className="field">
          Type
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {INSTRUMENT_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        Details (optional)
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Strings, tuning, pickups, firmware…" />
      </label>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn ghost sm" onClick={() => onDone(null)}>
          Cancel
        </button>
        <button className="btn primary sm" disabled={busy || !name.trim()}>
          {existing ? "Save" : "Add"}
        </button>
      </div>
      {err && <p className="err">{err}</p>}
    </form>
  );
}
