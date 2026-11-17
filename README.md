# Band Jams

A private web app where the band uploads jam recordings, listens, votes and decides what to work on next.

## Features

- **Tracks**: upload one or many audio files at once (WhatsApp `.opus`, mp3, m4a, wav, flac…). Each track shows its recording date, file size, length and waveform.
- **Player**: play / pause / stop, ±10 s, zoom, playback speed. A dock keeps playing while you browse the list.
- **Votes and priority**: 👎 −1, 👍 +1, 🔥 +2 ("work on this next"). The list sorts by score, and each track has a status (New → Shortlist → Working on → Done / Archived).
- **Bookmarks**: mark a moment or an interval (drag on the waveform) with a note. Bookmarks show on the waveform and play when clicked.
- **Comments**: threaded replies, emoji reactions, and audio in any comment (attach a file or record a voice note).
- **Connected tracks**: link takes of the same song, variations, parts that belong together, and so on.
- **Profiles**: name, photo, colour, bio and an editable list of instruments and gear.
- **Track instruments and settings**: who played what on each track, free-text settings, and multiple photos per instrument (for example a processor screen or a pedal board).

## Stack

Next.js 15 (App Router) · Postgres (Neon) via `pg` · Vercel Blob for audio and images · wavesurfer.js.
Tables are created automatically on first request; there are no migrations to run.

## Environment variables

| Name | What it is |
| --- | --- |
| `DATABASE_URL` or `STORAGE_DATABASE_URL` | Postgres connection string. Set automatically when a Neon database is connected in Vercel. |
| `BLOB_READ_WRITE_TOKEN` | Set automatically when a Vercel Blob store is connected. |
| `BAND_PASSWORD` | The shared password everyone types on the login screen. |
| `SESSION_SECRET` | Long random string that signs login cookies. Changing it logs everyone out. |

## Sign-in model

Anyone with the band password can log in and pick (or create) a profile. It's built for trust between friends, not for strangers. Uploaded files are stored as public Blob URLs with random names, so they're unguessable but not access-controlled.

## Local development

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```
