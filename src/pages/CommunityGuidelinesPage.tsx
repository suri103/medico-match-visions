import React from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Community & Safety Guidelines — launch-gap fix #2.
 *
 * Each rule maps to a real enforcement path: reporting (ReportProfileModal →
 * POST /api/reports), blocking (BlockProfileModal → POST /api/blocks, severed
 * both directions), admin review (Admin console trust tab), suspension
 * (middlewared 403 + SSE kick), and warn/strike ladder.
 */
const CommunityGuidelinesPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Community & Safety Guidelines</h1>
            <p className="text-sm text-slate-500 mt-1">Last updated: 2026-09-01</p>
          </div>

          <Card>
            <CardHeader><CardTitle>1. Be who you say you are</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>Use your real name, your own photos, and honest medical credentials. Impersonation, fake profiles, and credential fraud lead to immediate removal. Get verified by uploading your council registration certificate — verified profiles earn a badge.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>2. Respect every member</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>No harassment, hate speech, threats, sexually explicit content, or repeated unwanted contact. If someone asks you to stop, stop. Matrimonial fraud — soliciting money, gifts, or favours — is a criminal offence in India; we report it to law enforcement.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>3. Keep communication on the platform</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>Stay in MedicoMatch chat and video dates until you genuinely trust the other person. Never share bank details, OTPs, or documents with another member. We will never ask for your password.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>4. Report and block</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>Every profile has <strong>Report</strong> and <strong>Block</strong> actions. Reporting (fake profile, harassment, spam, inappropriate content, fraud) sends the profile to our moderation queue. Blocking immediately severs both directions: the blocked member can no longer message you, send you interest, or view your profile.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>5. Enforcement</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>First minor offence: warning (our moderators use a documented warn ladder).</li>
                <li>Repeat or serious offences: suspension or permanent ban.</li>
                <li>Fraud and impersonation: immediate termination and, where required, referral to police.</li>
              </ul>
              <p>All enforcement decisions are reviewable — write to <a href="mailto:grievance@medicomatch.in" className="text-mediblue-600 underline">grievance@medicomatch.in</a> within 30 days.</p>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-500 text-center pt-6">
            <Link to="/terms" className="text-mediblue-600 underline mr-4">Terms of Service</Link>
            <Link to="/privacy" className="text-mediblue-600 underline mr-4">Privacy Policy</Link>
            <Link to="/" className="text-mediblue-600 underline">Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default CommunityGuidelinesPage;
