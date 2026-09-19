import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Stethoscope, Eye, EyeOff, Lock, Mail, ArrowRight, 
  ShieldCheck, Sparkles, KeyRound, ArrowLeft
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { loginWithServer, forgotPassword, isAuthServerConfigured } from '@/services/auth';
import { hasCreatedProfile } from '@/lib/profile';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { demoModeEnabled } from '@/lib/devAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const DEMO_DOCTORS = [
  {
    name: "Dr. Aditya Sharma",
    email: "dr.aditya@demo.medicomatch.in",
    role: "Cardiologist · Lilavati Hospital, Mumbai",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  {
    name: "Dr. Priya Patel",
    email: "dr.priya@demo.medicomatch.in",
    role: "Neurologist · Apollo Hospital, Delhi",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    name: "Dr. Rajesh Gupta",
    email: "dr.rajesh@demo.medicomatch.in",
    role: "Orthopedic Surgeon · Fortis, Bangalore",
    avatar: "https://randomuser.me/api/portraits/men/68.jpg",
  },
];

const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  // Launch-gap fix #6: name the expired-session case so members are not left
  // guessing why they landed back here. Set by ProtectedRoute.
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'expired';
  const dismissExpired = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('reason');
    setSearchParams(next, { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        title: "Email or ID Required",
        description: "Please enter your doctor email or medical council registration number.",
        variant: "destructive",
      });
      return;
    }
    if (!password.trim()) {
      toast({
        title: "Password Required",
        description: "Please enter your password to sign in.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const cleanName = email.split('@')[0].replace(/^dr\.?\s*/i, '');
    const doctorName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    // Real accounts: passwords are verified server-side. A wrong password
    // FAILS here — it never falls through to a session.
    // H-1: the web SPA is cookie-first — the server sets the httpOnly
    // mm_session cookie and returns token:null for browsers (Bearer is only
    // for explicit mobile opt-in). Success = res.ok + res.user; the token is
    // optional and, when absent, nothing is stored in localStorage.
    if (isAuthServerConfigured()) {
      const res = await loginWithServer(email.trim(), password);
      if (res.ok && res.user) {
        const name = res.user.firstName || doctorName;
        signIn(
          {
            id: res.user.id,
            email: res.user.email,
            firstName: name,
            lastName: res.user.lastName,
            fullName: res.user.fullName || `Dr. ${name}`,
            specialty: res.user.specialty || undefined,
            degree: res.user.degree || undefined,
          },
          // H-1: cookie-first — pass the Bearer through only when issued.
          res.token || undefined
        );
        setIsLoading(false);
        toast({
          title: `Welcome back, Dr. ${name}! 🩺`,
          description: "Signed in successfully.",
        });
        // Onboarding gap-fix #1: members without a profile go to the setup
        // wizard first; everyone else lands on Matches.
        navigate(hasCreatedProfile() ? '/matches' : '/onboarding');
        return;
      }
      if (res.status === 401) {
        setIsLoading(false);
        toast({
          title: "Sign-in failed",
          description: "Invalid email or password.",
          variant: "destructive",
        });
        return;
      }
      // Server unreachable. Outside development we FAIL CLOSED — an outage or
      // a misconfigured VITE_API_BASE_URL must never sign anyone in without
      // verified credentials (audit H2).
      if (!demoModeEnabled) {
        setIsLoading(false);
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

    // Demo session (no account backend). Audit H4: this minted a session for
    // arbitrary credentials whenever the server was missing — silent auth
    // theater in a misconfigured prod deploy. Guarded by demoModeEnabled so a
    // production build (where it is statically false) fails CLOSED instead.
    if (demoModeEnabled) {
      signIn({ email: email.trim(), firstName: doctorName || 'Doctor', fullName: `Dr. ${doctorName || 'Doctor'}` });
      setTimeout(() => {
        setIsLoading(false);
        toast({
          title: `Welcome back, Dr. ${doctorName}! 🩺`,
          description: "Signed in successfully. Redirecting to your matrimonial matches...",
        });
        navigate('/matches');
      }, 600);
      return;
    }

    // Production fail-closed: no reachable account server → NO session.
    setIsLoading(false);
    toast({
      title: "Server unavailable",
      description: "Unable to reach the account server. Please try again in a moment.",
      variant: "destructive",
    });
  };

  const handleQuickDemoLogin = (doc: typeof DEMO_DOCTORS[0]) => {
    setEmail(doc.email);
    setPassword('Doctor@123');
    setIsLoading(true);

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
      setIsLoading(false);
      toast({
        title: `Logged in as ${doc.name} 🩺`,
        description: "Loaded verified doctor matrimonial profile.",
      });
      navigate('/matches');
    }, 400);
  };

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast({ title: "Email required", description: "Enter your registered email address.", variant: "destructive" });
      return;
    }
    const targetEmail = forgotEmail.trim();
    setIsForgotModalOpen(false);
    setForgotEmail('');
    if (!isAuthServerConfigured()) {
      toast({ title: "Password reset unavailable", description: "No account server is configured. Please contact support.", variant: "destructive" });
      return;
    }
    await forgotPassword(targetEmail);
    toast({
      title: "Check your inbox",
      description: "If an account exists for that email, a password reset link has been sent.",
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-sky-50/40 to-slate-100 p-4 sm:p-6">
      
      {/* Top back navigation */}
      <div className="w-full max-w-md mb-3 flex items-center justify-between">
        <Link 
          to="/" 
          className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-mediblue-600 transition-colors"
        >
          <ArrowLeft size={14} className="mr-1" /> Back to MedicoMatch Home
        </Link>
        <Badge variant="outline" className="text-[10px] bg-white text-emerald-700 border-emerald-200 shadow-xs">
          <ShieldCheck size={11} className="mr-1 text-emerald-600" /> Verified Network
        </Badge>
      </div>

      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-mediblue-500 to-mediblue-700 text-white shadow-md mb-3">
            <Stethoscope size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">MedicoMatch</h1>
          <p className="text-xs text-slate-600 font-medium mt-1">Exclusive Matrimony for Doctors & Medical Professionals</p>
        </div>

        {/* Main Auth Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/90">
          <div className="text-left mb-5 pb-3 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Welcome Back, Doctor</h2>
            <p className="text-xs text-slate-500 mt-0.5">Sign in to access your matrimonial matches and chats</p>
          </div>

          {sessionExpired && (
            <div role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left">
              <KeyRound size={15} className="mt-0.5 shrink-0 text-amber-700" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-900">Your session expired</p>
                <p className="text-[11px] text-amber-800">Please sign in again — nothing was lost, your profile and matches are waiting.</p>
              </div>
              <button type="button" onClick={dismissExpired} aria-label="Dismiss" className="text-amber-700 hover:text-amber-900 text-xs font-bold px-1">✕</button>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email / Reg Number */}
            <div className="space-y-1.5 text-left">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                Medical Email
              </Label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="text"
                  placeholder="e.g. dr.aditya@demo.medicomatch.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-xs h-10 rounded-xl"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Password
                </Label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-[11px] font-medium text-mediblue-600 hover:text-mediblue-700 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 text-xs h-10 rounded-xl"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                />
                <Label htmlFor="remember" className="text-xs text-slate-600 cursor-pointer">
                  Remember me on this device
                </Label>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 text-xs font-semibold bg-mediblue-600 hover:bg-mediblue-700 text-white rounded-xl shadow-xs transition-all mt-2"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5">
                  <KeyRound size={14} />
                  <span>Sign In as Doctor</span>
                </div>
              )}
            </Button>
          </form>

          {/* Quick Demo Logins Section — development only; must never ship
              credential-free sign-ins to production (audit H3). */}
          {demoModeEnabled && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center mb-2.5 flex items-center justify-center gap-1.5">
              <Sparkles size={12} className="text-amber-500" /> Or 1-Click Quick Demo Login:
            </p>
            <div className="space-y-1.5">
              {DEMO_DOCTORS.map((doc, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleQuickDemoLogin(doc)}
                  className="w-full text-left p-2 rounded-xl bg-slate-50 hover:bg-mediblue-50/80 border border-slate-200/80 hover:border-mediblue-200 flex items-center justify-between gap-2.5 transition-all group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img 
                      src={doc.avatar} 
                      alt={doc.name} 
                      className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0" 
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 group-hover:text-mediblue-800 truncate">
                        {doc.name}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {doc.role}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-mediblue-600 shrink-0 opacity-80 group-hover:opacity-100 flex items-center">
                    Login <ArrowRight size={11} className="ml-0.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Register / Sign Up Link */}
          <div className="mt-5 pt-3 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-600">
              Don't have a verified account?{' '}
              <Link 
                to="/sign-up" 
                className="font-semibold text-mediblue-600 hover:text-mediblue-800 hover:underline inline-flex items-center gap-0.5"
              >
                Register for Free <ArrowRight size={12} />
              </Link>
            </p>
          </div>
        </div>

        {/* Footer Security Notice */}
        <div className="mt-5 text-center text-xs text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1.5 text-[11px]">
            <ShieldCheck size={13} className="text-emerald-600" />
            100% Verified Medical Profiles & MCI Registry Protection
          </p>
          <p className="text-[10px] text-slate-400">
            By signing in, you agree to MedicoMatch{' '}
            <Link to="/terms" className="text-slate-600 hover:underline">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-slate-600 hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Dialog open={isForgotModalOpen} onOpenChange={setIsForgotModalOpen}>
        <DialogContent className="sm:max-w-md bg-white p-6 rounded-2xl">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-mediblue-600" />
              Reset Doctor Account Password
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Enter your registered email address and we'll send you an encrypted password reset link.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendResetLink} className="space-y-3 py-2">
            <div className="space-y-1.5 text-left">
              <Label htmlFor="forgotEmail" className="text-xs font-semibold text-slate-700">
                Registered Medical Email
              </Label>
              <Input
                id="forgotEmail"
                type="email"
                placeholder="doctor@hospital.in"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="text-xs h-10 rounded-xl"
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setIsForgotModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-mediblue-600 hover:bg-mediblue-700 text-white text-xs font-semibold"
              >
                Send Reset Link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SignIn;
