import { describe, it, expect } from "vitest";
import { buildScheduledFor, parseSlotStart } from "./videoDate";

// Audit H-3: the video-date invite built its datetime from the UI slot LABEL
// ("07:00 PM - 07:30 PM") as if it were an ISO time, so `new Date(...)` was
// Invalid and `.toISOString()` threw — the booking never reached the server
// while the member was told it had been sent.
//
// The server (domain.parseScheduledFor) reads a bare "YYYY-MM-DDTHH:mm:ss" as
// IST, so the client must send exactly that.

describe("parseSlotStart", () => {
  it("converts a 12-hour slot label to 24-hour parts", () => {
    expect(parseSlotStart("07:00 PM - 07:30 PM")).toEqual({ hh: 19, mm: 0 });
    expect(parseSlotStart("06:00 PM - 06:30 PM")).toEqual({ hh: 18, mm: 0 });
    expect(parseSlotStart("09:00 PM - 09:30 PM")).toEqual({ hh: 21, mm: 0 });
  });

  it("handles 12 AM / 12 PM correctly", () => {
    expect(parseSlotStart("12:00 AM - 12:30 AM")).toEqual({ hh: 0, mm: 0 });
    expect(parseSlotStart("12:00 PM - 12:30 PM")).toEqual({ hh: 12, mm: 0 });
  });

  it("returns null for a label it cannot read", () => {
    expect(parseSlotStart("7pm")).toBeNull();
    expect(parseSlotStart("")).toBeNull();
    expect(parseSlotStart("25:00 PM")).toBeNull();
  });
});

describe("buildScheduledFor", () => {
  it("builds a bare ISO datetime the server reads as IST", () => {
    expect(buildScheduledFor("2026-10-22", "07:00 PM - 07:30 PM")).toBe("2026-10-22T19:00:00");
    expect(buildScheduledFor("2026-01-05", "06:00 PM - 06:30 PM")).toBe("2026-01-05T18:00:00");
  });

  it("rejects a malformed date", () => {
    expect(buildScheduledFor("22-10-2026", "07:00 PM - 07:30 PM")).toBeNull();
    expect(buildScheduledFor("", "07:00 PM - 07:30 PM")).toBeNull();
  });

  it("rejects a malformed slot label instead of producing an Invalid Date", () => {
    // The exact string that used to reach `new Date(...)` and throw.
    expect(buildScheduledFor("2026-10-22", "07:00 PM - 07:30 PM")).not.toContain("PM");
    expect(buildScheduledFor("2026-10-22", "not a time")).toBeNull();
  });

  it("rejects a calendar date that does not exist", () => {
    expect(buildScheduledFor("2026-02-31", "07:00 PM - 07:30 PM")).toBeNull();
  });
});
