import React from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Security Policy & Responsible Disclosure — launch-gap fix #2.
 *
 * Describes the controls that actually exist in this codebase (indexed by the
 * production audit), states plainly what we do NOT promise, and gives
 * researchers a disclosure contact with response commitments.
 */
const SecurityPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Security Policy</h1>
            <p className="text-sm text-slate-500 mt-1">Last updated: 2026-09-01</p>
          </div>

          <Card>
            <CardHeader><CardTitle>1. How we protect your data</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>Passwords hashed with scrypt + per-user salt; timing-safe comparisons.</li>
                <li>Signed, httpOnly, SameSite=Strict session cookies (Secure in production); CSRF tokens on every state-changing request.</li>
                <li>Server-side validated payments (Razorpay); plan activation only via single-use, server-signed entitlement tokens.</li>
                <li>Contact details (phone/email) stripped from profile responses; only a metered contact-reveal endpoint returns them.</li>
                <li>Every admin action written to an audit log.</li>
                <li>TLS on all production traffic and on database connections.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>2. What we do not promise</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>No system can be perfectly secure. We do not promise that the service is invulnerable, and we do not guarantee the accuracy of information other members post. Please keep your password private, enable a strong unique password, and review our <Link to="/community" className="text-mediblue-600 underline">Community & Safety Guidelines</Link>.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>3. Responsible disclosure</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>If you find a security vulnerability, please report it to <a href="mailto:security@medicomatch.in" className="text-mediblue-600 underline">security@medicomatch.in</a> with a clear description and steps to reproduce.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>We will acknowledge your report within 3 business days.</li>
                <li>Please give us a reasonable time to fix the issue before disclosing it publicly.</li>
                <li>Please do not access other users' data, degrade the service, or run automated scanners against production without written permission.</li>
              </ul>
              <p>We appreciate researchers who help keep our members safe. Critical, previously-unknown issues reported in good faith will be recognised in our release notes.</p>
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

export default SecurityPage;
