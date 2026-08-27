
import { demoModeEnabled } from '@/lib/devAuth';

export interface VideoInvite {
  id: string;
  senderId: string;
  senderName: string;
  senderImage: string;
  message: string;
  proposedDate: string;
  duration: number;
  status: 'pending' | 'accepted' | 'declined' | 'rescheduled';
}

export interface VideoScheduled {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorImage: string;
  doctorSpecialty: string;
  date: string;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
}

const INVITES_KEY = 'mm:videoInvites';
const SCHEDULED_KEY = 'mm:videoScheduled';

export function loadInvites(fallback: VideoInvite[]): VideoInvite[] {
  try {
    const raw = localStorage.getItem(INVITES_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return fallback;
}

export function saveInvites(v: VideoInvite[]) {
  localStorage.setItem(INVITES_KEY, JSON.stringify(v));
  window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key: INVITES_KEY } }));
}

export function loadScheduled(): VideoScheduled[] {
  try {
    const raw = localStorage.getItem(SCHEDULED_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveScheduled(v: VideoScheduled[]) {
  localStorage.setItem(SCHEDULED_KEY, JSON.stringify(v));
  window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key: SCHEDULED_KEY } }));
}

export function acceptInviteToScheduled(invite: VideoInvite): VideoScheduled {
  return {
    id: invite.id,
    doctorId: invite.senderId,
    doctorName: invite.senderName,
    doctorImage: invite.senderImage,
    doctorSpecialty: 'Doctor',
    date: invite.proposedDate,
    duration: invite.duration,
    status: 'scheduled',
  };
}

// ---- Recording store (client-side demo players) ----
export interface VideoRecording {
  id: string;
  doctorName: string;
  doctorImage: string;
  url: string;
  recordedAt: string;
  duration: number;
}

// Publicly-available sample clip used to simulate a finished call playback.
const SAMPLE_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const RECORDINGS_KEY = "mm:videoRecordings";

export function loadRecordings(): VideoRecording[] {
  try {
    const raw = localStorage.getItem(RECORDINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

export function saveRecording(rec: VideoRecording): VideoRecording[] {
  const all = loadRecordings();
  const idx = all.findIndex((r) => r.id === rec.id);
  if (idx >= 0) all[idx] = { ...all[idx], ...rec };
  else all.push(rec);
  localStorage.setItem(RECORDINGS_KEY, JSON.stringify(all));
  window.dispatchEvent(
    new CustomEvent("mm:persisted-state-changed", { detail: { key: RECORDINGS_KEY } })
  );
  return all;
}

// Return an existing recording, or lazily create one for a completed session.
// In production builds we NEVER fabricate a recording — a call without a
// stored recording has none and the player says so honestly (audit M2). The
// sample clip exists only so dev builds always have something to play.
export function ensureRecording(opts: {
  id: string;
  doctorName: string;
  doctorImage: string;
  duration: number;
}): VideoRecording {
  const existing = loadRecordings().find((r) => r.id === opts.id);
  if (existing) return existing;
  const created: VideoRecording = {
    id: opts.id,
    doctorName: opts.doctorName,
    doctorImage: opts.doctorImage,
    url: demoModeEnabled ? SAMPLE_URL : "",
    recordedAt: new Date().toISOString(),
    duration: opts.duration,
  };
  saveRecording(created);
  return created;
}