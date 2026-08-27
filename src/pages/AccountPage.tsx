import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Shield, CreditCard, Bell, Crown, CheckCircle2, Lock, ShieldCheck, FileText, Upload, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useNavigate } from 'react-router-dom';
import { usePlan } from '@/hooks/usePlan';
import { useAuth } from '@/hooks/useAuth';
import { changePassword, isAuthServerConfigured } from '@/services/auth';
import {
  hasServerSession, getQuota, cancelBilling, resumeBilling,
} from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EMPTY_PROFILE } from '@/lib/profile';
import { medicalCouncilsList } from '@/features/matches/data/constants';

const AccountPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { planName, videoDatesLeft, interestLeft, contactLeft } = usePlan();

  const [personal, setPersonal] = usePersistedState('mm:accountPersonal', {
    firstName: 'Doctor',
    lastName: 'User',
    email: 'doctor@medicomatch.com',
    phone: '+91 98765 43210',
  });

  const [profile, setProfile] = usePersistedState('mm:profileData', EMPTY_PROFILE);
  const [notifPrefs, setNotifPrefs] = usePersistedState<string[]>('mm:accountNotifPrefs', ['messages', 'views', 'matches']);
  const certFileRef = React.useRef<HTMLInputElement>(null);
  
  const [passwords, setPasswords] = useState({
    current: '',
    next: '',
    confirm: '',
  });

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

  const handleVerifyDoctor = () => {
    // No verification backend exists in this build — submitting can only
    // queue the profile as pending, never mark it verified (audit H2).
    setProfile(prev => ({
      ...prev,
      verificationStatus: 'pending',
    }));
    toast({
      title: "Verification submitted",
      description: "Your registration details are queued for review. The Verified badge activates only after credential checks launch.",
    });
  };

  const handleSavePersonal = (e: React.FormEvent) => {
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

    toast({
      title: "Account details updated",
      description: "Your personal information and doctor profile have been synchronized successfully.",
    });
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
                          {profile.verificationDocumentName || 'nmc_registration_certificate.pdf'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Official council registration certificate or state degree credential
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
