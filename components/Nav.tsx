"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, useBand } from "./Band";
import { api } from "@/lib/client";

export function Nav() {
  const path = usePathname() || "/";
  const { me } = useBand();
  if (path.startsWith("/login")) return null;
  const is = (p: string) => (p === "/" ? path === "/" || path.startsWith("/tracks") : path.startsWith(p));
  return (
    <header className="nav">
      <div className="wrap">
        <Link href="/" className="brand">
          <span className="dot" /> Band Jams
        </Link>
        <nav className="links">
          <Link href="/" className={is("/") ? "active" : ""}>
            Tracks
          </Link>
          <Link href="/members" className={is("/members") ? "active" : ""}>
            Band
          </Link>
        </nav>
        <div className="me">
          {me && (
            <Link href={`/members/${me.id}`} className="row" title="Your profile">
              <Avatar member={me} size={30} />
            </Link>
          )}
          <button
            className="btn ghost sm"
            onClick={async () => {
              await api("auth/logout", { body: {} });
              window.location.href = "/login";
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
