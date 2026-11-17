"use client";

import { useRef, useState } from "react";
import { api, uploadFile } from "@/lib/client";
import type { TrackInstrument, TrackInstrumentImage } from "@/lib/types";
import { Avatar, MemberName, useBand } from "./Band";
import { Lightbox } from "./Lightbox";

export function TrackInstruments({
  trackId,
  items,
  setItems,
}: {
  trackId: number;
  items: TrackInstrument[];
  setItems: (fn: (x: TrackInstrument[]) => TrackInstrument[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="panel">
      <div className="spread" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Instruments & settings</h2>
        <button className="btn sm" onClick={() => setAdding((a) => !a)}>
          {adding ? "Cancel" : "+ Add"}
        </button>
      </div>
      <div className="stack">
        {adding && (
          <InstrumentForm
            trackId={trackId}
            onDone={(ti) => {
              if (ti) setItems((xs) => [...xs, ti]);
              setAdding(false);
            }}
          />
        )}
        {items.length === 0 && !adding && (
          <p className="muted small">Who played what, plus amp/pedal/processor settings. Add photos of a processor screen to save a patch.</p>
        )}
        {items.map((ti) => (
          <InstrumentCard key={ti.id} ti={ti} setItems={setItems} />
        ))}
      </div>
    </div>
  );
}

function InstrumentForm({
  trackId,
  existing,
  onDone,
}: {
  trackId: number;
  existing?: TrackInstrument;
  onDone: (ti: TrackInstrument | null) => void;
}) {
  const { members, me } = useBand();
  const [memberId, setMemberId] = useState<string>(String(existing?.member_id ?? me?.id ?? ""));
  const [instrumentId, setInstrumentId] = useState<string>(existing?.instrument_id ? String(existing.instrument_id) : "");
  const [name, setName] = useState(existing?.name ?? "");
  const [settings, setSettings] = useState(existing?.settings ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const member = members.find((m) => String(m.id) === memberId);
  const inv = member?.instruments || [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
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
        onDone({ ...existing, ...r, images: existing.images });
      } else {
        onDone(await api<TrackInstrument>(`tracks/${trackId}/instruments`, { body }));
      }
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <form className="inst" onSubmit={submit}>
      <div className="grid2">
        <label className="field">
          Played by
          <select
            value={memberId}
            onChange={(e) => {
              setMemberId(e.target.value);
              setInstrumentId("");
            }}
          >
            <option value="">Nobody / shared</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        {!existing && (
          <label className="field">
            From their gear
            <select
              value={instrumentId}
              onChange={(e) => {
                setInstrumentId(e.target.value);
                const i = inv.find((x) => String(x.id) === e.target.value);
                if (i) setName(i.name);
              }}
            >
              <option value="">{inv.length ? "Pick an instrument…" : "No gear in profile yet"}</option>
              {inv.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.kind})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="field">
        Instrument / device
        <input placeholder="e.g. Strat → Boss GT-1000" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        Settings (optional)
        <textarea
          placeholder={"Patch: U12-3 Crunch\nGain 6 · Bass 4 · Mid 7 · Treble 5\nDelay 380ms, 25% mix"}
          value={settings}
          onChange={(e) => setSettings(e.target.value)}
          style={{ fontFamily: "var(--mono)", fontSize: 13 }}
        />
      </label>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn ghost sm" onClick={() => onDone(null)}>
          Cancel
        </button>
        <button className="btn primary sm" disabled={busy || (!name.trim() && !instrumentId)}>
          {existing ? "Save" : "Add"}
        </button>
      </div>
      {err && <p className="err">{err}</p>}
    </form>
  );
}

function InstrumentCard({ ti, setItems }: { ti: TrackInstrument; setItems: (fn: (x: TrackInstrument[]) => TrackInstrument[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const setImages = (fn: (i: TrackInstrumentImage[]) => TrackInstrumentImage[]) =>
    setItems((xs) => xs.map((x) => (x.id === ti.id ? { ...x, images: fn(x.images) } : x)));

  async function addImages(files: FileList) {
    setErr("");
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(f.name));
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      setUploading(`Uploading ${i + 1}/${list.length}…`);
      try {
        const { url } = await uploadFile("images", f, f.name);
        const img = await api<TrackInstrumentImage>(`track-instruments/${ti.id}/images`, { body: { url, caption: "" } });
        setImages((imgs) => [...imgs, img]);
      } catch (e: any) {
        setErr(e.message);
      }
    }
    setUploading(null);
  }

  async function caption(img: TrackInstrumentImage) {
    const c = window.prompt("Caption for this photo", img.caption);
    if (c === null) return;
    const r = await api<TrackInstrumentImage>(`images/${img.id}`, { method: "PATCH", body: { caption: c } });
    setImages((imgs) => imgs.map((i) => (i.id === img.id ? r : i)));
  }

  async function removeImage(img: TrackInstrumentImage) {
    if (!window.confirm("Delete this photo?")) return;
    await api(`images/${img.id}`, { method: "DELETE" });
    setImages((imgs) => imgs.filter((i) => i.id !== img.id));
  }

  async function remove() {
    if (!window.confirm(`Remove ${ti.name} from this track${ti.images.length ? " along with its photos" : ""}?`)) return;
    await api(`track-instruments/${ti.id}`, { method: "DELETE" });
    setItems((xs) => xs.filter((x) => x.id !== ti.id));
  }

  if (editing)
    return (
      <InstrumentForm
        trackId={ti.track_id}
        existing={ti}
        onDone={(r) => {
          if (r) setItems((xs) => xs.map((x) => (x.id === ti.id ? r : x)));
          setEditing(false);
        }}
      />
    );

  return (
    <div className="inst">
      <div className="spread">
        <div className="row" style={{ minWidth: 0 }}>
          {ti.member_id && <Avatar id={ti.member_id} size={24} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{ti.name}</div>
            <div className="tiny muted">{ti.member_id ? <MemberName id={ti.member_id} /> : "Shared"}</div>
          </div>
        </div>
        <div className="row">
          <button className="btn ghost sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="btn ghost sm danger" onClick={remove}>
            Remove
          </button>
        </div>
      </div>
      {ti.settings && <div className="settings">{ti.settings}</div>}
      <div className="thumbs">
        {ti.images.map((img, i) => (
          <div className="thumb" key={img.id} onClick={() => setLightbox(i)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.caption} loading="lazy" />
            {img.caption && <div className="cap">{img.caption}</div>}
            <div style={{ position: "absolute", top: 2, right: 2, display: "flex", gap: 2 }} onClick={(e) => e.stopPropagation()}>
              <button className="btn sm" style={{ padding: "0 5px" }} title="Caption" onClick={() => caption(img)}>
                ✎
              </button>
              <button className="btn sm danger" style={{ padding: "0 5px" }} title="Delete" onClick={() => removeImage(img)}>
                ✕
              </button>
            </div>
          </div>
        ))}
        <div className="addthumb" title="Add photos of settings" onClick={() => input.current?.click()}>
          {uploading ? <span className="tiny">{uploading}</span> : "+"}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) addImages(e.target.files);
          e.target.value = "";
        }}
      />
      {err && <p className="err">{err}</p>}
      {lightbox !== null && <Lightbox images={ti.images} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
