import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Stethoscope, Eye, EyeOff, Lock, Mail, ArrowRight, 
  ShieldCheck, User, Phone, CheckCircle2, ArrowLeft 
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { registerWithServer, isAuthServerConfigured } from '@/services/auth';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { demoModeEnabled } from '@/lib/devAuth';
import { localAvatar } from '@/lib/avatar';

const SPECIALTIES = [
  "Select Specialty (Optional)",
  "Cardiology", "Neurology", "Orthopedics", "Dermatology",
  "Pediatrics", "Gynecology", "Radiology", "General Surgery",
  "Internal Medicine", "Oncology", "Psychiatry", "Anesthesiology",
  "Ophthalmology", "ENT", "Dentistry", "General Medicine / MBBS"
];

const DEGREES = ["Select Degree (Optional)", "MBBS", "MD", "MS", "DNB", "DM", "MCh", "BDS", "MDS", "Other"];

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [fullName, setFullName] = useState('');
  const [degree, setDegree] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: "Name required", description: "Please enter your full name.", variant: "destructive" });
      return;
    }
    if (!email.trim() || !password.trim()) {
      toast({ title: "Email & Password required", description: "Please enter your email and password to create an account.", variant: "destructive" });
      return;
    }
    if (!agreeTerms) {
      toast({ title: "Terms Agreement", description: "Please agree to the terms of service.", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    setTimeout(async () => {
      const cleanName = fullName.replace(/^dr\.?\s*/i, '');
      // Honest career stage at signup: degree/specialty are OPTIONAL — a
      // medical student is fully eligible to marry and must NOT be forced
      // into "MBBS" or titled "Dr." (the completed-qualification question is
      // answered honestly on the profile, and verification is opt-in anyway).
      const chosenDegree = degree && degree !== 'Select Degree (Optional)' ? degree : '';
      const chosenSpecialty = specialty && specialty !== 'Select Specialty (Optional)' ? specialty : '';
      const isCompletedQualification = Boolean(chosenDegree) &&
        !chosenDegree.toLowerCase().includes('pursuing') &&
        !chosenDegree.toLowerCase().includes('student');
      const displayTitle = isCompletedQualification ? 'Dr. ' : '';

      // Real accounts live on the server (password actually checked on
      // sign-in). Duplicate emails are rejected there; if the server is
      // unreachable we fall back to a local demo account.
      if (isAuthServerConfigured()) {
        const res = await registerWithServer({
          email: email.trim(),
          password,
          firstName: cleanName.split(' ')[0] || cleanName || 'Doctor',
          lastName: cleanName.split(' ').slice(1).join(' '),
          ...(chosenDegree ? { degree: chosenDegree } : {}),
          ...(chosenSpecialty ? { specialty: chosenSpecialty } : {}),
        });
        if (res.ok) {
          // Email verification flow: no auto-login. The account activates only
          // after the emailed link is clicked (closes account enumeration).
          setIsLoading(false);
          toast({
            title: "Verify your email",
            description: "We've sent a verification link to your inbox. Click it to activate your account.",
          });
          navigate('/sign-in');
          return;
        }
        if (res.status === 400) {
          setIsLoading(false);
          toast({
            title: "Registration failed",
            description: res.error,
            variant: "destructive",
          });
          return;
        }
        // status 0 (network). Outside development we FAIL CLOSED — no account
        // is created and no session is handed out when the account server
        // cannot be reached (audit H2).
        if (!demoModeEnabled) {
          setIsLoading(false);
          toast({
            title: "Server unavailable",
            description: "We couldn't reach the account server, so your account was not created. Please try again in a moment.",
            variant: "destructive",
          });
          return;
        }
        // Dev-only: fall through to a local demo account below.
      }
      // Audit H4: local demo sessions must NOT exist outside development. In a
      // production build demoModeEnabled is statically false, so an unreachable
      // (or unconfigured) account server fails closed instead of minting an
      // unverified local session.
      if (!demoModeEnabled) {
        setIsLoading(false);
        toast({
          title: "Registration failed",
          description: "Unable to reach the account server. Please try again in a moment.",
          variant: "destructive",
        });
        return;
      }
      setIsLoading(false);

      // Save profile to local storage
      const newProfile = {
        name: `${displayTitle}${cleanName}`,
        age: 29,
        gender: "Male",
        degree: chosenDegree,
        specialty: chosenSpecialty,
        hospital: "Medical Practice / Hospital",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
        councilName: registrationNumber ? "Medical Council of India (MCI)" : "",
        registrationNumber: registrationNumber || "",
        // Registration numbers cannot be verified in this build — never mark a
        // new profile verified just because a string was typed (audit H2).
        verificationStatus: "Pending",
        isVerified: false,
        email,
        phone,
        aboutMe: `Medical professional (${chosenSpecialty || 'medical field'}) looking for a compatible life partner.`,
      };

      try {
        localStorage.setItem('mm:profileData', JSON.stringify(newProfile));
        window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key: 'mm:profileData' } }));
        // ** SIGN IN THE USER AUTOMATICALLY AFTER SIGNUP **
        signIn({
          email,
          firstName: cleanName.replace(/^dr\.?\s*/i, '') || 'Doctor',
          lastName: '',
          fullName: `${displayTitle}${cleanName}`,
          imageUrl: localAvatar(cleanName),
          specialty: chosenSpecialty,
          degree: chosenDegree,
        });
        // ** END SIGN IN **
        navigate('/matches');
        toast({
          title: "Account created!",
          description: "Account server unreachable — created a local demo session. Your password is not protected.",
        });
      } catch {
        toast({
          title: "Save failed",
          description: "Could not save profile. Please try again.",
          variant: "destructive",
        });
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-sky-50/40 to-slate-100 p-4 sm:p-6 py-8">
      
      {/* Top navigation */}
      <div className="w-full max-w-lg mb-3 flex items-center justify-between">
        <Link 
          to="/" 
          className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-mediblue-600 transition-colors"
        >
          <ArrowLeft size={14} className="mr-1" /> Back to MedicoMatch Home
        </Link>
        <Badge variant="outline" className="text-[10px] bg-white text-emerald-700 border-emerald-200 shadow-xs">
          <ShieldCheck size={11} className="mr-1 text-emerald-600" /> Free Registration
        </Badge>
      </div>

      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="mb-5 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-mediblue-500 to-mediblue-700 text-white shadow-md mb-2.5">
            <Stethoscope size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create Doctor Account</h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">Quick free registration — add details anytime</p>
        </div>

        {/* Form Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/90">
          <form onSubmit={handleSignUp} className="space-y-4">
            
            {/* Full Name */}
            <div className="space-y-1 text-left">
              <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700">
                Full Name <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="fullName"
                  placeholder="e.g. Dr. Rohan Mehta"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-9 text-xs h-10 rounded-xl"
                  required
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              <div className="space-y-1">
                <Label htmlFor="signupEmail" className="text-xs font-semibold text-slate-700">
                  Email Address <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="signupEmail"
                    type="email"
                    placeholder="doctor@hospital.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 text-xs h-10 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">
                  Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                </Label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-9 text-xs h-10 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1 text-left">
              <Label htmlFor="signupPassword" className="text-xs font-semibold text-slate-700">
                Create Secure Password <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="signupPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
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

            {/* Optional Medical Profile Details Card */}
            <div className="pt-2">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Stethoscope size={13} className="text-mediblue-600" /> Medical Background
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Optional — can add later</span>
                </div>

                {/* Degree & Specialty */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="degree" className="text-[11px] font-medium text-slate-600">
                      Medical Degree
                    </Label>
                    <select
                      id="degree"
                      value={degree}
                      onChange={(e) => setDegree(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-mediblue-500"
                    >
                      {DEGREES.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="specialty" className="text-[11px] font-medium text-slate-600">
                      Specialization
                    </Label>
                    <select
                      id="specialty"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-mediblue-500"
                    >
                      {SPECIALTIES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Medical Council Reg No */}
                <div className="space-y-1">
                  <Label htmlFor="regNo" className="text-[11px] font-medium text-slate-600">
                    Medical Council Registration No. <span className="text-slate-400 font-normal">(Optional)</span>
                  </Label>
                  <div className="relative">
                    <ShieldCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="regNo"
                      placeholder="e.g. MCI-849204 (or add later)"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      className="pl-9 text-xs h-9 rounded-xl bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Verification Checkbox */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-left">
              <Checkbox
                id="agreeTerms"
                checked={agreeTerms}
                onCheckedChange={(checked) => setAgreeTerms(Boolean(checked))}
                className="mt-0.5"
              />
              <Label htmlFor="agreeTerms" className="text-[11px] text-slate-600 leading-tight cursor-pointer">
                I agree to the MedicoMatch{' '}
                <Link to="/terms" className="text-mediblue-600 font-semibold hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-mediblue-600 font-semibold hover:underline">Privacy Policy</Link>.
              </Label>
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
                  <span>Creating Account...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={15} />
                  <span>Register Free & Explore Matches</span>
                </div>
              )}
            </Button>
          </form>

          {/* Already have an account? */}
          <div className="mt-5 pt-3 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-600">
              Already registered on MedicoMatch?{' '}
              <Link 
                to="/sign-in" 
                className="font-semibold text-mediblue-600 hover:text-mediblue-800 hover:underline inline-flex items-center gap-0.5"
              >
                Sign In Here <ArrowRight size={12} />
              </Link>
            </p>
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-4 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck size={13} className="text-emerald-600" />
          Private & Encrypted Matrimonial Platform for Healthcare Professionals
        </div>
      </div>
    </div>
  );
};

export default SignUp;
