import React from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Terms of Service — item 5 of the launch readiness list.
 *
 * Like the Privacy Policy, this is a starting draft. Have a lawyer
 * review before launch. The numbered list maps to the user-visible flows
 * in the product so every clause has a corresponding code path.
 */
const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1>
            <p className="text-sm text-slate-500 mt-1">Last updated: 2026-09-01</p>
          </div>

          <Card>
            <CardHeader><CardTitle>1. Eligibility</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>You must be 18 years or older, legally able to enter a marriage under Indian law, and not currently married. By creating an account you represent and warrant that all of the above are true.</p>
              <p>MedicoMatch is intended for medical professionals and people seeking to marry medical professionals. Misrepresenting your profession is grounds for immediate termination.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>2. Your account</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>You are responsible for your account credentials and for all activity under your account. Use a strong unique password. Do not share your account.</p>
              <p>You agree to provide accurate information during registration and to keep it updated. We may suspend accounts with unverifiable or contradictory information.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>3. Acceptable use</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>You agree NOT to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Impersonate any other person or entity.</li>
                <li>Upload photos that are not of you, or that contain nudity, hate symbols, or illegal content.</li>
                <li>Send messages, interests, or other communications that are harassing, threatening, defamatory, or sexually explicit.</li>
                <li>Solicit money, gifts, or favours from other users (this is matrimonial fraud; we report to law enforcement).</li>
                <li>Use automated tools (bots, scrapers) to access the service.</li>
                <li>Circumvent rate limits, CSRF protection, or any other security control.</li>
                <li>Create multiple accounts to evade enforcement.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>4. Verification</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>Email verification is required to activate an account. A "verified" badge (currently in development) will require submission of a government-issued ID and review by our team. We may, at our sole discretion, revoke a verified badge if the supporting information is found to be inaccurate or unverifiable.</p>
              <p>Until ID verification is rolled out, the absence of a "verified" badge is not a statement about a user's authenticity — treat all information as user-supplied and unverified.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>5. Subscriptions and payments</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>Paid plans (Premium, Platinum, Annual variants) are billed in INR via Razorpay. GST is included in the displayed price. An invoice is generated for every successful payment and is available in your account.</p>
              <p>Paid plans (Premium, Platinum, Annual variants) are one-time purchases billed in INR via Razorpay — nothing is charged automatically. We email a renewal reminder 3 days before expiry. Renew from <Link to="/account" className="text-mediblue-600 underline">/account</Link>; cancelling stops future renewals and you keep paid access until the current period ends.</p>
              <p><strong>Refund policy:</strong> a refunded payment downgrades your account to the free (basic) tier immediately. Consumed quotas (interests, video dates, contact views) during the paid period are not clawed back. If you believe a refund was issued in error, contact <a href="mailto:billing@medicomatch.in" className="text-mediblue-600 underline">billing@medicomatch.in</a> within 7 days.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>6. Astrology consultations</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>If you purchase an astrology consultation, the booking window is 30 days from purchase. Unused consultations expire. Astrologer availability and slot booking is on a best-effort basis; we do not guarantee a specific time. Disputes about consultation quality should be raised within 48 hours of the session via <a href="mailto:support@medicomatch.in" className="text-mediblue-600 underline">support@medicomatch.in</a>.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>7. Content you post</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>You retain ownership of text and photos you upload. You grant MedicoMatch a non-exclusive, worldwide, royalty-free licence to display, store, and transmit that content for the purpose of operating the service.</p>
              <p>You may remove content at any time by editing your profile or deleting your account. Backups may retain anonymized copies for up to 90 days per our operational retention policy.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>8. Account termination</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>You can delete your account at any time from <Link to="/delete-account" className="text-mediblue-600 underline">/delete-account</Link>. Deletion is permanent and tombstones your record so it cannot be reactivated.</p>
              <p>We may suspend or terminate accounts that violate these Terms. The decision is reviewable — write to <a href="mailto:grievance@medicomatch.in" className="text-mediblue-600 underline">grievance@medicomatch.in</a> within 30 days.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>9. Disclaimers</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>MedicoMatch is a platform. We do not conduct background checks, verify employment claims, or guarantee the accuracy of any information posted by users. You are responsible for your own due diligence before meeting, sharing personal information with, or entering into any arrangement with another user.</p>
              <p>The service is provided "as is" without warranties of any kind. To the maximum extent permitted by law, we disclaim all warranties, express or implied.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>10. Limitation of liability</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>To the maximum extent permitted by Indian law, MedicoMatch's aggregate liability for any claim arising out of or relating to the service shall not exceed the total amount you paid us in the 12 months preceding the claim.</p>
              <p>We are not liable for indirect, incidental, consequential, or punitive damages.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>11. Governing law and disputes</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>These Terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts in Bengaluru, India. We will attempt informal resolution first — write to <a href="mailto:legal@medicomatch.in" className="text-mediblue-600 underline">legal@medicomatch.in</a> — before any formal action.</p>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-500 text-center pt-6">
            <Link to="/privacy" className="text-mediblue-600 underline mr-4">Privacy Policy</Link>
            <Link to="/delete-account" className="text-mediblue-600 underline mr-4">Delete account</Link>
            <Link to="/" className="text-mediblue-600 underline">Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default TermsPage;
