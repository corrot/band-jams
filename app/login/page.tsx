"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type M = { id: number; name: string; color: string; avatar_url: string | null };

export default function LoginPage() {
  const [stage, setStage] = useState<"loading" | "password" | "pick">("loading");
  const [members, setMembers] = useState<M[]>([]);
  const [password, setPassword] = useState("");
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
    <div className="login">
      <div className="box panel">
        <div className="brand" style={{ fontSize: 24 }}>
          <span className="dot" /> Band Jams
        </div>
        {stage === "loading" && <p className="muted">Loading…</p>}
        {stage === "password" && (
          <form onSubmit={login} className="stack">
            <p className="muted">Enter the band password to get in.</p>
            <input type="password" autoFocus placeholder="Band password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn primary" disabled={busy || !password}>
              Continue
            </button>
          </form>
        )}
        {stage === "pick" && (
          <div className="stack">
            {members.length > 0 && (
              <>
                <p className="muted">Who are you?</p>
                <div className="pick">
                  {members.map((m) => (
                    <button key={m.id} disabled={busy} onClick={() => pick({ memberId: m.id })}>
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="avatar" src={m.avatar_url} alt="" style={{ width: 32, height: 32 }} />
                      ) : (
                        <span className="avatar" style={{ width: 32, height: 32, background: m.color }}>
                          {m.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span style={{ fontWeight: 600 }}>{m.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <form
              className="stack tight"
              onSubmit={(e) => {
                e.preventDefault();
                pick({ name });
              }}
            >
              <p className="muted">{members.length ? "New here? Create your profile." : "Create your profile to start."}</p>
              <div className="row">
                <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                <button className="btn primary" disabled={busy || !name.trim()}>
                  Join
                </button>
              </div>
            </form>
          </div>
        )}
        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}
