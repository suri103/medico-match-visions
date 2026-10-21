// ---------------------------------------------------------------------------
// Video-date scheduling helpers.
//
// Audit H-3: the video-date invite built its datetime with
//     new Date(`${date}T${timeSlot}:00`).toISOString()
// where `timeSlot` is the UI LABEL ("07:00 PM - 07:30 PM") — not an ISO
// time. `new Date(...)` produced an Invalid Date and `.toISOString()` threw
// a RangeError, which the caller swallowed with a `console.warn`. No server
// booking was ever created, yet the member was told "Video Date Request
// Sent!".
//
// The server (domain.parseScheduledFor) accepts a bare "YYYY-MM-DDTHH:mm:ss"
// and interprets it as IST (+05:30), which is what we send.
// ---------------------------------------------------------------------------

/** Parse the START of a UI time slot label into 24-hour parts. */
export function parseSlotStart(slot: string): { hh: number; mm: number } | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(slot || "");
  if (!m) return null;
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  const meridiem = m[3].toUpperCase();
  if (mm > 59) return null;
  if (meridiem === "PM") {
    if (hh < 1 || hh > 12) return null;
    if (hh !== 12) hh += 12;
  } else {
    if (hh < 1 || hh > 12) return null;
    if (hh === 12) hh = 0;
  }
  return { hh, mm };
}

/**
 * Build the server-facing `scheduledFor` value for a video-date request.
 * Returns null when the date or the slot label cannot be parsed.
 */
export function buildScheduledFor(date: string, slot: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
  if (!dateMatch) return null;
  const start = parseSlotStart(slot);
  if (!start) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  // Real calendar validation: Date.UTC(y, m, 0) is the last day of month m.
  // (`new Date("2026-02-31...")` silently ROLLS OVER to March, so a naive
  // Date comparison would let an impossible date through.)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;

  const hh = String(start.hh).padStart(2, "0");
  const mm = String(start.mm).padStart(2, "0");
  const iso = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${hh}:${mm}:00`;
  const parsed = new Date(`${iso}+05:30`);
  if (Number.isNaN(parsed.getTime())) return null;
  return iso;
}

const SENT_REQUESTS_KEY = "mm:sentVideoRequests";

/**
 * Record the request in the local `mm:sentVideoRequests` ledger so the
 * /video-dates page shows it even before the server round-trip lands.
 *
 * Idempotent: an entry for the same doctor + date is never duplicated (the
 * modal and the page both record it).
 */
export function recordLocalVideoRequest(doctorName: string, date: string, time: string): boolean {
  try {
    const raw = localStorage.getItem(SENT_REQUESTS_KEY);
    const arr: Array<{ id: string; doctorName: string; date: string; duration: string }> =
      raw ? JSON.parse(raw) : [];
    if (arr.some((r) => r.doctorName === doctorName && r.date?.slice(0, 10) === date?.slice(0, 10))) {
      return false;
    }
    arr.push({
      id: `vdr${Date.now()}`,
      doctorName,
      date: new Date(`${date}T00:00:00`).toISOString(),
      duration: time,
    });
    localStorage.setItem(SENT_REQUESTS_KEY, JSON.stringify(arr));
    window.dispatchEvent(new CustomEvent("mm:persisted-state-changed", { detail: { key: SENT_REQUESTS_KEY } }));
    return true;
  } catch {
    return false;
  }
}
