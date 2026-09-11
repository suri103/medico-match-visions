import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Shield, CreditCard, Bell, Crown, CheckCircle2, Lock, ShieldCheck, FileText, Upload, AlertCircle, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePersistedState } from '@/hooks/usePersistedState';
import { usePlan } from '@/hooks/usePlan';
import { useAuth } from '@/hooks/useAuth';
import { changePassword, isAuthServerConfigured } from '@/services/auth';
import {
  hasServerSession, getQuota, cancelBilling, resumeBilling, listInvoices, requestRefund, type ServerInvoice,
  listProfileViewers, type ProfileViewRow,
} from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EMPTY_PROFILE } from '@/lib/profile';
import { medicalCouncilsList } from '@/features/matches/data/constants';

// P0-1 phone possession check. Server-issued OTP, 10-min TTL, 5 attempts.
function PhoneVerificationCard() {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { phoneStatus, hasServerSession } = await import('@/services/api');
        if (!hasServerSession()) return;
        const s = await phoneStatus();
        if (s) { setVerified(s.verified); if (s.phone) setPhone(s.phone); }
      } catch { /* offline */ }
    })();
  }, []);
  const request = async () => {
    const { requestPhoneOtp } = await import('@/services/api');
    const r = await requestPhoneOtp(phone);
    if (!r.ok) { toast({ title: "Could not send code", description: r.error, variant: "destructive" }); return; }
    setSent(true);
    toast({ title: "Code sent", description: "Enter the 6-digit code within 10 minutes." });
  };
  const confirm = async () => {
    const { verifyPhoneOtp } = await import('@/services/api');
    const r = await verifyPhoneOtp(code);
    if (!r.ok) { toast({ title: "Verification failed", description: r.error, variant: "destructive" }); return; }
    setVerified(true);
    toast({ title: "Number verified", description: "Your mobile number is now verified." });
  };
  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Mobile Verification {verified ? '✓' : ''}</h3>
      {verified ? (
        <p className="text-xs text-emerald-700">Verified{phone ? `: ${phone}` : ''}. Council review unlocks the badge.</p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1" />
          <Button type="button" variant="outline" size="sm" onClick={() => void request()}>Send code</Button>
        </div>
      )}
      {sent && !verified && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} className="flex-1" />
          <Button type="button" size="sm" onClick={() => void confirm()}>Verify</Button>
        </div>
      )}
    </div>
  );
}

/**
 * Launch-gap fix #5: member-facing refund request (AccountPage billing tab).
 * SAFE DEFAULT: this is an ADVISORY ticket delivered to the billing/support
 * inbox — it never auto-refunds. Approval & execution stay with the admin
 * refund endpoints / Razorpay dashboard + refund.processed webhook revocation.
 */
function RefundRequestCard() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 10) {
      toast({ title: "Tell us a bit more", description: "Please describe the reason (min 10 characters).", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const r = await requestRefund(reason.trim());
      if (r.ok) {
        toast({ title: "Refund request sent", description: r.message || "Our billing team will reach out within 2 business days." });
        setOpen(false);
        setReason('');
      } else if (r.error) {
        toast({ title: "Could not send request", description: r.error, variant: "destructive" });
      } else {
        toast({ title: "Could not send request", description: "You may be offline — try again in a moment.", variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 border rounded-2xl bg-slate-50">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-medium text-slate-900 text-sm">Refunds & Cancellation</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cancel anytime from Membership. Refunds follow our{' '}
            <Link to="/refunds" className="text-mediblue-600 underline">Refund Policy</Link>.
          </p>
        </div>
        <CreditCard className="text-slate-400 shrink-0" size={18} />
      </div>
      {!open ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Request a refund</Button>
      ) : (
        <div className="space-y-2 mt-2">
          <Textarea
            rows={3}
            placeholder="Tell us why you're requesting a refund (order id helps — find it in your invoices above)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
          />
          <div className="flex gap-2">
            <Button size="sm" className="bg-mediblue-600 hover:bg-mediblue-700 text-white" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Sending…' : 'Send request'}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setOpen(false); setReason(''); }}>
              Cancel
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">Goes to our billing team as a support ticket. Nothing is charged or refunded automatically by this form.</p>
        </div>
      )}
    </div>
  );
}

const AccountPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { planName, videoDatesLeft, interestLeft, contactLeft } = usePlan();

  // Audit C-2: defaults are empty and hydrate from the authenticated session.
  const [personal, setPersonal] = usePersistedState('mm:accountPersonal', {
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: '',
  });

  // Sync with session if personal state is empty but user is logged in
  useEffect(() => {
    if (user) {
      setPersonal(prev => ({
        firstName: prev.firstName || user.firstName || '',
        lastName: prev.lastName || user.lastName || '',
        email: prev.email || user.email || '',
        phone: prev.phone || '',
      }));
    }
  }, [user, setPersonal]);

  const [profile, setProfile] = usePersistedState('mm:profileData', EMPTY_PROFILE);
  const [notifPrefs, setNotifPrefs] = usePersistedState<string[]>('mm:accountNotifPrefs', ['messages', 'views', 'matches']);
  const certFileRef = React.useRef<HTMLInputElement>(null);
  
  const [passwords, setPasswords] = useState({
    current: '',
    next: '',
    confirm: '',
  });

  const [invoices, setInvoices] = useState<ServerInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  // "Who viewed your profile" — real server feed (durable view rows).
  const [profileViewers, setProfileViewers] = useState<ProfileViewRow[]>([]);

  useEffect(() => {
    if (!hasServerSession()) return;
    setLoadingInvoices(true);
    listInvoices()
      .then((invs) => {
        if (invs) setInvoices(invs);
      })
      .catch(() => {})
      .finally(() => setLoadingInvoices(false));
    listProfileViewers(20)
      .then((views) => { if (views.length) setProfileViewers(views); })
      .catch(() => {});
  }, []);

  const updateField = (field: 'firstName' | 'lastName' | 'email' | 'phone', value: string) => {
    setPersonal(prev => ({ ...prev, [field]: value }));
  };

  const toggleNotif = (key: string) => {
    setNotifPrefs(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  };

  const handleCertificateFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Certificates are stored as data URLs in localStorage (~5MB budget).
    // Reject oversized files up front instead of failing silently later (M3).
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Certificates are stored on this device and are limited to 2 MB in this build. Please upload a smaller file.",
        variant: "destructive",
      });
      if (certFileRef.current) certFileRef.current.value = '';
      return;
    }
    const fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      setProfile(prev => ({
        ...prev,
        verificationDocumentName: fileName,
        verificationDocumentUrl: String(reader.result),
        verificationStatus: 'pending',
      }));
      // Verify the write actually landed — localStorage can silently refuse
      // writes when full, and a lost certificate must never be reported as
      // "uploaded" (audit M3).
      window.setTimeout(() => {
        try {
          const raw = localStorage.getItem('mm:profileData');
          const saved = raw ? JSON.parse(raw) : null;
          if (saved?.verificationDocumentName !== fileName || !saved?.verificationDocumentUrl) {
            throw new Error('not persisted');
          }
          toast({
            title: "Certificate Uploaded",
            description: `${fileName} uploaded. Your verification request is under review.`,
          });
        } catch {
          toast({
            title: "Storage full",
            description: "The certificate could not be stored on this device. Free up browser storage or try a smaller file.",
            variant: "destructive",
          });
        }
      }, 50);
    };
    reader.readAsDataURL(file);
    if (certFileRef.current) certFileRef.current.value = '';
  };

  const handleVerifyDoctor = async () => {
    // Verification backend now exists — submit the document URL for review.
    // Local pending state remains the offline fallback (never self-verifies).
    setProfile(prev => ({
      ...prev,
      verificationStatus: 'pending',
    }));
    try {
      const { submitVerificationDoc, hasServerSession } = await import('@/services/api');
      if (hasServerSession() && profile.verificationDocumentUrl) {
        const r = await submitVerificationDoc('council', profile.verificationDocumentUrl);
        if (!r.ok) {
          toast({ title: "Server upload failed", description: r.error || "Saved on this device only.", variant: "destructive" });
          return;
        }
      }
    } catch { /* offline: local pending stands */ }
    toast({
      title: "Verification submitted",
      description: "Your registration details are queued for review. The Verified badge activates after credential checks pass.",
    });
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFirst = personal.firstName.replace(/^dr\.?\s*/i, '').trim();
    const cleanLast = personal.lastName.trim();
    const combinedName = `Dr. ${cleanFirst} ${cleanLast}`.trim();

    setProfile(prev => ({
      ...prev,
      name: combinedName || prev.name,
      email: personal.email || prev.email,
      phone: personal.phone || prev.phone,
    }));

    let syncFailed = false;
    try {
      const { saveMyServerProfile, hasServerSession } = await import('@/services/api');
      if (hasServerSession()) {
        const saved = await saveMyServerProfile({
          full_name: combinedName || undefined,
          email: personal.email || undefined,
          phone: personal.phone || undefined,
        });
        if (saved === null) syncFailed = true;
      }
    } catch { syncFailed = true; /* offline / local fallback */ }

    toast(
      syncFailed
        ? {
            title: "Saved on this device only",
            description: "Server sync failed — your changes are kept locally and will retry on next save.",
            variant: "destructive",
          }
        : {
            title: "Account details updated",
            description: "Your personal information and doctor profile have been synchronized successfully.",
          }
    );
  };

  const [pwBusy, setPwBusy] = React.useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current) {
      toast({ title: "Current password required", description: "Please enter your current password.", variant: "destructive" });
      return;
    }
    if (passwords.next.length < 6) {
      toast({ title: "Weak password", description: "New password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (passwords.next !== passwords.confirm) {
      toast({ title: "Passwords do not match", description: "Please confirm your new password correctly.", variant: "destructive" });
      return;
    }
    if (!isAuthServerConfigured()) {
      // No auth backend configured — say so instead of pretending (demo builds).
      toast({
        title: "Password change unavailable",
        description: "This build does not manage passwords yet — your current sign-in keeps working.",
        variant: "destructive",
      });
      setPasswords({ current: '', next: '', confirm: '' });
      return;
    }
    setPwBusy(true);
    const res = await changePassword(passwords.current, passwords.next);
    setPwBusy(false);
    if (!res.ok) {
      toast({ title: "Password change failed", description: res.error || 'Please try again.', variant: "destructive" });
      return;
    }
    // The server invalidated every existing session (tokenVersion bump) — sign
    // the user out locally so state matches reality.
    setPasswords({ current: '', next: '', confirm: '' });
    toast({
      title: "Password updated",
      description: "For your security you've been signed out — please sign in with your new password.",
    });
    await signOut();
    navigate('/sign-in');
  };

  const handleSavePreferences = () => {
    toast({
      title: "Preferences saved",
      description: "Your notification settings have been updated.",
    });
  };

  const formattedPlan = planName.charAt(0).toUpperCase() + planName.slice(1);

// Server-side billing lifecycle (DB mode): plan expiry + cancel/resume.
const [billing, setBilling] = useState<{ expiresAt: string | null; canceling: boolean }>({
  expiresAt: null,
  canceling: false,
});
useEffect(() => {
  if (!hasServerSession()) return;
  let cancelled = false;
  getQuota().then((q) => {
    if (!q || cancelled) return;
    setBilling({
      expiresAt: q.planExpiresAt ?? null,
      canceling: Boolean(q.canceling),
    });
  }).catch(() => {});
  return () => { cancelled = true; };
}, [planName]);

const actBilling = async (
  fn: Promise<{ ok: boolean; error: string | null; planExpiresAt?: string | null }>,
  label: string
) => {
  const r = await fn;
  if (r.ok) {
    setBilling((b) => ({ ...b, canceling: label === 'Cancellation scheduled', expiresAt: r.planExpiresAt ?? b.expiresAt }));
    toast({ title: label, description: 'Your access and billing reflect this change.' });
  } else {
    toast({ title: `${label} failed`, description: r.error || undefined, variant: 'destructive' });
  }
};

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">My Account</h1>
              <p className="text-slate-500 text-xs sm:text-sm">Manage your profile credentials, membership, and security</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-mediblue-50 text-mediblue-700 border border-mediblue-100">
                <Crown size={13} className="text-amber-500" /> {formattedPlan} Plan
              </span>
            </div>
          </div>
          
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid grid-cols-2 sm:grid-cols-5 mb-8 bg-white border border-slate-200 shadow-sm h-auto p-1.5 gap-1.5 rounded-xl">
              <TabsTrigger value="personal" className="flex items-center justify-center gap-1.5 text-xs py-2">
                <User className="h-4 w-4" />
                <span>Personal</span>
              </TabsTrigger>
              <TabsTrigger value="verification" className="flex items-center justify-center gap-1.5 text-xs py-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Verification</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center justify-center gap-1.5 text-xs py-2">
                <Shield className="h-4 w-4" />
                <span>Security</span>
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex items-center justify-center gap-1.5 text-xs py-2">
                <CreditCard className="h-4 w-4" />
                <span>Billing</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center justify-center gap-1.5 text-xs py-2 col-span-2 sm:col-span-1">
                <Bell className="h-4 w-4" />
                <span>Alerts</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="verification" className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    Doctor Identity & Council Verification
                  </h2>
                  <p className="text-slate-500 text-sm">
                    Verified doctors gain 3.4x more match responses and a prominent verified checkmark badge.
                  </p>
                </div>
                <div>
                  {profile.verificationStatus === 'verified' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 size={15} className="text-emerald-700" /> Verified Doctor
                    </span>
                  ) : profile.verificationStatus === 'pending' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      <AlertCircle size={15} className="text-amber-700" /> Under Review
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                      Unverified
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-6 max-w-2xl">
                {/* P0-1 phone OTP: possession check before council review. */}
                <PhoneVerificationCard />
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800">State Medical Council Details</h3>
                  
                  <div>
                    <Label className="text-xs font-medium text-slate-700 mb-1 block">Medical Registration Council</Label>
                    <Select 
                      value={profile.councilName || medicalCouncilsList[0]} 
                      onValueChange={(v) => setProfile(prev => ({ ...prev, councilName: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select council" /></SelectTrigger>
                      <SelectContent>
                        {medicalCouncilsList.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-slate-700 mb-1 block">Medical Council Registration No.</Label>
                      <Input
                        value={profile.registrationNumber || ''}
                        placeholder="e.g. MMC-2018-87492"
                        onChange={(e) => setProfile(prev => ({ ...prev, registrationNumber: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700 mb-1 block">Registration Year</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 2018"
                        value={profile.registrationYear || ''}
                        onChange={(e) => setProfile(prev => ({ ...prev, registrationYear: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-xl space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800">Council Certificate & Degree Document</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50/80 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText size={18} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-slate-800">
                          {profile.verificationDocumentName || 'No document uploaded yet'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {profile.verificationDocumentName
                            ? 'Official council registration certificate or state degree credential'
                            : 'Upload official council registration certificate or state degree credential (PDF or Image)'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <input
                        ref={certFileRef}
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={handleCertificateFile}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => certFileRef.current?.click()}
                      >
                        <Upload size={13} className="mr-1.5" /> {profile.verificationDocumentName ? 'Replace Document' : 'Upload File'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  {profile.verificationStatus !== 'verified' ? (
                    <Button 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white" 
                      onClick={handleVerifyDoctor}
                    >
                      <ShieldCheck size={16} className="mr-1.5" /> Submit & Verify Doctor Profile
                    </Button>
                  ) : (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        toast({ title: "Credentials saved", description: "Your verified doctor credentials are in good standing." });
                      }}
                    >
                      Save Verification Details
                    </Button>
                  )}
                  <Button type="button" variant="ghost" onClick={() => navigate('/profile')}>
                    View Profile Badge
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="personal" className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200/80">
              <h2 className="text-lg font-semibold mb-1 text-slate-900">Personal Information</h2>
              <p className="text-slate-500 text-sm mb-6">Update your account contact details here.</p>
              
              <form onSubmit={handleSavePersonal} className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="acc-first-name" className="text-xs font-medium text-slate-700 mb-1 block">First Name</Label>
                    <Input
                      id="acc-first-name"
                      type="text"
                      placeholder="Your first name"
                      value={personal.firstName}
                      onChange={(e) => updateField('firstName', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="acc-last-name" className="text-xs font-medium text-slate-700 mb-1 block">Last Name</Label>
                    <Input
                      id="acc-last-name"
                      type="text"
                      placeholder="Your last name"
                      value={personal.lastName}
                      onChange={(e) => updateField('lastName', e.target.value)}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="acc-email" className="text-xs font-medium text-slate-700 mb-1 block">Email Address</Label>
                  <Input
                    id="acc-email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={personal.email}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="acc-phone" className="text-xs font-medium text-slate-700 mb-1 block">Phone Number</Label>
                  <Input
                    id="acc-phone"
                    type="tel"
                    placeholder="Your phone number"
                    value={personal.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                  />
                </div>
                
                <div className="pt-4 flex items-center gap-3">
                  <Button type="submit" className="bg-mediblue-600 hover:bg-mediblue-700 text-white">
                    Save Changes
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate('/profile')}>
                    View Doctor Profile
                  </Button>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="security" className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200/80">
              <h2 className="text-lg font-semibold mb-1 text-slate-900">Security Settings</h2>
              <p className="text-slate-500 text-sm mb-6">Manage your password and security credentials.</p>
              
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-xl">
                <div>
                  <Label htmlFor="acc-cur-pass" className="text-xs font-medium text-slate-700 mb-1 block">Current Password</Label>
                  <Input
                    id="acc-cur-pass"
                    type="password"
                    placeholder="••••••••"
                    value={passwords.current}
                    onChange={(e) => setPasswords(p => ({ ...p, current: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="acc-new-pass" className="text-xs font-medium text-slate-700 mb-1 block">New Password</Label>
                  <Input
                    id="acc-new-pass"
                    type="password"
                    placeholder="At least 6 characters"
                    value={passwords.next}
                    onChange={(e) => setPasswords(p => ({ ...p, next: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="acc-conf-pass" className="text-xs font-medium text-slate-700 mb-1 block">Confirm New Password</Label>
                  <Input
                    id="acc-conf-pass"
                    type="password"
                    placeholder="Re-enter new password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                  />
                </div>
                <div className="pt-3 flex items-center gap-3">
                  <Button type="submit" className="bg-mediblue-600 hover:bg-mediblue-700 text-white" disabled={pwBusy}>
                    <Lock size={14} className="mr-1.5" /> {pwBusy ? 'Updating…' : 'Update Password'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => navigate('/help')}>
                    Need Help?
                  </Button>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="billing" className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200/80">
              <h2 className="text-lg font-semibold mb-1 text-slate-900">Billing & Membership</h2>
              <p className="text-slate-500 text-sm mb-6">Manage your active membership plan and quota limits.</p>
              
              <div className="space-y-6 max-w-2xl">
                <div className="p-5 border rounded-2xl bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">{formattedPlan} Membership</h3>
                      {planName !== 'basic' && (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${billing.canceling ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {billing.canceling ? 'Cancels at period end' : billing.expiresAt ? 'Active' : 'Active (local)'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {planName === 'basic'
                        ? 'Free tier with standard access'
                        : billing.expiresAt
                          ? `Access through ${new Date(billing.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}${billing.canceling ? ' — canceling, no further charges' : ''}`
                          : 'Full access membership plan'}
                    </p>
                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-600">
                      <span>Interests left: <strong>{interestLeft === Infinity ? '∞' : interestLeft}</strong></span>
                      <span>Contact views left: <strong>{contactLeft === Infinity ? '∞' : contactLeft}</strong></span>
                      <span>Video dates left: <strong>{videoDatesLeft === Infinity ? '∞' : videoDatesLeft}</strong></span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button onClick={() => navigate('/plan')} className="bg-mediblue-600 hover:bg-mediblue-700 text-white">
                      {planName === 'basic' ? 'Upgrade Plan' : 'Change Plan'}
                    </Button>
                    {hasServerSession() && planName !== 'basic' && (
                      billing.canceling ? (
                        <Button size="sm" variant="outline" onClick={() => void actBilling(resumeBilling(), 'Membership resumed')}>
                          Resume membership
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700"
                          onClick={() => void actBilling(cancelBilling(), 'Cancellation scheduled')}>
                          Cancel at period end
                        </Button>
                      )
                    )}
                  </div>
                </div>
                
                <div className="p-4 border rounded-2xl">
                  <h3 className="font-medium text-slate-800 text-sm mb-2">Spotlight Boost</h3>
                  <p className="text-xs text-slate-500 mb-3">Paid-member perk: rank first in browse + daily picks for 7 days.</p>
                  <Button size="sm" variant="outline" onClick={() => void (async () => {
                    const { activateBoost, getBoost } = await import('@/services/api');
                    const cur = await getBoost();
                    if (cur?.active) {
                      toast({ title: "Boost active", description: `Your profile is boosted through ${new Date(cur.expiresAt!).toLocaleDateString('en-IN')}.` });
                      return;
                    }
                    const r = await activateBoost();
                    toast(r.ok ? { title: "Spotlight on ✨", description: "Your profile now ranks first for 7 days." }
                      : { title: "Boost unavailable", description: r.error || "Upgrade to a paid plan first.", variant: "destructive" });
                  })}>
                    Activate 7-day Spotlight
                  </Button>
                </div>

                {/* Who viewed my profile — real server data (durable view rows). */}
                <div className="p-5 border rounded-2xl bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-slate-900 text-sm">Who viewed your profile</h3>
                      <p className="text-xs text-slate-500">Members who opened your biodata recently.</p>
                    </div>
                    <Eye className="text-slate-400 shrink-0" size={18} />
                  </div>
                  {profileViewers.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">No profile views yet. Complete your biodata and upload photos to appear in more searches.</p>
                  ) : (
                    <div className="space-y-2">
                      {profileViewers.slice(0, 5).map((v) => (
                        <div key={v.viewerUserId} className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-xl">
                          {v.imageUrl ? (
                            <img src={v.imageUrl} alt={v.name} className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-semibold text-slate-600">
                              {v.name.replace(/^Dr\.\s*/i, '').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-800 truncate flex items-center gap-1">
                              {v.name}
                              {v.isVerified && <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {[v.specialty, v.city].filter(Boolean).join(' · ') || 'Member'}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] text-slate-400">
                              {new Date(v.lastViewedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                            </div>
                            {v.totalViews > 1 && (
                              <div className="text-[10px] text-slate-400">{v.totalViews} views</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-5 border rounded-2xl bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-slate-900 text-sm">Invoices & Receipts</h3>
                      <p className="text-xs text-slate-500">Download GST tax invoices for your membership and consultations.</p>
                    </div>
                    <FileText className="text-slate-400 shrink-0" size={18} />
                  </div>
                  {loadingInvoices ? (
                    <p className="text-xs text-slate-400 py-2">Loading invoices...</p>
                  ) : invoices.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">No invoices found for this account.</p>
                  ) : (
                    <div className="divide-y divide-slate-200 border rounded-xl bg-white overflow-hidden text-xs">
                      {invoices.map((inv) => (
                        <div key={inv.invoiceNumber} className="p-3 flex items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-slate-800">{inv.invoiceNumber}</div>
                            <div className="text-slate-500 text-[11px]">{inv.planName} • {inv.date}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-slate-900">₹{inv.total.toFixed(2)}</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">{inv.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Launch-gap fix #5: member-facing refund request (advisory
                    ticket to the billing team; approval stays admin-side). */}
                <RefundRequestCard />

                <div className="p-4 border rounded-2xl">
                  <h3 className="font-medium text-slate-800 text-sm mb-2">Payment Security</h3>
                  <div className="flex items-center text-xs text-slate-500 gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>All payments and renewals are processed securely with PCI-DSS 256-bit encryption.</span>
                  </div>
                  <Button variant="link" className="text-mediblue-600 p-0 h-auto text-xs mt-2" onClick={() => navigate('/plan')}>
                    View full plan comparison and FAQ →
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="notifications" className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200/80">
              <h2 className="text-lg font-semibold mb-1 text-slate-900">Notification Preferences</h2>
              <p className="text-slate-500 text-sm mb-6">Choose which alerts you want to receive.</p>
              
              <div className="space-y-4 max-w-2xl">
                <div className="flex items-center justify-between p-3 border rounded-xl">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">New Messages</p>
                    <p className="text-xs text-slate-500">Get notified when you receive a new chat message</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={notifPrefs.includes('messages')} onChange={() => toggleNotif('messages')} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mediblue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-xl">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">Profile Views</p>
                    <p className="text-xs text-slate-500">Get notified when someone views your profile</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={notifPrefs.includes('views')} onChange={() => toggleNotif('views')} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mediblue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-xl">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">Matches & Interests</p>
                    <p className="text-xs text-slate-500">Get notified when you have a mutual match or interest</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={notifPrefs.includes('matches')} onChange={() => toggleNotif('matches')} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mediblue-600"></div>
                  </label>
                </div>
                
                <div className="pt-4">
                  <Button className="bg-mediblue-600 hover:bg-mediblue-700 text-white" onClick={handleSavePreferences}>
                    Save Preferences
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default AccountPage;
