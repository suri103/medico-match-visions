// Minimal email transport. Sends via Resend's REST API when RESEND_API_KEY is
// set; otherwise logs the message to stdout (dev/test). No heavy dependencies.

import crypto from "node:crypto";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || "MedicoMatch <no-reply@medicomatch.in>";

// Audit M11: in production a missing Resend key must NEVER silently log
// full message bodies (they contain reset/verify tokens) to stdout. Fail
// closed — the caller surfaces the error instead of leaking secrets.
const isProduction = process.env.NODE_ENV === "production";

/** Short, non-reversible correlator for log lines (audit M6 — no PII in logs). */
const recipientRef = (to) =>
  crypto.createHash("sha256").update(String(to || "").trim().toLowerCase()).digest("hex").slice(0, 12);

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!RESEND_API_KEY) {
    if (isProduction) {
      throw new Error(
        "RESEND_API_KEY is required in production — refusing to log email bodies (they contain verification/reset tokens) to stdout."
      );
    }
    console.log(JSON.stringify({ level: "info", msg: "email_dev", to, subject, text }));
    return;
  }
  try {
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
      console.error(JSON.stringify({ level: "error", msg: "email_send_failed", recipientRef: recipientRef(to), subject, error: body?.message || res.status }));
    }
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "email_send_failed", recipientRef: recipientRef(to), subject, error: String(error) }));
  }
};
