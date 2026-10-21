
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate, Link } from 'react-router-dom';
import {
  Heart, Video, ArrowRight, ShieldCheck,
  Eye, EyeOff,
  Sparkles, Lock, Mail, KeyRound, Search,
  Stethoscope, ChevronRight
} from 'lucide-react';
import { hasCreatedProfile } from '@/lib/profile';
import { localAvatar } from '@/lib/avatar';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { isAuthServerConfigured, loginWithServer } from '@/services/auth';
import { demoModeEnabled } from '@/lib/devAuth';
import type { MatchSearchCriteria } from '@/features/matches/hooks/useMatches';

const SPECIALTIES = [
  "Any Specialization",
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Orthopedics",
  "General Surgery",
  "Neurology",
  "Radiology",
  "Gynecology",
  "Internal Medicine"
];

const CITIES = [
  "All India",
  "Mumbai",
  "Delhi NCR",
  "Bangalore",
  "Hyderabad",
  "Pune",
  "Chennai",
  "Kolkata",
  "Ahmedabad"
];

// Audit L-10: the demo avatars point at randomuser.me, a THIRD-PARTY image
// CDN — serving one leaks the visitor's IP address to that CDN. The demo
// login cards are already gated by `demoModeEnabled` at the render site, but
// this module-level constant was still emitted into the production bundle
// (the URL strings survived the dead-code elimination). Gating the constant
// itself removes the third-party reference from a shipped artifact.
const DEMO_DOCTORS = demoModeEnabled ? [
  {
    name: "Dr. Aditya Sharma",
    email: "dr.aditya@demo.medicomatch.in",
    role: "Cardiologist · Mumbai",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  {
    name: "Dr. Priya Patel",
    email: "dr.priya@demo.medicomatch.in",
    role: "Neurologist · Delhi",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
  },
] : [];

const Index = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [, setHasProfile] = useState(() => hasCreatedProfile());

  // Hero Widget State
  const [activeTab, setActiveTab] = useState<'search' | 'login'>('search');
  const [genderPref, setGenderPref] = useState<'Female' | 'Male'>('Female');
  const [ageFrom, setAgeFrom] = useState('24');
  const [ageTo, setAgeTo] = useState('36');
  const [selectedSpecialty, setSelectedSpecialty] = useState('Any Specialization');
  const [selectedCity, setSelectedCity] = useState('All India');

  // Hero Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showHeroPassword, setShowHeroPassword] = useState(false);

  // Audit L-10: the landing page used to render three INVENTED testimonials
  // ("Dr. Sarah J.", "Dr. Michael R.", "Dr. Priya T." with quotes about
  // finding love) as if they were real members — on a trust-sensitive
  // matrimonial platform, that is a false claim to a prospective member. The
  // avatars were also hot-linked from randomuser.me, which leaks every
  // visitor's IP address to a third party (the exact thing
  // src/lib/avatar.ts exists to avoid).
  //
  // The section now renders the REAL approved success stories from the
  // backend (`GET /api/stories` returns approved rows only) with local
  // avatars, and shows an honest invitation when there are none yet.
  const [successStories, setSuccessStories] = useState<
    Array<{ id: string; partnerName: string; story: string; photoUrl: string }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { listServerStories } = await import('@/services/api');
        const rows = await listServerStories();
        if (!cancelled && Array.isArray(rows)) setSuccessStories(rows.slice(0, 3));
      } catch {
        /* offline: the honest empty state stands */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onStorage = () => setHasProfile(hasCreatedProfile());
    window.addEventListener('storage', onStorage);
    window.addEventListener('mm:persisted-state-changed', onStorage as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('mm:persisted-state-changed', onStorage as EventListener);
    };
  }, []);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // The hero fetch widget must actually apply its selections to the matches
    // page. We push a validated MatchSearchCriteria object in navigate state
    // AND mirror it into the URL query string so the results are shareable and
    // survive a page refresh (Matches.tsx parses both).
    const criteria: MatchSearchCriteria = {
      minAge: ageFrom ? [Number(ageFrom)] : undefined,
      maxAge: ageTo ? [Number(ageTo)] : undefined,
      specialties: selectedSpecialty !== 'Any Specialization' ? [selectedSpecialty] : undefined,
      city: selectedCity !== 'All India' ? selectedCity : undefined,
    };
    const params = new URLSearchParams();
    if (criteria.minAge) params.set('min', String(criteria.minAge[0]));
    if (criteria.maxAge) params.set('max', String(criteria.maxAge[0]));
    if (criteria.specialties) params.set('spec', criteria.specialties.join(','));
    if (criteria.city) params.set('city', criteria.city);
    const qs = params.toString();
    void navigate(qs ? `/matches?${qs}` : '/matches', { state: { search: criteria } });
  };

  const handleHeroLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast({
        title: "Credentials required",
        description: "Please enter your doctor email and password.",
        variant: "destructive"
      });
      return;
    }
    setIsLoggingIn(true);
    const cleanName = loginEmail.split('@')[0].replace(/^dr\.?\s*/i, '');
    const firstName = (cleanName.charAt(0).toUpperCase() + cleanName.slice(1)) || 'Doctor';

    // Real accounts: passwords are verified SERVER-SIDE. The hero widget must
    // never mint a session from unverified credentials — and outside
    // development an unreachable server fails CLOSED (audits H2/H3).
    if (isAuthServerConfigured()) {
      const res = await loginWithServer(loginEmail.trim(), loginPassword);
      // H-1: cookie-first — browsers get token:null (cookie carries session).
      if (res.ok && res.user) {
        const name = res.user.firstName || firstName;
        signIn({
          id: res.user.id,
          email: res.user.email,
          firstName: name,
          lastName: res.user.lastName,
          fullName: res.user.fullName || `Dr. ${name}`,
          specialty: res.user.specialty || undefined,
          degree: res.user.degree || undefined,
        }, res.token || undefined);
        setIsLoggingIn(false);
        toast({
          title: `Welcome back, Dr. ${name}! 🩺`,
          description: "Signed in successfully. Redirecting to matches...",
        });
        void navigate('/matches');
        return;
      }
      if (res.status === 401) {
        setIsLoggingIn(false);
        toast({
          title: "Sign-in failed",
          description: "Invalid email or password.",
          variant: "destructive",
        });
        return;
      }
      if (!demoModeEnabled) {
        setIsLoggingIn(false);
        toast({
          title: "Server unavailable",
          description: "We couldn't reach the account server. Please try again in a moment.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Offline mode",
        description: "Could not reach the account server — signing in to the local demo session.",
      });
    }

    // Demo session (development only). Audit H4: in a production build this would
    // mint a session for arbitrary credentials when the server is missing — the
    // demoModeEnabled guard (statically false in prod) makes it fail CLOSED.
    if (demoModeEnabled) {
      signIn({ email: loginEmail.trim(), firstName, fullName: `Dr. ${firstName}` });
      setTimeout(() => {
        setIsLoggingIn(false);
        toast({
          title: "Signed In Successfully 🩺",
          description: "Welcome to MedicoMatch. Redirecting to matches...",
        });
        void navigate('/matches');
      }, 500);
      return;
    }

    setIsLoggingIn(false);
    toast({
      title: "Server unavailable",
      description: "Unable to reach the account server. Please try again in a moment.",
      variant: "destructive",
    });
  };

  const handleHeroDemoLogin = (doc: typeof DEMO_DOCTORS[0]) => {
    setLoginEmail(doc.email);
    setLoginPassword('Doctor@123');
    setIsLoggingIn(true);
    // Create a real persisted session for the demo doctor.
    const nameParts = doc.name.replace(/^dr\.?\s*/i, '').split(' ');
    signIn({
      email: doc.email,
      firstName: nameParts[0] || 'Doctor',
      lastName: nameParts.slice(1).join(' '),
      fullName: doc.name,
      imageUrl: doc.avatar,
      specialty: doc.role.split('·')[0].trim(),
    });
    setTimeout(() => {
      setIsLoggingIn(false);
      toast({
        title: `Logged in as ${doc.name} 🩺`,
        description: "Loaded doctor profile and matches.",
      });
      void navigate('/matches');
    }, 300);
  };

  const goMatches = () => {
    void navigate('/matches');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      
      {/* Hero Section with Match Finder & Quick Login Widget */}
      <section className="relative bg-gradient-to-br from-slate-900 via-mediblue-950 to-slate-900 text-white overflow-hidden py-14 sm:py-20">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(#0a7ee8_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-mediblue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Column: Heading & Value Proposition */}
            <div className="lg:col-span-7 space-y-4 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-xs font-semibold text-sky-200">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Doctor Matrimonial Network</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-snug text-white max-w-md">
                Matrimony Designed for Doctors
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 max-w-lg leading-relaxed">
                Connect with verified doctors across medical specialties. Discover compatible life partners who understand the clinical journey, demanding schedules, and shared values.
              </p>

              {/* Trust Highlights Row */}
              <div className="grid grid-cols-3 gap-3 pt-1 max-w-lg">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <p className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-emerald-400" /> Verified
                  </p>
                  <p className="text-[11px] text-slate-300 font-medium mt-0.5">MCI & Council Checked</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <p className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                    <Lock size={15} className="text-sky-300" /> Private
                  </p>
                  <p className="text-[11px] text-slate-300 font-medium mt-0.5">Doctor Privacy Controls</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <p className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                    <Sparkles size={15} className="text-amber-300" /> Compatible
                  </p>
                  <p className="text-[11px] text-slate-300 font-medium mt-0.5">Branch & Kundali Milan</p>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Hero Match & Sign-In Widget Card */}
            <div className="lg:col-span-5 w-full">
              <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-white/20 p-5 sm:p-6 overflow-hidden">
                
                {/* Segmented Tab Selector */}
                <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('search')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === 'search'
                        ? 'bg-white text-mediblue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Search size={13} /> Find Matches
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('login')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === 'login'
                        ? 'bg-white text-mediblue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <KeyRound size={13} /> Doctor Login
                  </button>
                </div>

                {/* Tab 1: Find Matches Widget */}
                {activeTab === 'search' && (
                  <form onSubmit={handleHeroSearch} className="space-y-3.5 text-left">
                    {/* Looking for gender */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                        I am looking for
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setGenderPref('Female')}
                          className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                            genderPref === 'Female'
                              ? 'bg-mediblue-50 border-mediblue-500 text-mediblue-800 ring-1 ring-mediblue-500'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>👩‍⚕️ Female Doctor</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGenderPref('Male')}
                          className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                            genderPref === 'Male'
                              ? 'bg-mediblue-50 border-mediblue-500 text-mediblue-800 ring-1 ring-mediblue-500'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>👨‍⚕️ Male Doctor</span>
                        </button>
                      </div>
                    </div>

                    {/* Age Range (21 to 65) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                          Age Preference
                        </label>
                        <span className="text-[11px] font-semibold text-mediblue-700">
                          {ageFrom} to {ageTo} yrs
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={ageFrom}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAgeFrom(val);
                            if (Number(val) > Number(ageTo)) {
                              setAgeTo(val);
                            }
                          }}
                          className="flex-1 h-9 px-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-mediblue-500 font-medium"
                        >
                          {Array.from({ length: 45 }, (_, i) => 21 + i).map(a => (
                            <option key={a} value={a}>{a} yrs</option>
                          ))}
                        </select>
                        <span className="text-xs text-slate-400 font-medium">to</span>
                        <select
                          value={ageTo}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAgeTo(val);
                            if (Number(val) < Number(ageFrom)) {
                              setAgeFrom(val);
                            }
                          }}
                          className="flex-1 h-9 px-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-mediblue-500 font-medium"
                        >
                          {Array.from({ length: 45 }, (_, i) => 21 + i).map(a => (
                            <option key={a} value={a}>{a} yrs</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Specialty Dropdown */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                        Medical Specialty
                      </label>
                      <select
                        value={selectedSpecialty}
                        onChange={(e) => setSelectedSpecialty(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-mediblue-500 text-slate-800"
                      >
                        {SPECIALTIES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* City / Location */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                        Location / City
                      </label>
                      <select
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-mediblue-500 text-slate-800"
                      >
                        {CITIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Search CTA */}
                    <Button
                      type="submit"
                      className="w-full h-11 text-xs font-bold bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 mt-2"
                    >
                      <Heart size={14} className="fill-current" />
                      <span>Search Doctor Matches</span>
                      <ChevronRight size={14} />
                    </Button>
                  </form>
                )}

                {/* Tab 2: Quick Sign In Widget */}
                {activeTab === 'login' && (
                  <form onSubmit={handleHeroLogin} className="space-y-3 text-left">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Doctor Email or Registration ID
                      </label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder="doctor@hospital.in"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="pl-8 text-xs h-9 rounded-xl"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          type={showHeroPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pl-8 pr-9 text-xs h-9 rounded-xl"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowHeroPassword((v) => !v)}
                          aria-label={showHeroPassword ? 'Hide password' : 'Show password'}
                          title={showHeroPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        >
                          {showHeroPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full h-9 text-xs font-semibold bg-mediblue-600 hover:bg-mediblue-700 text-white rounded-xl shadow-xs"
                    >
                      {isLoggingIn ? "Verifying..." : "Sign In to My Account"}
                    </Button>

                    {/* Quick 1-Click Demo Login — development only; credential-free
                        sign-ins must never ship to production (audit H3). */}
                    {demoModeEnabled && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Sparkles size={11} className="text-amber-500" /> Or 1-Click Test Login:
                      </p>
                      <div className="space-y-1">
                        {DEMO_DOCTORS.map((doc, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleHeroDemoLogin(doc)}
                            className="w-full text-left p-1.5 px-2.5 rounded-lg bg-slate-50 hover:bg-mediblue-50 border border-slate-200 flex items-center justify-between text-xs transition-colors"
                          >
                            <span className="font-semibold text-slate-800 truncate">{doc.name} ({doc.role})</span>
                            <span className="text-[10px] text-mediblue-600 font-bold shrink-0">Login →</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    )}
                  </form>
                )}

                {/* Free Registration link at bottom of widget */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 text-center">
                  <p className="text-[11px] text-slate-500">
                    New to MedicoMatch?{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/sign-up')}
                      className="font-bold text-mediblue-600 hover:text-mediblue-800 hover:underline"
                    >
                      Register Free Profile →
                    </button>
                  </p>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-mediblue-800 mb-4">Why MedicoMatch Works</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We understand the unique challenges medical professionals face in their personal lives.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-mediblue-100 rounded-full flex items-center justify-center mb-6">
                <Heart className="h-7 w-7 text-mediblue-600" />
              </div>
              <h3 className="text-xl font-bold text-mediblue-800 mb-3">Compatibility Matching</h3>
              <p className="text-gray-600">
                Our algorithm considers your specialty, work schedule, and personal interests to find your ideal match.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-mediteal-100 rounded-full flex items-center justify-center mb-6">
                <Video className="h-7 w-7 text-mediteal-600" />
              </div>
              <h3 className="text-xl font-bold text-mediblue-800 mb-3">Virtual Dating</h3>
              <p className="text-gray-600">
                Connect face-to-face with potential partners through our secure video calling platform.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                <ShieldCheck className="h-7 w-7 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-mediblue-800 mb-3">Verified Doctor Credentials</h3>
              <p className="text-gray-600">
                All profiles are verified through medical council registries, ensuring authentic connections in the healthcare community.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Doctor Lifestyle & Community Section */}
      <section className="py-20 bg-gradient-to-r from-slate-900 via-mediblue-950 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center">
            <div className="lg:w-1/2 mb-10 lg:mb-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-sky-200 mb-4">
                <Stethoscope size={14} className="text-emerald-400" />
                <span>Doctor-Centric Experience</span>
              </div>
              <h2 className="text-3xl font-bold mb-4">Built Around Demanding Medical Schedules</h2>
              <p className="text-lg text-blue-200 mb-6 leading-relaxed">
                From residency routines to busy emergency shifts, MedicoMatch respects your clinical time with instant video dates, verified contacts, and direct doctor-to-doctor messaging.
              </p>
              <Button
                className="bg-gradient-to-r from-mediblue-500 to-mediblue-600 hover:from-mediblue-600 hover:to-mediblue-700 text-white px-6 py-3 text-base rounded-xl shadow-lg"
                onClick={goMatches}
              >
                Browse Compatible Doctors <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="lg:w-1/2 lg:pl-16">
              <div className="relative">
                <img
                  src="/doctor_couple.jpg"
                  alt="Doctor Couple in Medicine"
                  className="rounded-2xl shadow-2xl border border-white/15 w-full h-[380px] sm:h-[420px] object-cover object-top ring-1 ring-white/10"
                />
                <div className="absolute -bottom-4 -right-4 w-64 h-64 bg-mediblue-500 rounded-full opacity-25 blur-3xl -z-10"></div>
                <div className="absolute -top-4 -left-4 w-48 h-48 bg-teal-500 rounded-full opacity-20 blur-2xl -z-10"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-mediblue-800 mb-4">Success Stories</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Hear from medical professionals who found love through MedicoMatch.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Audit L-10: REAL approved success stories only. The previous
                three cards were invented testimonials presented as members. */}
            {successStories.length > 0 ? (
              successStories.map((story) => (
                <div key={story.id} className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                  <div className="flex items-center mb-4">
                    <img
                      src={localAvatar(story.partnerName)}
                      alt={story.partnerName}
                      className="w-14 h-14 rounded-full mr-4"
                    />
                    <div>
                      <h4 className="font-bold text-mediblue-800">{story.partnerName}</h4>
                      <p className="text-sm text-gray-500">MedicoMatch member</p>
                    </div>
                  </div>
                  <p className="text-gray-600 italic">&quot;{story.story}&quot;</p>
                </div>
              ))
            ) : (
              <div className="md:col-span-2 lg:col-span-3 bg-gray-50 rounded-xl p-10 border border-gray-100 text-center">
                <h4 className="font-bold text-mediblue-800 mb-2">Be the first to share your story</h4>
                <p className="text-gray-600 max-w-xl mx-auto">
                  Every success story on this page is a real, verified member who chose to
                  share theirs. There are none published yet — yours could be the first.
                </p>
                <Button
                  variant="outline"
                  className="mt-6 text-mediblue-600 border-mediblue-300 hover:bg-mediblue-50"
                  onClick={() => navigate('/success-stories')}
                >
                  Share your story <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="text-center mt-12">
            <Button
              variant="outline"
              className="text-mediblue-600 border-mediblue-300 hover:bg-mediblue-50"
              onClick={goMatches}
            >
              Start Your Success Story <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      {/* Launch-gap fix #2: legal links surfaced from the only site-wide chrome
          that exists today (the landing page). Every legal page is one click away. */}
      <footer className="bg-gray-900 text-gray-300 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h3 className="text-white text-lg font-bold mb-2">MedicoMatch</h3>
          <p className="text-gray-400 mb-4">
            Connecting medical professionals for meaningful relationships.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mb-4 text-xs">
            <Link to="/privacy" className="text-gray-400 hover:text-white">Privacy Policy</Link>
            <Link to="/terms" className="text-gray-400 hover:text-white">Terms of Service</Link>
            <Link to="/refunds" className="text-gray-400 hover:text-white">Refunds & Cancellation</Link>
            <Link to="/community" className="text-gray-400 hover:text-white">Community Guidelines</Link>
            <Link to="/cookies" className="text-gray-400 hover:text-white">Cookie Policy</Link>
            <Link to="/security" className="text-gray-400 hover:text-white">Security</Link>
            <Link to="/accessibility" className="text-gray-400 hover:text-white">Accessibility</Link>
            <Link to="/help" className="text-gray-400 hover:text-white">Help & Support</Link>
          </nav>
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} MedicoMatch. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
