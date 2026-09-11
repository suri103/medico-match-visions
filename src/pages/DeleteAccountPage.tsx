import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { deleteMyAccount, exportMyData } from "@/services/api";

/**
 * Item 6: DPDP Act 2023 right-to-erasure page. Lists what will be deleted
 * (and what is retained), requires the current password, then calls
 * POST /api/me/delete. The server tombstones the row + clears the
 * session; the UI redirects to home.
 */
const DeleteAccountPage: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signOut, isSignedIn } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportMyData();
      if (!data) {
        toast({ title: "Export failed", description: "Could not reach the server.", variant: "destructive" });
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medicomatch-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Export downloaded", description: "Your data is in the downloaded JSON file." });
    } catch {
      toast({ title: "Export failed", description: "Please try again or contact support.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm) {
      toast({ title: "Confirmation required", description: "Please check the confirmation box.", variant: "destructive" });
      return;
    }
    if (!password) {
      toast({ title: "Password required", description: "Enter your current password to confirm.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const r = await deleteMyAccount(password);
      if (r.ok) {
        await signOut();
        toast({
          title: "Account deleted",
          description: "Your data has been removed. We're sorry to see you go.",
        });
        navigate("/", { replace: true });
      } else {
        toast({ title: "Deletion failed", description: r.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Deletion failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-grow p-4 md:p-8">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-slate-700">Please sign in to manage your account.</p>
                <Link to="/sign-in" className="text-mediblue-600 underline mt-2 inline-block">Sign in</Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Delete your account</h1>
            <p className="text-sm text-slate-500 mt-1">DPDP Act 2023 — right to erasure (Section 12)</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Before you delete</CardTitle>
              <CardDescription>What will be removed and what is retained</CardDescription>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none text-sm text-slate-700 space-y-2">
              <p><strong>Removed immediately:</strong> your profile, photos, interests (sent and received), favorites, shortlists, blocks, chat channels &amp; messages, video-date bookings, notifications, and quota usage.</p>
              <p><strong>Anonymized (tombstoned):</strong> your account record becomes "Deleted User" so chat messages from other users still have a valid referent. Your email becomes <code>deleted-&#123;your-id&#125;@deleted.medicomatch.in</code>.</p>
              <p><strong>Retained for legal reasons:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Payment transactions and invoices: <strong>7 years</strong> (Income Tax Act, 1961).</li>
                <li>Admin audit log: 12 months (configurable).</li>
                <li>Anonymized chat message content is retained for the recipient's record (per DPDP Section 8 legitimate use).</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Export your data first (recommended)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-slate-700">Download a JSON copy of everything we hold about you before deletion. This is your DPDP Act right to data portability.</p>
              <Button variant="outline" onClick={handleExport} disabled={exporting}>
                {exporting ? "Preparing download…" : "Download my data (JSON)"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-rose-200">
            <CardHeader>
              <CardTitle className="text-rose-700">Delete account</CardTitle>
              <CardDescription>This action is permanent and cannot be undone.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>
                  I understand that my account will be deleted, my profile and chat history
                  will be removed, and the action cannot be undone. Payment records and
                  anonymized tombstones are retained as required by Indian law.
                </span>
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Confirm with your password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Your current password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
              <Button
                onClick={handleDelete}
                disabled={busy || !confirm || !password}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {busy ? "Deleting…" : "Permanently delete my account"}
              </Button>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-500 text-center">
            <Link to="/account" className="text-mediblue-600 underline mr-4">Back to account</Link>
            <Link to="/privacy" className="text-mediblue-600 underline">Privacy Policy</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default DeleteAccountPage;
