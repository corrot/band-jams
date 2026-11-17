"use client";

import { upload } from "@vercel/blob/client";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("auth/")) {
    window.location.href = "/login";
  }
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  return data as T;
}

const EXT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  webm: "audio/webm",
  mp4: "video/mp4",
  mov: "video/quicktime",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  amr: "audio/amr",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

export function guessType(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return EXT_TYPES[ext] || "application/octet-stream";
}

export async function uploadFile(
  folder: "tracks" | "comments" | "images" | "avatars",
  file: File | Blob,
  name: string,
  onProgress?: (pct: number) => void,
) {
  const safe = name.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "-").slice(-120) || "file";
  const contentType = file instanceof File ? guessType(file) : file.type || "application/octet-stream";
  const res = await upload(`${folder}/${safe}`, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    contentType,
    multipart: file.size > 20 * 1024 * 1024,
    onUploadProgress: onProgress ? (e) => onProgress(e.percentage) : undefined,
  });
  return { url: res.url, contentType };
}

/** Duration via a media element: cheap, works for long files. */
export function probeDuration(src: File | Blob | string): Promise<number | null> {
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    const done = (v: number | null) => {
      if (typeof src !== "string") URL.revokeObjectURL(url);
      a.removeAttribute("src");
      resolve(v);
    };
    const timer = setTimeout(() => done(null), 15000);
    a.onloadedmetadata = () => {
      if (a.duration === Infinity) {
        // Some webm/ogg files report Infinity until seeked to the end.
        a.currentTime = 1e9;
        a.ontimeupdate = () => {
          a.ontimeupdate = null;
          clearTimeout(timer);
          done(Number.isFinite(a.duration) ? a.duration : null);
        };
        return;
      }
      clearTimeout(timer);
      done(Number.isFinite(a.duration) ? a.duration : null);
    };
    a.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    a.src = url;
  });
}

/**
 * Waveform peaks, decoded at a very low sample rate to keep memory small even
 * for hour-long jams. Returns ~`points` values between 0 and 1.
 */
export async function computePeaks(file: Blob, points = 1200): Promise<{ peaks: number[]; duration: number } | null> {
  if (file.size > 600 * 1024 * 1024) return null;
  try {
    const buf = await file.arrayBuffer();
    const Ctx = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx(1, 1, 3000);
    const audio: AudioBuffer = await new Promise((res, rej) => {
      const p = ctx.decodeAudioData(buf, res, rej);
      if (p && typeof p.then === "function") p.then(res, rej);
    });
    const ch = audio.numberOfChannels;
    const len = audio.length;
    const step = Math.max(1, Math.floor(len / points));
    const data = Array.from({ length: ch }, (_, i) => audio.getChannelData(i));
    const out: number[] = [];
    let max = 0;
    for (let s = 0; s < len; s += step) {
      let m = 0;
      const e = Math.min(len, s + step);
      for (const d of data) for (let i = s; i < e; i++) {
        const v = Math.abs(d[i]);
        if (v > m) m = v;
      }
      out.push(m);
      if (m > max) max = m;
    }
    const norm = max > 0 ? 1 / max : 1;
    return { peaks: out.map((v) => Math.round(v * norm * 1000) / 1000), duration: audio.duration };
  } catch {
    return null;
  }
}

/** Recording date from typical WhatsApp / phone file names, else file mtime. */
export function guessRecordedAt(file: File): string | null {
  const n = file.name;
  let m = n.match(/(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})(?:[ _-]?(?:at[ _])?(\d{2})[.\-:_h]?(\d{2})(?:[.\-:_m]?(\d{2}))?)?/i);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h || 12), Number(mi || 0), Number(s || 0));
    if (!isNaN(date.getTime()) && Number(mo) >= 1 && Number(mo) <= 12 && Number(d) <= 31) return date.toISOString();
  }
  return file.lastModified ? new Date(file.lastModified).toISOString() : null;
}

export function titleFromFile(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim() || "Untitled jam";
}

export function fmtTime(sec: number | null | undefined) {
  if (sec == null || !Number.isFinite(sec)) return "–:––";
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

export function fmtSize(bytes: number | null | undefined) {
  if (!bytes) return "–";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(iso);
}

export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function parseTimeInput(v: string): number | null {
  const parts = v.trim().split(":").map((x) => Number(x));
  if (!parts.length || parts.some((x) => !Number.isFinite(x) || x < 0)) return null;
  return parts.reduce((acc, x) => acc * 60 + x, 0);
}
