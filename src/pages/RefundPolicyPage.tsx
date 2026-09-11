import React from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Refund & Cancellation Policy — launch-gap fix #2.
 *
 * Mirrors the implemented server behaviour in server/src/index.mjs
 * (subscription/recordRefund + adminRefund + refund.processed webhook) and the
 * default policy documented in DEPLOYMENT.md. Like Terms/Privacy, this is a
 * starting draft — have a lawyer review before launch, and contact
 * grievance@medicomatch.in for review disputes.
 */
const RefundPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Refund & Cancellation Policy</h1>
            <p className="text-sm text-slate-500 mt-1">Last updated: 2026-09-01</p>
          </div>

          <Card>
            <CardHeader><CardTitle>1. Cancelling your membership</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>You can cancel your paid membership at any time from Account &gt; Membership &gt; Cancel membership. Cancellation takes effect at the end of the current billing period — your paid plan stays active until the expiry date shown on your account. Self-service cancellation applies to memberships (premium/platinum).</p>
              <p>Astrology consultations and Kundali match reports are single-use digital products: a consultation is used when the session is booked, a report is used when it is first generated for a member pair.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>2. What a refund does</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>A <strong>full refund</strong> returns you to the Basic (free) plan immediately: membership access ends, consultations are marked refunded, and generated reports expire.</p>
              <p>A <strong>partial refund</strong> (e.g. goodwill adjustments) is recorded against your payment but keeps your current access.</p>
              <p>Quota you already spent (interests sent, video dates booked, contact views used) is not restored by a refund.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>3. How to request a refund</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>Open Account &gt; Membership and use <strong>Request a refund</strong>, telling us the reason. Our billing team responds within 2 business days. Refunds are issued to the original payment method through Razorpay; the amount can take 5–7 business days to appear on your statement.</p>
              <p>You can also write to <a href="mailto:support@medicomatch.in" className="text-mediblue-600 underline">support@medicomatch.in</a> with your registered email and order/payment id.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>4. Disputes</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>If you disagree with a refund decision, write to <a href="mailto:grievance@medicomatch.in" className="text-mediblue-600 underline">grievance@medicomatch.in</a> within 30 days. We respond per the timelines in our Privacy Policy.</p>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-500 text-center pt-6">
            <Link to="/plan" className="text-mediblue-600 underline mr-4">Membership plans</Link>
            <Link to="/privacy" className="text-mediblue-600 underline mr-4">Privacy Policy</Link>
            <Link to="/terms" className="text-mediblue-600 underline mr-4">Terms of Service</Link>
            <Link to="/" className="text-mediblue-600 underline">Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default RefundPolicyPage;
