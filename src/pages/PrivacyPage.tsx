import React from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Privacy Policy — DPDP Act 2023 / item 5 of the launch readiness list.
 *
 * This page is a starting draft. The actual deployed policy must be
 * reviewed by a lawyer admitted to practice in the jurisdictions where
 * MedicoMatch operates (India at minimum; EU/UK if you serve users there).
 * Use the data inventory below as a checklist of what to disclose.
 */
const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
            <p className="text-sm text-slate-500 mt-1">Last updated: 2026-09-01</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>1. Who we are</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>
                MedicoMatch is operated by MedicoMatch Technologies Pvt. Ltd.,
                a company incorporated in India. For the purposes of India's
                Digital Personal Data Protection Act, 2023 (DPDP Act), we are
                the Data Fiduciary of your personal data.
              </p>
              <p>
                Contact: <a href="mailto:privacy@medicomatch.in" className="text-mediblue-600 underline">privacy@medicomatch.in</a>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. What personal data we collect</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-3">
              <p><strong>Account data:</strong> email address, password (stored as scrypt hash, never in plaintext), first name, last name, role on signup, medical specialty, medical degree.</p>
              <p><strong>Profile data:</strong> gender, age, height, marital status, hospital / city / state / country, about-me text, partner-preference text, interests, caste, sub-caste, gotra, mother tongue, religion, kundali fields (rashi, nakshatra, manglik, kundali gunas), sexual orientation, ethnicity.</p>
              <p><strong>Communications data:</strong> messages exchanged with other users, video-date metadata (date, duration, status), interest proposals and responses.</p>
              <p><strong>Photos:</strong> the profile photo you upload. Photos are stored either as data URLs in our database or in Supabase Storage (depending on configuration).</p>
              <p><strong>Payment data:</strong> billing is processed by Razorpay; we store payment_id, order_id, plan (sku), amount, status, and source. We do NOT store your card or UPI details — those are handled by Razorpay under their privacy policy.</p>
              <p><strong>Technical data:</strong> IP address (used for rate limiting and security), session cookie (httpOnly, signed, 7-day expiry), CSRF token (12-hour, double-submit cookie), browser user-agent.</p>
              <p><strong>Behavioural data:</strong> plan quota usage (interests sent, video dates booked, contact views) per IST business month.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Why we use it (purposes)</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>To operate the matrimonial matching service (search, interest proposals, chat, video dates).</li>
                <li>To process payments and issue GST invoices.</li>
                <li>To send you service emails (verification link, password reset, important account notifications).</li>
                <li>To detect and prevent abuse, fraud, and security incidents.</li>
                <li>To comply with legal obligations under Indian law (tax records, law enforcement requests).</li>
              </ul>
              <p>We do not sell your personal data to third parties. We do not use it for advertising.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Who we share it with</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p><strong>Other users:</strong> profile fields you marked as public (everything except phone, email, and a few admin-only fields) are visible to other authenticated users.</p>
              <p><strong>Service providers:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Razorpay</strong> — payment processing. Their privacy policy governs card / UPI data.</li>
                <li><strong>Resend</strong> — transactional email delivery (verification, password reset).</li>
                <li><strong>Supabase</strong> (optional) — object storage for profile photos.</li>
                <li><strong>Hosting provider</strong> — the server runs on a Node host (your choice; configure before launch).</li>
              </ul>
              <p><strong>Law enforcement:</strong> we disclose data in response to valid legal process under Indian law.</p>
              <p><strong>Business transfers:</strong> if MedicoMatch is acquired or merges, your data may transfer to the acquirer; you will be notified in advance.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. How long we keep it</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>Active account data: until you delete your account.</li>
                <li>Deleted account data: tombstoned (anonymized to "Deleted User") in the database to preserve referential integrity of past chat messages and audit logs. The tombstone retains the user_id for FK integrity only; PII is replaced with placeholders.</li>
                <li>Payment records: 7 years (Income Tax Act 1961 requirement).</li>
                <li>Admin audit log: 12 months by default (configurable via <code>ADMIN_AUDIT_RETENTION_DAYS</code>).</li>
                <li>Server logs (request log JSON lines): as long as your log retention policy requires; we recommend 90 days.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Your rights (DPDP Act 2023)</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>You have the right to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Access</strong> a copy of your data — visit <Link to="/account" className="text-mediblue-600 underline">/account</Link> and click "Export my data", or call <code>GET /api/me/export</code>.</li>
                <li><strong>Correct</strong> inaccurate data — edit your profile at <Link to="/profile/edit" className="text-mediblue-600 underline">/profile/edit</Link>.</li>
                <li><strong>Erase</strong> your data — visit <Link to="/delete-account" className="text-mediblue-600 underline">/delete-account</Link> to confirm deletion (DPDP Act Section 12).</li>
                <li><strong>Withdraw consent</strong> — the same delete flow acts as consent withdrawal.</li>
                <li><strong>Grievance redressal</strong> — email <a href="mailto:grievance@medicomatch.in" className="text-mediblue-600 underline">grievance@medicomatch.in</a>. We respond within 30 days per DPDP Act timelines.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Security</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>Passwords hashed with scrypt + per-user salt.</li>
                <li>Session cookies are httpOnly, SameSite=Strict, Secure in production.</li>
                <li>CSRF protection on every state-changing request.</li>
                <li>Content-Security-Policy enforced + Report-Only mode for violations.</li>
                <li>Row-level security (deny-all) on every database table; the API connects with the service role only.</li>
                <li>Webhooks verified by HMAC-SHA256 over the raw body.</li>
                <li>Every admin action written to <code>admin_audit_log</code>.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8. Cookies we set</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-3">
              <p><strong><code>mm_session</code></strong> — httpOnly, SameSite=Strict, Secure. Your signed session token, 7-day expiry. Essential for the service.</p>
              <p><strong><code>mm_csrf</code></strong> — non-httpOnly, SameSite=Strict, Secure. CSRF token echoed on state-changing requests. Essential for security.</p>
              <p>We do not set third-party advertising or analytics cookies. We do not use Google Analytics, Facebook Pixel, or any cross-site tracker.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>9. Children</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700">
              <p>MedicoMatch is for adults (18+) seeking a matrimonial match. We do not knowingly collect data from anyone under 18. If we discover an underage account, we delete it.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>10. Changes to this policy</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700">
              <p>If we change this policy in a material way, we will email every active account at least 30 days before the change takes effect, and require re-consent if the change expands what we collect or how we use it.</p>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-500 text-center pt-6">
            <Link to="/terms" className="text-mediblue-600 underline mr-4">Terms of Service</Link>
            <Link to="/" className="text-mediblue-600 underline">Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPage;
