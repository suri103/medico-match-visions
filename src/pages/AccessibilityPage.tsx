import React from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Accessibility Statement — launch-gap fix #2.
 *
 * Commitments kept deliberately concrete (real techniques used in this app:
 * labelled form controls, keyboard-operable Radix primitives, status text, and
 * reduced-motion-safe CSS) plus a feedback channel. Draft — review on each
 * major UI refresh.
 */
const AccessibilityPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-4 md:p-8" id="main-content">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Accessibility Statement</h1>
            <p className="text-sm text-slate-500 mt-1">Last updated: 2026-09-01</p>
          </div>

          <Card>
            <CardHeader><CardTitle>1. Our commitment</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>MedicoMatch aims to be usable by everyone, including members who use screen readers, keyboard navigation, or reduced-motion settings. We treat accessibility regressions as bugs.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>2. What we do today</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>Form fields carry visible labels; error and success messages are announced as text.</li>
                <li>Dialogs, selects, tabs, and menus are keyboard-operable components with focus management.</li>
                <li>Colour is never the only signal — status is also conveyed by text and icons.</li>
                <li>Text meets contrast targets on the default theme; type scales with browser font-size settings.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>3. Known limitations and feedback</CardTitle></CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p>Video-date calling and some image carousels are harder to make fully accessible; we are working on captions and keyboard alternatives. If anything blocks you, email <a href="mailto:support@medicomatch.in" className="text-mediblue-600 underline">support@medicomatch.in</a> with the page and the barrier — accessibility reports are answered within 5 business days.</p>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-500 text-center pt-6">
            <Link to="/help" className="text-mediblue-600 underline mr-4">Help & Support</Link>
            <Link to="/terms" className="text-mediblue-600 underline mr-4">Terms of Service</Link>
            <Link to="/" className="text-mediblue-600 underline">Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default AccessibilityPage;
