"use client";

import Link from "next/link";
import { Avatar, useBand } from "@/components/Band";

export default function MembersPage() {
  const { members, me } = useBand();
  return (
    <div className="page">
      <div className="spread">
        <div>
          <h1>The band</h1>
          <p className="muted small">
            {members.length} member{members.length === 1 ? "" : "s"}. New people join with the band password from the login page.
          </p>
        </div>
        {me && (
          <Link href={`/members/${me.id}`} className="btn">
            Edit my profile
          </Link>
        )}
      </div>
      <div className="members">
        {members.map((m) => (
          <Link key={m.id} href={`/members/${m.id}`} className="panel member-card" style={{ color: "inherit" }}>
            <div className="row">
              <Avatar member={m} size={48} />
              <div>
                <h2 style={{ margin: 0, color: m.color }}>{m.name}</h2>
                <div className="tiny muted">{m.instruments?.length || 0} instruments</div>
              </div>
            </div>
            {m.bio && <p className="small muted" style={{ whiteSpace: "pre-wrap" }}>{m.bio.length > 160 ? m.bio.slice(0, 160) + "…" : m.bio}</p>}
            {!!m.instruments?.length && (
              <div className="row wrapy">
                {m.instruments.slice(0, 8).map((i) => (
                  <span key={i.id} className="chip">
                    {i.name}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
