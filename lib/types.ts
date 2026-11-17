export type Member = {
  id: number;
  name: string;
  bio: string;
  avatar_url: string | null;
  color: string;
  created_at: string;
  instruments?: Instrument[];
};

export type Instrument = {
  id: number;
  member_id: number;
  name: string;
  kind: string;
  details: string;
};

export type TrackStatus = "new" | "shortlist" | "working" | "done" | "archived";

export const STATUSES: { value: TrackStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "shortlist", label: "Shortlist" },
  { value: "working", label: "Working on" },
  { value: "done", label: "Done" },
  { value: "archived", label: "Archived" },
];

export const VOTE_OPTIONS = [
  { value: -1, emoji: "👎", label: "Skip it" },
  { value: 1, emoji: "👍", label: "Like it" },
  { value: 2, emoji: "🔥", label: "Work on this next" },
] as const;

export const INSTRUMENT_KINDS = [
  "Guitar",
  "Bass",
  "Drums",
  "Percussion",
  "Keys / Synth",
  "Vocals",
  "Amp",
  "Processor / Pedal",
  "Mic",
  "Software / Plugin",
  "Other",
];

export const LINK_LABELS = ["Same song", "Variation", "Continues", "Part of", "Better take", "Inspired by", "Related"];

export const REACTIONS = ["👍", "❤️", "🔥", "😂", "🤘", "🎯", "🤔", "👀"];

export type Vote = { member_id: number; value: number };

export type TrackSummary = {
  id: number;
  title: string;
  description: string;
  file_url: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  duration_sec: number | null;
  recorded_at: string | null;
  created_at: string;
  status: TrackStatus;
  uploaded_by: number | null;
  peaks: number[] | null;
  score: number;
  votes: Vote[];
  comment_count: number;
  bookmark_count: number;
  link_count: number;
};

export type Reaction = { emoji: string; member_ids: number[] };

export type Comment = {
  id: number;
  track_id: number;
  member_id: number | null;
  parent_id: number | null;
  body: string;
  start_sec: number | null;
  end_sec: number | null;
  audio_url: string | null;
  audio_name: string | null;
  audio_duration: number | null;
  created_at: string;
  edited_at: string | null;
  reactions: Reaction[];
};

export type TrackLink = {
  id: number;
  label: string;
  other: { id: number; title: string; duration_sec: number | null; status: TrackStatus; recorded_at: string | null };
};

export type TrackInstrumentImage = { id: number; url: string; caption: string };

export type TrackInstrument = {
  id: number;
  track_id: number;
  member_id: number | null;
  instrument_id: number | null;
  name: string;
  settings: string;
  images: TrackInstrumentImage[];
};

export type TrackDetail = TrackSummary & {
  comments: Comment[];
  links: TrackLink[];
  instruments: TrackInstrument[];
};
