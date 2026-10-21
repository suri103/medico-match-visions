// Minimal email transport. Sends via Resend's REST API when RESEND_API_KEY is
// set; otherwise logs the message to stdout (dev/test). No heavy dependencies.

import crypto from "node:crypto";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || "MedicoMatch <no-reply@medicomatch.in>";

// Audit M11 / M-3: in production a missing Resend key must NEVER silently log
// full message bodies (they contain reset/verify tokens) to stdout. Fail
// closed — the caller surfaces the error instead of leaking secrets.
//
// Audit M-3: the guard used to be `NODE_ENV !== "production"`, so a STAGING
// or PREVIEW deployment (which is not production but is also not a laptop)
// logged every verification link, password-reset link and OTP code to
// stdout. Anyone with log access could take over the account. Only a genuine
// development / test process may use the log transport; every other
// environment must configure a real transport.
const isDevLike =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

/** Short, non-reversible correlator for log lines (audit M6 — no PII in logs). */
const recipientRef = (to) =>
  crypto.createHash("sha256").update(String(to || "").trim().toLowerCase()).digest("hex").slice(0, 12);

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!RESEND_API_KEY) {
    if (!isDevLike) {
      throw new Error(
        "RESEND_API_KEY is required outside development/test — refusing to log email bodies (they contain verification/reset tokens) to stdout."
      );
    }
    console.log(JSON.stringify({ level: "info", msg: "email_dev", to, subject, text }));
    return;
  }
  // Audit M-2: the transport used to SWALLOW every failure — a non-2xx
  // response was logged and a thrown fetch error was caught and logged, so
  // `sendEmail` never rejected. Every caller that awaited it inside a
  // try/catch therefore had DEAD error handling, and the support inbox and
  // the member refund request answered "sent" / 200 while the mail was
  // dropped on the floor with no queue and no retry.
  //
  // It now REJECTS on failure, so the caller's catch block is live.
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    // Audit H12: every outbound call needs a bound. A hung Resend socket used
    // to park /api/support, admin reminders and both digest loops forever.
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Audit M6: no recipient address in operational logs (DPDP-relevant PII).
    // A short hash keeps the line correlatable across retries without storing
    // the address itself.
    const detail = body?.message || `HTTP ${res.status}`;
    console.error(JSON.stringify({ level: "error", msg: "email_send_failed", recipientRef: recipientRef(to), subject, error: detail }));
    throw new Error(`Email delivery failed: ${detail}`);
  }
};
