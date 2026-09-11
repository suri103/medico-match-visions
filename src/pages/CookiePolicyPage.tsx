import React from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Cookie Policy — launch-gap fix #2.
 *
 * Must stay consistent with the real cookies in server/src/index.mjs
 * (mm_session httpOnly session cookie, mm_csrf double-submit token) and with
 * section 8 of the Privacy Policy. This build sets no analytics or
 * advertising cookies — if that ever changes, this page must be updated first.
 */
const CookiePolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Cookie Policy</h1>
            <p className="text-sm text-slate-500 mt-1">Last updated: 2026-09-01</p>
          </div>

          <Card>
            <CardHeader><CardTitle>1. What we set and why</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p><strong><code>mm_session</code></strong> — httpOnly, SameSite=Strict, Secure. Your signed session token (7-day expiry). Essential: without it you cannot stay signed in. You cannot disable it and use the site.</p>
              <p><strong><code>mm_csrf</code></strong> — SameSite=Strict, Secure, readable by our own JavaScript. A CSRF token echoed on every state-changing request to protect against forged requests. Also essential.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>2. What we do not set</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>No advertising cookies. No analytics cookies. No Google Analytics, Facebook Pixel, or any cross-site tracker.</p>
              <p>When you pay, Razorpay may set its own cookies on its checkout domain (<code>checkout.razorpay.com</code>) — those are governed by Razorpay's privacy policy, not ours.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>3. Managing cookies</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>Our cookies are strictly necessary, so no consent banner is required and no preferences toggle exists. Blocking cookies in your browser settings will sign you out and disable most features.</p>
              <p>Signing out (<Link to="/account" className="text-mediblue-600 underline">Account</Link>) clears your local session data immediately; the server invalidates all sessions on password change.</p>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-500 text-center pt-6">
            <Link to="/privacy" className="text-mediblue-600 underline mr-4">Privacy Policy</Link>
            <Link to="/terms" className="text-mediblue-600 underline mr-4">Terms of Service</Link>
            <Link to="/" className="text-mediblue-600 underline">Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default CookiePolicyPage;
