import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { usePersistedState } from '@/hooks/usePersistedState';
import { EMPTY_PROFILE } from '@/lib/profile';
import { computeCompleteness } from '@/lib/profileCompleteness';
import { hasServerSession, saveMyServerProfile, getMyServerProfile } from '@/services/api';
import {
  degreesList, specialtiesList, motherTongueList, religionList, casteList,
  rashiList, nakshatraList, manglikList, careerStagesList,
} from '@/features/matches/data/constants';
import { Check, ChevronLeft, ChevronRight, Upload, SkipForward } from 'lucide-react';

/**
 * Post-verification onboarding wizard (onboarding gap-fix #1).
 *
 * The incumbents never dump one giant form on a new member: they run a short
 * sequence of steps with a visible progress bar, each taking under a minute.
 * This mirrors that — 7 short steps over the fields that actually drive
 * matching, every step saved to the server as it completes (local-first,
 * server-mirrored, exactly like EditProfilePage). Every step is skippable; the
 * completeness meter does the nagging instead of a hard wall.
 */

type StepId = 'identity' | 'career' | 'photo' | 'horoscope' | 'preferences' | 'about' | 'family';

const STEPS: Array<{ id: StepId; title: string; subtitle: string }> = [
  { id: 'identity', title: 'About you', subtitle: 'Name, date of birth and gender' },
  { id: 'career', title: 'Your practice', subtitle: 'Specialty, degree and where you work' },
  { id: 'photo', title: 'Profile photo', subtitle: 'A clear photo of you' },
  { id: 'horoscope', title: 'Horoscope', subtitle: 'Rashi, nakshatra and manglik status' },
  { id: 'preferences', title: 'Partner preferences', subtitle: 'Age range and preferred location' },
  { id: 'about', title: 'In your words', subtitle: 'A short introduction' },
  { id: 'family', title: 'Family & lifestyle', subtitle: 'Optional background details' },
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [profile, setProfile] = usePersistedState('mm:profileData', EMPTY_PROFILE);
  const [, setProfileCreated] = usePersistedState('mm:profileCreated', false);
  const [interests] = usePersistedState<string[]>('mm:profileInterests', []);
  const [photos, setPhotos] = usePersistedState<Array<{ id: number | string; url: string; isPrimary: boolean }>>(
    'mm:profilePhotos', []
  );
  const [saving, setSaving] = useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const stepFromUrl = (searchParams.get('step') as StepId | null) ?? 'identity';
  const foundIndex = STEPS.findIndex((s) => s.id === stepFromUrl);
  const stepIndex = foundIndex < 0 ? 0 : foundIndex;
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const completeness = useMemo(
    () => computeCompleteness({ profile: profile as unknown as Record<string, unknown>, photos, interests }),
    [profile, photos, interests]
  );

  useEffect(() => {
    // Keep the URL in sync so refresh/back lands on the same step.
    if (!searchParams.get('step')) {
      const next = new URLSearchParams(searchParams);
      next.set('step', step.id);
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, step.id]);

  useEffect(() => {
    if (!hasServerSession()) return;
    let cancelled = false;
    getMyServerProfile().then((sp) => {
      if (!sp || cancelled) return;
      setProfile((prev) => ({
        ...prev,
        name: prev.name || sp.name.replace(/^Dr\.\s*/i, ''),
        gender: prev.gender || sp.gender || '',
        specialty: prev.specialty || sp.specialty || '',
        degree: prev.degree || sp.degree || '',
        hospital: prev.hospital || sp.hospital || '',
        location: prev.location || (sp.city ? `${sp.city}${sp.state ? `, ${sp.state}` : ''}` : ''),
        about: prev.about || sp.aboutMe || '',
        lookingFor: prev.lookingFor || sp.lookingFor || '',
        heightCm: prev.heightCm || (sp.heightCm ? String(sp.heightCm) : ''),
        maritalStatus: prev.maritalStatus || sp.maritalStatus || '',
        motherTongue: prev.motherTongue || sp.motherTongue || '',
        religion: prev.religion || sp.religion || '',
        caste: prev.caste || sp.caste || '',
        rashi: (prev as unknown as Record<string, string>).rashi || sp.rashi || '',
        nakshatra: (prev as unknown as Record<string, string>).nakshatra || sp.nakshatra || '',
        manglik: (prev as unknown as Record<string, string>).manglik || sp.manglik || '',
        birthDate: (prev as unknown as Record<string, string>).birthDate || sp.birthDate || '',
        dob: prev.dob || sp.birthDate || '',
        birthTime: (prev as unknown as Record<string, string>).birthTime || sp.birthTime || '',
        birthCity: (prev as unknown as Record<string, string>).birthCity || sp.birthCity || '',
      }));
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (field: keyof typeof profile, value: string) =>
    setProfile((prev) => ({ ...prev, [field]: value }));

  const goto = (index: number) => {
    const bounded = Math.min(Math.max(index, 0), STEPS.length - 1);
    const next = new URLSearchParams(searchParams);
    next.set('step', STEPS[bounded].id);
    setSearchParams(next, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Persist the current draft to the server (same whitelist as EditProfile). */
  const syncToServer = async (): Promise<boolean> => {
    if (!hasServerSession()) return true; // demo/offline — local copy stands
    try {
      const degreeDeclared = (profile.degree || '').trim();
      const isCompleted =
        Boolean(degreeDeclared) &&
        !degreeDeclared.toLowerCase().includes('pursuing') &&
        !degreeDeclared.toLowerCase().includes('student');
      const dobVal = profile.birthDate || profile.dob || null;
      let calculatedAge: number | null = null;
      if (dobVal) {
        const birth = new Date(dobVal);
        if (!Number.isNaN(birth.getTime())) {
          const diffMs = Date.now() - birth.getTime();
          const ageDt = new Date(diffMs);
          calculatedAge = Math.abs(ageDt.getUTCFullYear() - 1970);
        }
      }
      const saved = await saveMyServerProfile({
        full_name: `${isCompleted ? 'Dr. ' : ''}${profile.name}`.replace(/^Dr\.\s*Dr\./i, 'Dr.').trim(),
        career_stage: profile.careerStage || null,
        gender: profile.gender || null,
        age: calculatedAge,
        degree: profile.degree || null,
        specialty: profile.specialty || null,
        hospital: profile.hospital || null,
        city: (profile.location || '').split(',')[0]?.trim() || null,
        state: (profile.location || '').split(',')[1]?.trim() || null,
        about_me: profile.about || null,
        looking_for: profile.lookingFor || null,
        interests: interests ?? [],
        height_cm: profile.heightCm ? Number(profile.heightCm) : null,
        marital_status: profile.maritalStatus || null,
        mother_tongue: profile.motherTongue || null,
        religion: profile.religion || null,
        caste: profile.caste || null,
        rashi: profile.rashi || null,
        nakshatra: profile.nakshatra || null,
        manglik: profile.manglik || null,
        birth_date: dobVal,
        birth_time: profile.birthTime || null,
        birth_city: profile.birthCity || null,
        phone: profile.phone || null,
        email: profile.email || null,
        pref_age_min: profile.prefAgeMin ? Number(profile.prefAgeMin) : null,
        pref_age_max: profile.prefAgeMax ? Number(profile.prefAgeMax) : null,
        pref_location: profile.prefLocation || null,
      });
      return Boolean(saved);
    } catch {
      return false;
    }
  };

  const advance = async (skipped = false) => {
    setSaving(true);
    const ok = await syncToServer();
    setSaving(false);
    if (!ok) {
      toast({
        title: 'Saved on this device only',
        description: 'We could not reach the server. Your answers are kept locally — retry from Settings.',
        variant: 'destructive',
      });
    }
    if (isLast) {
      setProfileCreated(true);
      toast({
        title: 'Profile saved',
        description: `You are ${completeness.percent}% complete. You can refine everything from My Profile.`,
      });
      void navigate('/profile');
      return;
    }
    if (skipped) {
      toast({ title: 'Skipped for now', description: 'You can complete this any time from My Profile.' });
    }
    goto(stepIndex + 1);
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast({ title: 'Photo too large', description: 'Please choose an image under 1.5 MB.', variant: 'destructive' });
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setPhotos((prev) =>
        prev.length === 0
          ? [{ id: 1, url, isPrimary: true }]
          : prev.map((p, i) => (i === 0 ? { ...p, url, isPrimary: true } : p))
      );
      void (async () => {
        try {
          const { uploadMyPhoto } = await import('@/services/api');
          const r = await uploadMyPhoto(url);
          if (!r.ok && r.error) {
            toast({ title: 'Photo not synced', description: r.error, variant: 'destructive' });
          }
        } catch { /* offline — local copy stands */ }
      })();
      toast({ title: 'Photo added', description: 'This becomes your primary profile photo.' });
    };
    reader.readAsDataURL(file);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const renderStep = () => {
    switch (step.id) {
      case 'identity':
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor="ob-name">Full name *</Label>
              <Input id="ob-name" placeholder="Jane Smith" value={profile.name} onChange={(e) => update('name', e.target.value)} />
              <p className="text-[11px] text-slate-500 mt-1">Use your real name — matrimonial profiles are shown to prospective partners.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <Label htmlFor="ob-dob">Date of birth</Label>
                <Input id="ob-dob" type="date" value={profile.dob} onChange={(e) => update('dob', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ob-gender">Gender</Label>
                <select
                  id="ob-gender"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={profile.gender || ''}
                  onChange={(e) => update('gender', e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <Label htmlFor="ob-height">Height (cm)</Label>
                <Input id="ob-height" type="number" placeholder="170" value={profile.heightCm} onChange={(e) => update('heightCm', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ob-marital">Marital status</Label>
                <select
                  id="ob-marital"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={profile.maritalStatus || 'Never Married'}
                  onChange={(e) => update('maritalStatus', e.target.value)}
                >
                  {['Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce'].map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
      case 'career':
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor="ob-stage">Career stage</Label>
              <select
                id="ob-stage"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={profile.careerStage || 'Medical Student'}
                onChange={(e) => update('careerStage', e.target.value)}
              >
                {careerStagesList.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <Label htmlFor="ob-degree">Degree *</Label>
                <select
                  id="ob-degree"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={profile.degree || ''}
                  onChange={(e) => update('degree', e.target.value)}
                >
                  <option value="">Select</option>
                  {degreesList.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="ob-specialty">Specialty *</Label>
                <select
                  id="ob-specialty"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={profile.specialty || ''}
                  onChange={(e) => update('specialty', e.target.value)}
                >
                  <option value="">Select</option>
                  {specialtiesList.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="ob-hospital">Hospital / clinic</Label>
              <Input id="ob-hospital" placeholder="e.g. Apollo Hospitals" value={profile.hospital} onChange={(e) => update('hospital', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ob-location">City, State</Label>
              <Input id="ob-location" placeholder="e.g. Mumbai, Maharashtra" value={profile.location} onChange={(e) => update('location', e.target.value)} />
            </div>
          </div>
        );
      case 'photo':
        return (
          <div className="space-y-3">
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            <div className="flex items-center gap-4">
              <div className="h-28 w-28 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center shrink-0">
                {photos[0]?.url ? (
                  <img src={photos[0].url} alt="Your profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-slate-400">No photo</span>
                )}
              </div>
              <div className="space-y-2">
                <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()}>
                  <Upload size={14} className="mr-1.5" /> {photos[0]?.url ? 'Replace photo' : 'Upload photo'}
                </Button>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  JPG or PNG up to 1.5 MB. A clear face photo is the single biggest driver of responses — profiles without one are ranked last.
                </p>
              </div>
            </div>
          </div>
        );
      case 'horoscope':
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Used for Kundali Milan compatibility scoring. Optional, but it unlocks the 36-Guna report on profiles you view.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <Label htmlFor="ob-rashi">Rashi (Moon sign)</Label>
                <select id="ob-rashi" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={profile.rashi || ''} onChange={(e) => update('rashi', e.target.value)}>
                  <option value="">Select</option>
                  {rashiList.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="ob-nakshatra">Nakshatra</Label>
                <select id="ob-nakshatra" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={profile.nakshatra || ''} onChange={(e) => update('nakshatra', e.target.value)}>
                  <option value="">Select</option>
                  {nakshatraList.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <Label htmlFor="ob-manglik">Manglik</Label>
                <select id="ob-manglik" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={profile.manglik || 'Non-Manglik'} onChange={(e) => update('manglik', e.target.value)}>
                  {manglikList.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="ob-tongue">Mother tongue</Label>
                <select id="ob-tongue" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={profile.motherTongue || 'Hindi'} onChange={(e) => update('motherTongue', e.target.value)}>
                  {motherTongueList.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <Label htmlFor="ob-religion">Religion</Label>
                <select id="ob-religion" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={profile.religion || ''} onChange={(e) => update('religion', e.target.value)}>
                  <option value="">Select</option>
                  {religionList.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="ob-caste">Caste / community</Label>
                <select id="ob-caste" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={profile.caste || ''} onChange={(e) => update('caste', e.target.value)}>
                  <option value="">Select</option>
                  {casteList.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        );
      case 'preferences':
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">These drive which profiles we surface to you first.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <Label htmlFor="ob-prefmin">Partner age from</Label>
                <Input id="ob-prefmin" type="number" placeholder="24" value={profile.prefAgeMin} onChange={(e) => update('prefAgeMin', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ob-prefmax">Partner age to</Label>
                <Input id="ob-prefmax" type="number" placeholder="36" value={profile.prefAgeMax} onChange={(e) => update('prefAgeMax', e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="ob-prefloc">Preferred location</Label>
              <Input id="ob-prefloc" placeholder="e.g. Mumbai / Anywhere in India" value={profile.prefLocation} onChange={(e) => update('prefLocation', e.target.value)} />
            </div>
          </div>
        );
      case 'about':
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor="ob-about">About you</Label>
              <Textarea id="ob-about" rows={4} placeholder="Your work, what you enjoy, what matters to you…" value={profile.about} onChange={(e) => update('about', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ob-looking">What you are looking for</Label>
              <Textarea id="ob-looking" rows={3} placeholder="Values, lifestyle, family expectations…" value={profile.lookingFor} onChange={(e) => update('lookingFor', e.target.value)} />
            </div>
          </div>
        );
      case 'family':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <Label htmlFor="ob-familytype">Family type</Label>
                <select id="ob-familytype" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={String((profile as unknown as Record<string, string>).familyType || '')} onChange={(e) => update('familyType' as never, e.target.value as never)}>
                  <option value="">Select</option>
                  {['Joint', 'Nuclear', 'Extended'].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="ob-diet">Diet</Label>
                <select id="ob-diet" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={String((profile as unknown as Record<string, string>).diet || '')} onChange={(e) => update('diet' as never, e.target.value as never)}>
                  <option value="">Select</option>
                  {['Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Vegan'].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="ob-expectations">Partner expectations</Label>
              <Textarea id="ob-expectations" rows={2} placeholder="What matters most to you in a partner…"
                value={String((profile as unknown as Record<string, string>).expectations || '')} onChange={(e) => update('expectations' as never, e.target.value as never)} />
            </div>
          </div>
        );
      // MORE_STEPS_PLACEHOLDER
      default:
        return null;
    }
  };

  // LOGIC_PLACEHOLDER

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-3 sm:p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Set up your profile</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Step {stepIndex + 1} of {STEPS.length} — {completeness.percent}% complete
              </p>
            </div>
            <Link to="/matches" className="text-xs text-slate-500 hover:text-slate-700 shrink-0">Skip all</Link>
          </div>

          <Progress value={((stepIndex + 1) / STEPS.length) * 100} className="h-2" />

          <Card>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{step.title}</h2>
                <p className="text-xs text-slate-500">{step.subtitle}</p>
              </div>
              {renderStep()}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" disabled={stepIndex === 0 || saving} onClick={() => goto(stepIndex - 1)}>
              <ChevronLeft size={14} className="mr-1" /> Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={saving} onClick={() => void advance(true)}>
                <SkipForward size={14} className="mr-1" /> Skip
              </Button>
              <Button
                size="sm"
                className="bg-mediblue-600 hover:bg-mediblue-700 text-white"
                disabled={saving}
                onClick={() => void advance(false)}
              >
                {saving ? (
                  'Saving…'
                ) : isLast ? (
                  <><Check size={14} className="mr-1.5" /> Finish</>
                ) : (
                  <>Save &amp; continue <ChevronRight size={14} className="ml-1" /></>
                )}
              </Button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            Every answer can be changed later from <Link to="/profile/edit" className="text-mediblue-600 underline">Edit Profile</Link>.
            {' '}Your phone and email are never shown to other members — they unlock only via a contact view.
          </p>
        </div>
      </main>
    </div>
  );
};

export default OnboardingPage;